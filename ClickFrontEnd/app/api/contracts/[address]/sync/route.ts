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
    const contract = await db.get(`
      SELECT id, name, symbol, deployment_block
      FROM contracts
      WHERE LOWER(address) = LOWER($1)
    `, [address.toLowerCase()]) as any

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found'
      }, { status: 404 })
    }

    // Get event statistics
    const eventStats = await db.get(`
      SELECT
        COUNT(*) as total_events,
        MIN(block_number) as first_block,
        MAX(block_number) as last_block,
        MIN(block_timestamp) as first_timestamp,
        MAX(block_timestamp) as last_timestamp
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
    `, [address.toLowerCase()]) as any

    // Get holder statistics
    const holderStats = await db.get(`
      SELECT
        COUNT(DISTINCT address) as total_holders,
        COUNT(DISTINCT token_id) as unique_tokens,
        SUM(CAST(balance AS BIGINT)) as total_supply
      FROM current_state
      WHERE LOWER(contract_address) = LOWER($1)
        AND CAST(balance AS BIGINT) > 0
    `, [address.toLowerCase()]) as any

    const totalEvents = parseInt(eventStats?.total_events) || 0
    const totalHolders = parseInt(holderStats?.total_holders) || 0
    const uniqueTokens = parseInt(holderStats?.unique_tokens) || 0
    const lastSyncedBlock = parseInt(eventStats?.last_block) || 0

    // Determine sync status
    let status = 'idle'
    if (totalEvents > 0) {
      status = 'completed'
    }

    return NextResponse.json({
      success: true,
      data: {
        status,
        lastSyncedBlock,
        deploymentBlock: contract.deployment_block || 0,
        currentBlock: lastSyncedBlock,
        endBlock: lastSyncedBlock,
        progressPercentage: totalEvents > 0 ? 100 : 0,
        statistics: {
          totalEvents,
          totalHolders,
          uniqueTokens,
          totalSupply: holderStats?.total_supply || 0
        },
        timestamps: {
          firstEvent: eventStats?.first_timestamp || null,
          lastEvent: eventStats?.last_timestamp || null,
          lastSync: eventStats?.last_timestamp || null
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
      await fetch(`${syncWorkerUrl}/health`, {
        signal: AbortSignal.timeout(60000) // 60 second timeout for cold start
      })
      console.log('✅ Worker is awake')
    } catch (error) {
      console.log('⚠️ Worker wake-up timeout, continuing anyway...')
    }

    // Step 2: Trigger sync job
    console.log('🚀 Triggering sync job...')
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
      signal: AbortSignal.timeout(10000) // 10 second timeout for sync trigger
    })

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
