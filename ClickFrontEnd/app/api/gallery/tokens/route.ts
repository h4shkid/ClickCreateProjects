import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const contractAddress = searchParams.get('contract')
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '0')

    if (!contractAddress) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    if (!OPENSEA_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'OpenSea API key not configured'
      }, { status: 500 })
    }

    const db = createDatabaseAdapter()

    // Get all token IDs from database (sorted high to low)
    const dbTokens = db.prepare(`
      SELECT DISTINCT token_id
      FROM current_state
      WHERE LOWER(contract_address) = LOWER(?)
      ORDER BY CAST(token_id AS INTEGER) DESC
      LIMIT ? OFFSET ?
    `).all(contractAddress, limit, page * limit) as Array<{ token_id: string }>

    // If no tokens in DB, fall back to OpenSea pagination
    if (dbTokens.length === 0) {
      const response = await fetch(
        `https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}/nfts?limit=${limit}`,
        {
          headers: {
            'x-api-key': OPENSEA_API_KEY
          }
        }
      )

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: 'Failed to fetch NFTs from OpenSea'
        }, { status: response.status })
      }

      const data = await response.json()
      const tokens = (data.nfts?.map((nft: any) => ({
        contractAddress: nft.contract,
        tokenId: nft.identifier,
        name: nft.name || `#${nft.identifier}`,
        description: nft.description,
        imageUrl: nft.image_url || nft.display_image_url,
        attributes: nft.traits?.map((trait: any) => ({
          trait_type: trait.trait_type,
          value: trait.value
        })) || []
      })) || []).reverse()

      return NextResponse.json({
        success: true,
        data: {
          tokens,
          pagination: {
            page,
            hasMore: data.next !== null
          }
        }
      })
    }

    // Fetch metadata from OpenSea for each token
    const tokens = await Promise.all(
      dbTokens.map(async ({ token_id }) => {
        try {
          const response = await fetch(
            `https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}/nfts/${token_id}`,
            {
              headers: {
                'x-api-key': OPENSEA_API_KEY
              }
            }
          )

          if (!response.ok) {
            return {
              contractAddress,
              tokenId: token_id,
              name: `#${token_id}`,
              description: null,
              imageUrl: null,
              attributes: []
            }
          }

          const nft = await response.json()
          return {
            contractAddress: nft.nft?.contract || contractAddress,
            tokenId: nft.nft?.identifier || token_id,
            name: nft.nft?.name || `#${token_id}`,
            description: nft.nft?.description,
            imageUrl: nft.nft?.image_url || nft.nft?.display_image_url,
            attributes: nft.nft?.traits?.map((trait: any) => ({
              trait_type: trait.trait_type,
              value: trait.value
            })) || []
          }
        } catch (err) {
          console.error(`Failed to fetch token ${token_id}:`, err)
          return {
            contractAddress,
            tokenId: token_id,
            name: `#${token_id}`,
            description: null,
            imageUrl: null,
            attributes: []
          }
        }
      })
    )

    // Check if there are more tokens
    const totalCount = db.prepare(`
      SELECT COUNT(DISTINCT token_id) as count
      FROM current_state
      WHERE LOWER(contract_address) = LOWER(?)
    `).get(contractAddress) as { count: number }

    return NextResponse.json({
      success: true,
      data: {
        tokens,
        pagination: {
          page,
          hasMore: (page + 1) * limit < totalCount.count
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
