import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'

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
      WHERE address = ?
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
      WHERE LOWER(contract_address) = ?
    `).get(address.toLowerCase()) as any

    // Get holder statistics
    const holderStats = await db.prepare(`
      SELECT
        COUNT(DISTINCT address) as total_holders,
        COUNT(DISTINCT token_id) as unique_tokens,
        SUM(CAST(balance AS INTEGER)) as total_supply
      FROM current_state
      WHERE LOWER(contract_address) = ?
        AND CAST(balance AS INTEGER) > 0
    `).get(address.toLowerCase()) as any

    const totalEvents = eventStats?.total_events || 0
    const totalHolders = holderStats?.total_holders || 0
    const uniqueTokens = holderStats?.unique_tokens || 0
    const lastSyncedBlock = eventStats?.last_block || 0

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
