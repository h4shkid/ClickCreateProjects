import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string; tokenId: string } }
) {
  try {
    const { address, tokenId } = params

    const db = createDatabaseAdapter()

    // Get holders for this specific token
    const holders = db.prepare(`
      SELECT address, balance
      FROM current_state
      WHERE LOWER(contract_address) = LOWER(?)
        AND token_id = ?
        AND CAST(balance AS INTEGER) > 0
      ORDER BY CAST(balance AS INTEGER) DESC
    `).all(address, tokenId) as Array<{
      address: string
      balance: string
    }>

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
    console.error('Token holders error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch token holders'
    }, { status: 500 })
  }
}
