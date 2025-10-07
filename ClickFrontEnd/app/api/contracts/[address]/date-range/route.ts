import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
db.pragma('journal_mode = WAL')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params

    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    // Get contract from database
    const contract = db.prepare(`
      SELECT id, name, symbol, contract_type, deployment_block FROM contracts
      WHERE address = ? COLLATE NOCASE
    `).get(address.toLowerCase()) as any

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found'
      }, { status: 404 })
    }

    // Get date range for this contract's events
    const dateRange = db.prepare(`
      SELECT 
        MIN(block_timestamp) as earliest_timestamp,
        MAX(block_timestamp) as latest_timestamp,
        MIN(block_number) as earliest_block,
        MAX(block_number) as latest_block,
        COUNT(*) as total_events
      FROM events 
      WHERE contract_address = ? COLLATE NOCASE
    `).get(address.toLowerCase()) as any

    if (!dateRange || dateRange.total_events === 0) {
      return NextResponse.json({
        success: false,
        error: 'No blockchain events found for this contract. Please sync blockchain data first.'
      }, { status: 404 })
    }

    const earliestDate = new Date(dateRange.earliest_timestamp * 1000)
    const latestDate = new Date(dateRange.latest_timestamp * 1000)

    return NextResponse.json({
      success: true,
      data: {
        contract: {
          address: address.toLowerCase(),
          name: contract.name,
          symbol: contract.symbol,
          type: contract.contract_type,
          deploymentBlock: contract.deployment_block
        },
        dateRange: {
          earliestDate: earliestDate.toISOString(),
          latestDate: latestDate.toISOString(),
          earliestBlock: dateRange.earliest_block,
          latestBlock: dateRange.latest_block,
          totalEvents: dateRange.total_events,
          // For form validation
          minDate: earliestDate.toISOString().split('T')[0], // YYYY-MM-DD
          maxDate: latestDate.toISOString().split('T')[0]   // YYYY-MM-DD
        },
        stats: {
          dataAvailability: `${Math.round((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24))} days`,
          blockRange: dateRange.latest_block - dateRange.earliest_block,
          avgBlocksPerDay: Math.round((dateRange.latest_block - dateRange.earliest_block) / ((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)))
        }
      }
    })

  } catch (error: any) {
    console.error('Date range query error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}