import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const db = createDatabaseAdapter()
    const { address } = await params
    const { searchParams } = new URL(request.url)
    
    const tokenId = searchParams.get('tokenId')
    const tokenIds = searchParams.get('tokenIds')
    const exactMatch = searchParams.get('exactMatch') === 'true'
    const fullSeason = searchParams.get('fullSeason') === 'true'
    const season = searchParams.get('season')
    const limit = parseInt(searchParams.get('limit') || '50') // Default to 50 for UI, but allow unlimited for exports

    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    // Get contract from database
    const contract = db.prepare(`
      SELECT id, name, symbol, contract_type FROM contracts 
      WHERE address = ? COLLATE NOCASE
    `).get(address.toLowerCase()) as any

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found'
      }, { status: 404 })
    }

    // Check if we have real blockchain data for this contract
    let hasRealData = false
    let holders: any[] = []
    
    // Build token filter based on request parameters
    let tokenFilter = ''
    let tokenParams: string[] = []
    
    try {
      
      if (fullSeason && season) {
        // Handle full season mode - COMPLETE holders only (must own ALL tokens in season)
        const { getSeasonGroup } = await import('@/lib/constants/season-tokens')
        const seasonGroup = getSeasonGroup(season)
        if (seasonGroup) {
          console.log(`🎯 Full season mode: ${season} - finding COMPLETE holders (must own all ${seasonGroup.tokenIds.length} tokens)`)
          
          // For complete season holders, we need a different approach
          // We'll modify the main query to find addresses that own ALL tokens in the season
          const placeholders = seasonGroup.tokenIds.map(() => '?').join(',')
          tokenFilter = `AND token_id IN (${placeholders})`
          tokenParams = seasonGroup.tokenIds
          
          console.log(`🎯 Checking for complete ownership of tokens: ${seasonGroup.tokenIds.slice(0, 5).join(',')}${seasonGroup.tokenIds.length > 5 ? '...' : ''}`)
        }
      } else if (tokenIds) {
        // Handle specific token IDs
        const tokenIdList = tokenIds.split(',').map(id => id.trim()).filter(id => id)
        if (tokenIdList.length > 0) {
          const placeholders = tokenIdList.map(() => '?').join(',')
          tokenFilter = `AND token_id IN (${placeholders})`
          tokenParams = tokenIdList
          console.log(`🎯 Token filter: ${tokenIdList.length} specific tokens`)
        }
      } else if (tokenId) {
        // Handle single token ID
        tokenFilter = `AND token_id = ?`
        tokenParams = [tokenId]
        console.log(`🎯 Single token filter: ${tokenId}`)
      }

      // Try to get real holder data from current_state table
      let query: string = ''
      if (fullSeason && season) {
        // For full season mode: find addresses that own ALL tokens in the season
        const { getSeasonGroup } = await import('@/lib/constants/season-tokens')
        const seasonGroup = getSeasonGroup(season)
        
        if (seasonGroup) {
          const expectedTokenCount = seasonGroup.tokenIds.length
          const placeholders = seasonGroup.tokenIds.map(() => '?').join(',')
          
          query = `
            SELECT
              address as holder_address,
              SUM(CAST(balance AS INTEGER)) as balance,
              COUNT(DISTINCT token_id) as owned_tokens
            FROM current_state
            WHERE contract_address = ? COLLATE NOCASE
            AND token_id IN (${placeholders})
            AND CAST(balance AS INTEGER) > 0
            GROUP BY address
            HAVING COUNT(DISTINCT token_id) = ?
            ORDER BY balance DESC
            ${limit > 0 ? `LIMIT ${limit}` : ''}
          `
          
          console.log(`🎯 Complete season query: must own all ${expectedTokenCount} tokens`)
        }
      } else {
        // Regular query for partial ownership
        query = `
          SELECT
            address as holder_address,
            SUM(CAST(balance AS INTEGER)) as balance
          FROM current_state
          WHERE contract_address = ? COLLATE NOCASE
          ${tokenFilter}
          GROUP BY address
          HAVING SUM(CAST(balance AS INTEGER)) > 0
          ORDER BY balance DESC
          ${limit > 0 ? `LIMIT ${limit}` : ''}
        `
      }
      
      console.log(`🔍 SQL Query: ${query.replace(tokenFilter, tokenFilter ? `AND token_id IN (${tokenParams.slice(0, 3).join(',')}${tokenParams.length > 3 ? '...' : ''})` : '')}`)
      console.log(`🔢 Parameters: address=${address.toLowerCase()}, tokenParams=${tokenParams.length} items`)
      
      let realHolders
      try {
        if (fullSeason && season) {
          // For full season queries, use season token IDs + expected count
          const { getSeasonGroup } = await import('@/lib/constants/season-tokens')
          const seasonGroup = getSeasonGroup(season)
          if (seasonGroup) {
            const queryParams = [address.toLowerCase(), ...seasonGroup.tokenIds, seasonGroup.tokenIds.length]
            console.log(`🔍 Full season query params:`, queryParams)
            realHolders = db.prepare(query).all(...queryParams) as any
            console.log(`📊 Full season query returned ${realHolders ? realHolders.length : 0} holders`)
          }
        } else {
          // Regular query
          realHolders = db.prepare(query).all(address.toLowerCase(), ...tokenParams) as any
        }
      } catch (sqlError: any) {
        console.error('🚫 SQL Error:', (sqlError as any)?.message || sqlError)
        console.error('🚫 Query:', query)
        console.error('🚫 Token filter:', tokenFilter)
        console.error('🚫 Token params:', tokenParams)
        throw new Error(`Database query failed: ${(sqlError as any)?.message || 'Unknown error'}`)
      }
      
      if (realHolders) {
        hasRealData = true
        
        if (realHolders.length > 0) {
          // Get total supply and total holders count from database
        let totalStatsQuery: string = ''
        let totalStatsParams: any[] = []
        
        if (fullSeason && season) {
          // For full season mode: count only complete holders
          const { getSeasonGroup } = await import('@/lib/constants/season-tokens')
          const seasonGroup = getSeasonGroup(season)
          
          if (seasonGroup) {
            const expectedTokenCount = seasonGroup.tokenIds.length
            const placeholders = seasonGroup.tokenIds.map(() => '?').join(',')
            
            totalStatsQuery = `
              SELECT
                COUNT(DISTINCT address) as total_holders,
                SUM(balance_sum) as total_supply
              FROM (
                SELECT address, SUM(CAST(balance AS INTEGER)) as balance_sum
                FROM current_state
                WHERE contract_address = ? COLLATE NOCASE
                AND token_id IN (${placeholders})
                AND CAST(balance AS INTEGER) > 0
                GROUP BY address
                HAVING COUNT(DISTINCT token_id) = ?
              ) AS subquery
            `
            totalStatsParams = [address.toLowerCase(), ...seasonGroup.tokenIds, expectedTokenCount]
          }
        } else {
          // Regular stats query
          totalStatsQuery = `
            SELECT
              COUNT(DISTINCT address) as total_holders,
              SUM(balance_sum) as total_supply
            FROM (
              SELECT address, SUM(CAST(balance AS INTEGER)) as balance_sum
              FROM current_state
              WHERE contract_address = ? COLLATE NOCASE
              ${tokenFilter || ''}
              GROUP BY address
              HAVING SUM(CAST(balance AS INTEGER)) > 0
            ) AS subquery
          `
          totalStatsParams = [address.toLowerCase(), ...tokenParams]
        }
        
        const totalStatsResult = await db.prepare(totalStatsQuery).all(...totalStatsParams)
        const totalStats = totalStatsResult[0] as any

        const totalSupply = totalStats?.total_supply || realHolders.reduce((sum: number, h: any) => sum + parseInt(h.balance), 0)
        
          holders = realHolders.map((holder: any, index: number) => ({
            holderAddress: holder.holder_address,
            balance: holder.balance,
            percentage: totalSupply > 0 ? (parseInt(holder.balance) / totalSupply) * 100 : 0,
            rank: index + 1
          }))
        }
      }
    } catch (error: any) {
      console.log('No real blockchain data found, using demo data')
    }

    // If no real data available, return error instead of mock data
    if (!hasRealData) {
      return NextResponse.json({
        success: false,
        error: 'No blockchain data available for this contract. Please sync blockchain data first.'
      }, { status: 404 })
    }

    // Get real statistics for metadata
    let totalSupply = 0
    let totalHolders = 0
    let realBlockNumber = 0
    
    if (hasRealData) {
      // Get total stats from database
      let totalStatsQuery: string = ''
      let totalStatsParams: any[] = []

      if (fullSeason && season) {
        // For full season mode: count only complete holders
        const { getSeasonGroup } = await import('@/lib/constants/season-tokens')
        const seasonGroup = getSeasonGroup(season)

        if (seasonGroup) {
          const expectedTokenCount = seasonGroup.tokenIds.length
          const placeholders = seasonGroup.tokenIds.map(() => '?').join(',')

          totalStatsQuery = `
            SELECT
              COUNT(DISTINCT address) as total_holders,
              SUM(balance_sum) as total_supply
            FROM (
              SELECT address, SUM(CAST(balance AS INTEGER)) as balance_sum
              FROM current_state
              WHERE contract_address = ? COLLATE NOCASE
              AND token_id IN (${placeholders})
              AND CAST(balance AS INTEGER) > 0
              GROUP BY address
              HAVING COUNT(DISTINCT token_id) = ?
            ) AS subquery
          `
          totalStatsParams = [address.toLowerCase(), ...seasonGroup.tokenIds, expectedTokenCount]
        }
      } else {
        // Regular stats query
        totalStatsQuery = `
          SELECT
            COUNT(DISTINCT address) as total_holders,
            SUM(balance_sum) as total_supply
          FROM (
            SELECT address, SUM(CAST(balance AS INTEGER)) as balance_sum
            FROM current_state
            WHERE contract_address = ? COLLATE NOCASE
            ${tokenFilter}
            GROUP BY address
            HAVING SUM(CAST(balance AS INTEGER)) > 0
          ) AS subquery
        `
        totalStatsParams = [address.toLowerCase(), ...tokenParams]
      }

      const totalStatsResult = totalStatsQuery ? await db.prepare(totalStatsQuery).all(...totalStatsParams) : null
      const totalStats = totalStatsResult ? totalStatsResult[0] as any : null

      // Get the latest block number from sync status
      const syncStatus = db.prepare(`
        SELECT current_block, end_block
        FROM contract_sync_status 
        WHERE contract_id = (
          SELECT id FROM contracts 
          WHERE address = ? COLLATE NOCASE
        )
        ORDER BY created_at DESC 
        LIMIT 1
      `).get(address.toLowerCase()) as any
      
      totalSupply = totalStats?.total_supply || 0
      totalHolders = totalStats?.total_holders || 0
      realBlockNumber = syncStatus?.current_block || syncStatus?.end_block || 0
    } else {
      totalSupply = holders.reduce((sum: number, h) => sum + parseInt(h.balance), 0)
      totalHolders = holders.length
    }

    const response = {
      snapshot: holders,
      metadata: {
        tokenId: tokenId || 'multiple',
        contractAddress: address.toLowerCase(),
        contractName: contract.name,
        totalSupply: totalSupply.toString(),
        uniqueHolders: holders.length, // Top 50 shown
        timestamp: new Date().toISOString(),
        isDemo: false, // Always false since we only reach here with real data
        demoNotice: undefined // No demo notice for real data
      },
      totalHolders: totalHolders, // Total unique holders
      blockNumber: realBlockNumber, // Real block number
      syncStatus: {
        isSynced: true,
        lastSyncedBlock: realBlockNumber,
        status: 'synced',
        hasRealData: true
      }
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error: any) {
    console.error('Current snapshot error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}