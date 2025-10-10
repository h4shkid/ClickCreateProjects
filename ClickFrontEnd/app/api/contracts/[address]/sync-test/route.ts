import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'

// Test endpoint to debug sync API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    const db = createDatabaseAdapter()

    console.log('Testing sync API for address:', address)

    // Test 1: Get contract
    const contract = await db.prepare(`
      SELECT id, name, symbol, deployment_block
      FROM contracts
      WHERE LOWER(address) = LOWER(?)
    `).get(address.toLowerCase()) as any

    console.log('Contract result:', contract)

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found',
        address: address.toLowerCase()
      }, { status: 404 })
    }

    // Test 2: Get event stats
    const eventStats = await db.prepare(`
      SELECT
        COUNT(*) as total_events,
        MIN(block_number) as first_block,
        MAX(block_number) as last_block
      FROM events
      WHERE LOWER(contract_address) = LOWER(?)
    `).get(address.toLowerCase()) as any

    console.log('Event stats result:', eventStats)

    // Test 3: Get holder stats
    const holderStats = await db.prepare(`
      SELECT
        COUNT(DISTINCT address) as total_holders,
        COUNT(DISTINCT token_id) as unique_tokens
      FROM current_state
      WHERE LOWER(contract_address) = LOWER(?)
        AND CAST(balance AS BIGINT) > 0
    `).get(address.toLowerCase()) as any

    console.log('Holder stats result:', holderStats)

    return NextResponse.json({
      success: true,
      tests: {
        contract: contract,
        eventStats: eventStats,
        holderStats: holderStats
      },
      debug: {
        address: address.toLowerCase(),
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('Sync test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
