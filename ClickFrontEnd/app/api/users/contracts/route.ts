import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/middleware'
import { createDatabaseAdapter } from '@/lib/database/adapter'

// GET user's tracked contracts
export async function GET(request: NextRequest) {
  try {
    const db = createDatabaseAdapter()
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')
    
    if (!walletAddress) {
      return NextResponse.json({
        success: true,
        data: {
          collections: [] // No wallet address provided
        }
      })
    }

    // Get user's contracts from database
    const query = `
      SELECT 
        c.id,
        c.address,
        c.name,
        c.symbol,
        c.contract_type as contractType,
        c.chain_id as chainId,
        c.description,
        c.website_url as websiteUrl,
        c.twitter_url as twitterUrl,
        c.discord_url as discordUrl,
        c.image_url as imageUrl,
        c.banner_image_url as bannerImageUrl,
        c.is_verified as isVerified,
        c.usage_count as usageCount,
        c.total_supply as totalSupply,
        c.created_at as addedAt,
        ca.total_holders as holderCount,
        COUNT(DISTINCT us.id) as userSnapshots
      FROM contracts c
      LEFT JOIN user_profiles up ON up.wallet_address = ? COLLATE NOCASE
      LEFT JOIN contract_analytics ca ON c.id = ca.contract_id 
        AND ca.analysis_date = (
          SELECT MAX(analysis_date) 
          FROM contract_analytics 
          WHERE contract_id = c.id
        )
      LEFT JOIN user_snapshots us ON c.id = us.contract_id AND us.user_id = up.id
      WHERE c.added_by_user_id = up.id
      GROUP BY c.id
      ORDER BY c.usage_count DESC, c.created_at DESC
    `

    const contracts = db.prepare(query).all(walletAddress.toLowerCase()) as any[]

    return NextResponse.json({
      success: true,
      data: {
        collections: contracts.map((contract: any) => ({
          id: contract.id.toString(),
          address: contract.address,
          name: contract.name || 'Unknown Collection',
          symbol: contract.symbol || 'UNKNOWN',
          contractType: contract.contractType || 'ERC1155',
          chainId: contract.chainId || 1,
          description: contract.description || '',
          websiteUrl: contract.websiteUrl || '',
          twitterUrl: contract.twitterUrl || '',
          discordUrl: contract.discordUrl || '',
          imageUrl: contract.imageUrl || '',
          bannerImageUrl: contract.bannerImageUrl || '',
          isVerified: Boolean(contract.isVerified),
          holderCount: contract.holderCount || 0,
          totalSupply: contract.totalSupply || '0',
          usageCount: contract.usageCount || 0,
          userSnapshots: contract.userSnapshots || 0,
          addedAt: contract.addedAt
        }))
      }
    })

  } catch (error: any) {
    console.error('User contracts fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// POST add contract to favorites
export async function POST(request: NextRequest) {
  try {
    const db = createDatabaseAdapter()
    const user = await requireAuth(request)
    const { contractId, action } = await request.json()

    if (!contractId || !action) {
      return NextResponse.json({
        success: false,
        error: 'Contract ID and action are required'
      }, { status: 400 })
    }

    // Verify contract exists
    const checkContract = db.prepare('SELECT id FROM contracts WHERE id = ?')
    const contract = checkContract.get(contractId) as any

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found'
      }, { status: 404 })
    }

    if (action === 'favorite') {
      // Add to favorites
      const addFavorite = db.prepare(`
        INSERT OR IGNORE INTO user_favorites (user_id, contract_id, favorite_type)
        VALUES (?, ?, 'contract')
      `)

      await addFavorite.run(user.userId, contractId)

      return NextResponse.json({
        success: true,
        message: 'Contract added to favorites'
      })

    } else if (action === 'unfavorite') {
      // Remove from favorites
      const removeFavorite = db.prepare(`
        DELETE FROM user_favorites 
        WHERE user_id = ? AND contract_id = ? AND favorite_type = 'contract'
      `)

      const result = await removeFavorite.run(user.userId, contractId)

      if (result.changes === 0) {
        return NextResponse.json({
          success: false,
          error: 'Contract was not in favorites'
        }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: 'Contract removed from favorites'
      })

    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use "favorite" or "unfavorite"'
      }, { status: 400 })
    }

  } catch (error: any) {
    console.error('User contract action error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}