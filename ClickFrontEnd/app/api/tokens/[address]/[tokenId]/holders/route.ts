import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string; tokenId: string }> }
) {
  try {
    const { address, tokenId } = await params

    console.log('[Holders API] Fetching holders for:', address, 'token:', tokenId)

    const db = createDatabaseAdapter()

    // Get holders for this specific token
    const stmt = db.prepare(`
      SELECT address, balance
      FROM current_state
      WHERE LOWER(contract_address) = LOWER(?)
        AND token_id = ?
        AND CAST(balance AS INTEGER) > 0
      ORDER BY CAST(balance AS INTEGER) DESC
    `)

    const holders = await stmt.all(address, tokenId) as Array<{
      address: string
      balance: string
    }>

    console.log('[Holders API] Found', holders.length, 'holders')

    const holderCount = holders.length

    return NextResponse.json({
      success: true,
      data: {
        contractAddress: address,
        tokenId,
        holders,
        holderCount
      }
    })

  } catch (error: any) {
    console.error('[Holders API] Error:', error.message, error.stack)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch token holders',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
