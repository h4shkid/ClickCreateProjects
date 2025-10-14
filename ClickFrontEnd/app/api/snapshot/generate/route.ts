import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contractAddress, tokenId } = body

    if (!contractAddress) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    const db = createDatabaseAdapter()

    // Get contract info
    const contract = db.prepare(`
      SELECT name, symbol, contract_type
      FROM contracts
      WHERE LOWER(address) = LOWER(?)
    `).get(contractAddress) as { name: string; symbol: string; contract_type: string } | undefined

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found'
      }, { status: 404 })
    }

    // Get holders for specific token or all tokens
    let holders
    if (tokenId) {
      holders = db.prepare(`
        SELECT address, token_id, balance
        FROM current_state
        WHERE LOWER(contract_address) = LOWER(?)
          AND token_id = ?
          AND CAST(balance AS INTEGER) > 0
        ORDER BY CAST(balance AS INTEGER) DESC
      `).all(contractAddress, tokenId) as Array<{
        address: string
        token_id: string
        balance: string
      }>
    } else {
      holders = db.prepare(`
        SELECT address, token_id, balance
        FROM current_state
        WHERE LOWER(contract_address) = LOWER(?)
          AND CAST(balance AS INTEGER) > 0
        ORDER BY token_id, CAST(balance AS INTEGER) DESC
      `).all(contractAddress) as Array<{
        address: string
        token_id: string
        balance: string
      }>
    }

    // Build snapshot
    const snapshot = {
      metadata: {
        contractAddress,
        contractName: contract.name,
        contractSymbol: contract.symbol,
        contractType: contract.contract_type,
        tokenId: tokenId || 'all',
        timestamp: new Date().toISOString(),
        totalHolders: holders.length
      },
      holders: holders.map(h => ({
        address: h.address,
        tokenId: h.token_id,
        balance: h.balance
      }))
    }

    return NextResponse.json({
      success: true,
      data: {
        snapshot
      }
    })

  } catch (error: any) {
    console.error('Snapshot generation error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate snapshot'
    }, { status: 500 })
  }
}
