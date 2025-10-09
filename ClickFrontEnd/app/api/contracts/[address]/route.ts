import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isValidEthereumAddress } from '@/lib/auth/middleware'
import { createDatabaseAdapter } from '@/lib/database/adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const db = createDatabaseAdapter()
    const { address } = await params

    // Validate address format
    if (!isValidEthereumAddress(address)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid contract address format'
      }, { status: 400 })
    }

    // Get contract info from database
    const contract = db.prepare(`
      SELECT
        id,
        address,
        name,
        symbol,
        contract_type as contractType,
        chain_id as chainId,
        description,
        website_url as websiteUrl,
        twitter_url as twitterUrl,
        discord_url as discordUrl,
        image_url as imageUrl,
        banner_image_url as bannerImageUrl,
        is_verified as isVerified,
        total_supply as totalSupply,
        deployment_block as deploymentBlock,
        created_at as createdAt,
        updated_at as updatedAt,
        added_by_user_id as addedByUserId
      FROM contracts
      WHERE address = ? COLLATE NOCASE
    `).get(address.toLowerCase()) as any

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found'
      }, { status: 404 })
    }

    // Get basic analytics if available
    let analytics = null
    try {
      const analyticsData = db.prepare(`
        SELECT
          total_holders,
          total_supply,
          analysis_date
        FROM contract_analytics
        WHERE contract_id = ?
        ORDER BY analysis_date DESC
        LIMIT 1
      `).get(contract.id) as any
      
      if (analyticsData) {
        analytics = {
          totalHolders: analyticsData.total_holders,
          totalSupply: analyticsData.total_supply,
          lastAnalysis: analyticsData.analysis_date
        }
      }
    } catch (error: any) {
      // Analytics table might not exist
    }

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id.toString(),
        address: contract.address,
        name: contract.name || 'Unknown Collection',
        symbol: contract.symbol || 'UNKNOWN',
        contractType: contract.contracttype || 'ERC1155',
        chainId: contract.chainid || 1,
        description: contract.description || '',
        websiteUrl: contract.websiteurl || '',
        twitterUrl: contract.twitterurl || '',
        discordUrl: contract.discordurl || '',
        imageUrl: contract.imageurl || '',
        bannerImageUrl: contract.bannerimageurl || '',
        isVerified: Boolean(contract.isverified),
        totalSupply: contract.totalsupply || '0',
        deploymentBlock: contract.deploymentblock,
        createdAt: contract.createdat,
        updatedAt: contract.updatedat,
        addedByUserId: contract.addedbyuserid
      },
      analytics
    })

  } catch (error: any) {
    console.error('Contract fetch error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const db = createDatabaseAdapter()
    const user = await requireAuth(request)
    const { address } = await params

    // Validate address format
    if (!isValidEthereumAddress(address)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid contract address format'
      }, { status: 400 })
    }

    // Get contract info from database
    const contract = db.prepare(`
      SELECT id, added_by_user_id, is_verified
      FROM contracts
      WHERE address = ? COLLATE NOCASE
    `).get(address.toLowerCase()) as any

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found'
      }, { status: 404 })
    }

    // Check if user can edit this contract
    // For now, allow the user who added it or verified contracts can be edited by anyone
    if (contract.added_by_user_id !== user.userId && !contract.is_verified) {
      return NextResponse.json({
        success: false,
        error: 'You do not have permission to edit this contract'
      }, { status: 403 })
    }

    const updates = await request.json()
    const allowedUpdates = [
      'description',
      'websiteUrl', 
      'twitterUrl',
      'discordUrl'
    ]

    // Filter to only allowed updates
    const filteredUpdates: any = {}
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'websiteUrl') filteredUpdates.website_url = updates[field]
        else if (field === 'twitterUrl') filteredUpdates.twitter_url = updates[field]
        else if (field === 'discordUrl') filteredUpdates.discord_url = updates[field]
        else filteredUpdates[field] = updates[field]
      }
    })

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid updates provided'
      }, { status: 400 })
    }

    // Build update query
    const setClause = Object.keys(filteredUpdates).map((key: any) => `${key} = ?`).join(', ')
    const values = Object.values(filteredUpdates)
    values.push(address.toLowerCase())

    const updateQuery = `
      UPDATE contracts 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE address = ? COLLATE NOCASE
    `

    const result = await db.prepare(updateQuery).run(...values)

    if (result.changes === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to update contract'
      }, { status: 500 })
    }

    // Get updated contract
    const updatedContract = db.prepare(`
      SELECT 
        id, address, name, symbol, contract_type as contractType,
        chain_id as chainId, description, website_url as websiteUrl,
        twitter_url as twitterUrl, discord_url as discordUrl,
        is_verified as isVerified, updated_at as updatedAt
      FROM contracts 
      WHERE address = ? COLLATE NOCASE
    `).get(address.toLowerCase()) as any

    return NextResponse.json({
      success: true,
      contract: updatedContract
    })

  } catch (error: any) {
    console.error('Contract update error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}