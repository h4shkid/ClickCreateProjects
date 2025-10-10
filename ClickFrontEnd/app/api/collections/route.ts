import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'

// GET - Get all public collections
export async function GET(request: NextRequest) {
  try {
    const db = createDatabaseAdapter()

    // Get all collections with holder/supply statistics
    const collections = await db.prepare(`
      SELECT
        c.id,
        c.address,
        c.name,
        c.symbol,
        c.contract_type as contractType,
        c.chain_id as chainId,
        c.description,
        c.image_url as imageUrl,
        c.is_verified as isVerified,
        c.usage_count as usageCount,
        c.created_at as createdAt,
        COUNT(DISTINCT cs.address) FILTER (WHERE CAST(cs.balance AS BIGINT) > 0) as holderCount,
        COUNT(DISTINCT cs.token_id) FILTER (WHERE CAST(cs.balance AS BIGINT) > 0) as uniqueTokens,
        COALESCE(SUM(CAST(cs.balance AS BIGINT)) FILTER (WHERE CAST(cs.balance AS BIGINT) > 0), 0) as totalSupply,
        MAX(e.block_timestamp) as lastActivityAt
      FROM contracts c
      LEFT JOIN current_state cs ON LOWER(c.address) = LOWER(cs.contract_address)
      LEFT JOIN events e ON LOWER(c.address) = LOWER(e.contract_address)
      WHERE c.is_active = true
      GROUP BY c.id, c.address, c.name, c.symbol, c.contract_type, c.chain_id,
               c.description, c.image_url, c.is_verified, c.usage_count, c.created_at
      ORDER BY c.usage_count DESC, c.created_at DESC
    `).all() as any[]

    return NextResponse.json({
      success: true,
      data: {
        collections: collections.map(c => ({
          ...c,
          holderCount: parseInt(c.holderCount) || 0,
          uniqueTokens: parseInt(c.uniqueTokens) || 0,
          totalSupply: c.totalSupply?.toString() || '0'
        })),
        total: collections.length
      }
    })

  } catch (error: any) {
    console.error('Collections API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
