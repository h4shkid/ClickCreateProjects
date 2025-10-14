import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const dbPath = path.join(process.cwd(), 'data', 'clickcreate.db')

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const contractAddress = searchParams.get('contract')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '24')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sortBy = searchParams.get('sortBy') || 'tokenId'

    const db = new Database(dbPath, { readonly: true })

    // Build WHERE clause
    let whereClause = '1=1'
    const params: any[] = []

    if (contractAddress) {
      whereClause += ' AND LOWER(cs.contract_address) = LOWER(?)'
      params.push(contractAddress)
    }

    if (search) {
      whereClause += ' AND (cs.token_id LIKE ? OR nm.name LIKE ? OR nm.description LIKE ?)'
      const searchPattern = `%${search}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }

    // Build ORDER BY clause
    let orderBy = 'cs.token_id ASC'
    if (sortBy === 'holders') {
      orderBy = 'holder_count DESC, cs.token_id ASC'
    } else if (sortBy === 'supply') {
      orderBy = 'CAST(total_supply AS INTEGER) DESC, cs.token_id ASC'
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT cs.token_id) as total
      FROM (
        SELECT contract_address, token_id, SUM(CAST(balance AS INTEGER)) as total_supply
        FROM current_state
        WHERE balance != '0'
        GROUP BY contract_address, token_id
      ) cs
      LEFT JOIN nft_metadata nm ON LOWER(cs.contract_address) = LOWER(nm.contract_address)
        AND cs.token_id = nm.token_id
      WHERE ${whereClause}
    `

    const countResult = db.prepare(countQuery).get(...params) as { total: number }
    const total = countResult.total

    // Get tokens with holder info
    const tokensQuery = `
      SELECT
        cs.contract_address,
        cs.token_id,
        cs.total_supply,
        COUNT(DISTINCT cs.address) as holder_count,
        MAX(CAST(cs.balance AS INTEGER)) as max_balance,
        nm.name,
        nm.description,
        nm.image_url,
        nm.attributes,
        c.name as collection_name,
        c.symbol as collection_symbol,
        c.image_url as collection_image
      FROM (
        SELECT contract_address, token_id, address, balance, SUM(CAST(balance AS INTEGER)) OVER (PARTITION BY contract_address, token_id) as total_supply
        FROM current_state
        WHERE balance != '0'
      ) cs
      LEFT JOIN nft_metadata nm ON LOWER(cs.contract_address) = LOWER(nm.contract_address)
        AND cs.token_id = nm.token_id
      LEFT JOIN contracts c ON LOWER(cs.contract_address) = LOWER(c.address)
      WHERE ${whereClause}
      GROUP BY cs.contract_address, cs.token_id
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `

    params.push(limit, offset)

    const tokens = db.prepare(tokensQuery).all(...params) as Array<{
      contract_address: string
      token_id: string
      total_supply: string
      holder_count: number
      max_balance: number
      name: string | null
      description: string | null
      image_url: string | null
      attributes: string | null
      collection_name: string
      collection_symbol: string
      collection_image: string
    }>

    // Get top holders for each token
    const tokensWithHolders = tokens.map(token => {
      const topHoldersQuery = `
        SELECT address, balance
        FROM current_state
        WHERE LOWER(contract_address) = LOWER(?)
          AND token_id = ?
          AND balance != '0'
        ORDER BY CAST(balance AS INTEGER) DESC
        LIMIT 3
      `

      const topHolders = db.prepare(topHoldersQuery).all(token.contract_address, token.token_id) as Array<{
        address: string
        balance: string
      }>

      return {
        contractAddress: token.contract_address,
        tokenId: token.token_id,
        name: token.name,
        description: token.description,
        imageUrl: token.image_url,
        attributes: token.attributes ? JSON.parse(token.attributes) : [],
        totalSupply: token.total_supply,
        holderCount: token.holder_count,
        maxBalance: token.max_balance.toString(),
        topHolders,
        collection: {
          name: token.collection_name,
          symbol: token.collection_symbol,
          imageUrl: token.collection_image
        }
      }
    })

    db.close()

    return NextResponse.json({
      success: true,
      data: {
        tokens: tokensWithHolders,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    })

  } catch (error: any) {
    console.error('Gallery tokens error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch gallery tokens'
    }, { status: 500 })
  }
}
