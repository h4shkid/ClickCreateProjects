import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'

// GET - Get sync status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    const db = createDatabaseAdapter()

    // Get contract info
    const contract = await db.prepare(`
      SELECT id, name, symbol, deployment_block
      FROM contracts
      WHERE LOWER(address) = LOWER(?)
    `).get(address.toLowerCase()) as any

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found'
      }, { status: 404 })
    }

    // Get event statistics
    const eventStats = await db.prepare(`
      SELECT
        COUNT(*) as total_events,
        MIN(block_number) as first_block,
        MAX(block_number) as last_block,
        MIN(block_timestamp) as first_timestamp,
        MAX(block_timestamp) as last_timestamp
      FROM events
      WHERE LOWER(contract_address) = LOWER(?)
    `).get(address.toLowerCase()) as any

    // Get holder statistics
    const holderStats = await db.prepare(`
      SELECT
        COUNT(DISTINCT address) as total_holders,
        COUNT(DISTINCT token_id) as unique_tokens,
        SUM(CAST(balance AS BIGINT)) as total_supply
      FROM current_state
      WHERE LOWER(contract_address) = LOWER(?)
        AND CAST(balance AS BIGINT) > 0
    `).get(address.toLowerCase()) as any

    const totalEvents = parseInt(eventStats?.total_events || eventStats?.['total_events']) || 0
    const totalHolders = parseInt(holderStats?.total_holders || holderStats?.['total_holders']) || 0
    const uniqueTokens = parseInt(holderStats?.unique_tokens || holderStats?.['unique_tokens']) || 0
    const lastSyncedBlock = parseInt(eventStats?.last_block || eventStats?.['last_block']) || 0

    // Check worker for real-time progress
    const syncWorkerUrl = process.env.SYNC_WORKER_URL
    let workerProgress = null

    if (syncWorkerUrl) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)

        const progressRes = await fetch(`${syncWorkerUrl}/progress/${address.toLowerCase()}`, {
          signal: controller.signal
        })
        clearTimeout(timeout)

        const progressData = await progressRes.json()

        if (progressData.success && progressData.progress) {
          workerProgress = progressData.progress
        }
      } catch (err) {
        // Worker offline or timeout, ignore
      }
    }

    // Determine sync status
    let status = 'idle'
    let progressPercentage = totalEvents > 0 ? 100 : 0

    if (workerProgress && workerProgress.status === 'processing') {
      status = 'processing'
      progressPercentage = workerProgress.progress || 0
    } else if (workerProgress && workerProgress.status === 'completed') {
      status = 'completed'
      progressPercentage = 100
    } else if (totalEvents > 0) {
      status = 'completed'
    }

    // Get current blockchain block number
    let currentBlockNumber = lastSyncedBlock

    // Try to get current block from RPC provider
    try {
      const { ethers } = await import('ethers')
      const rpcUrl = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT ||
                     (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
                       ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
                       : 'https://eth.llamarpc.com')

      const provider = new ethers.JsonRpcProvider(rpcUrl)
      currentBlockNumber = await provider.getBlockNumber()
    } catch (err) {
      // Fallback to last synced block if RPC call fails
      console.log('Could not fetch current block number:', err)
    }

    // Check if recently synced (within 50 blocks)
    const blocksBehind = currentBlockNumber - lastSyncedBlock
    const isSynced = blocksBehind <= 50

    return NextResponse.json({
      success: true,
      data: {
        status,
        lastSyncedBlock,
        currentBlockNumber, // Current blockchain block
        deploymentBlock: contract.deployment_block || 0,
        currentBlock: workerProgress?.currentBlock || lastSyncedBlock, // Worker's current processing block
        endBlock: workerProgress?.endBlock || lastSyncedBlock,
        progressPercentage,
        isSynced, // Add sync status based on grace period
        workerProgress,
        statistics: {
          totalEvents,
          totalHolders,
          uniqueTokens,
          totalSupply: holderStats?.total_supply || holderStats?.['total_supply'] || 0
        },
        timestamps: {
          firstEvent: eventStats?.first_timestamp || eventStats?.['first_timestamp'] || null,
          lastEvent: eventStats?.last_timestamp || eventStats?.['last_timestamp'] || null,
          lastSync: eventStats?.last_timestamp || eventStats?.['last_timestamp'] || null
        }
      }
    })

  } catch (error: any) {
    console.error('Sync status error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Trigger blockchain sync
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    const body = await request.json().catch(() => ({}))

    const syncWorkerUrl = process.env.SYNC_WORKER_URL

    if (!syncWorkerUrl) {
      return NextResponse.json({
        success: false,
        error: 'Sync worker not configured. Please contact administrator.'
      }, { status: 503 })
    }

    // Step 1: Wake up worker (Render free tier cold start)
    console.log('🔄 Waking up sync worker...')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000) // 60 second timeout

      await fetch(`${syncWorkerUrl}/health`, {
        signal: controller.signal
      })
      clearTimeout(timeout)
      console.log('✅ Worker is awake')
    } catch (error) {
      console.log('⚠️ Worker wake-up timeout, continuing anyway...')
    }

    // Step 2: Trigger sync job
    console.log('🚀 Triggering sync job...')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    const workerResponse = await fetch(`${syncWorkerUrl}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SYNC_WORKER_SECRET || ''}`
      },
      body: JSON.stringify({
        contractAddress: address.toLowerCase(),
        fromBlock: body.fromBlock || 'auto',
        toBlock: body.toBlock || 'latest'
      }),
      signal: controller.signal
    })
    clearTimeout(timeout)

    const workerData = await workerResponse.json()

    if (!workerData.success) {
      return NextResponse.json({
        success: false,
        error: workerData.error || 'Failed to queue sync job'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      jobId: workerData.jobId,
      message: 'Blockchain sync started',
      position: workerData.position
    })

  } catch (error: any) {
    console.error('Sync trigger error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
