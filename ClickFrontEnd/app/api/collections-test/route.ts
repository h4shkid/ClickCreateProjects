import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'

export async function GET(request: NextRequest) {
  try {
    const db = createDatabaseAdapter()

    // Simple test: just get contracts without joins
    const contracts = await db.prepare(`
      SELECT id, address, name, symbol, contract_type, chain_id
      FROM contracts
      WHERE is_active = true
      ORDER BY created_at DESC
    `).all()

    return NextResponse.json({
      success: true,
      count: contracts.length,
      contracts
    })

  } catch (error: any) {
    console.error('Test API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
