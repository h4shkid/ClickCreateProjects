import { NextRequest, NextResponse } from 'next/server'
import { createDatabaseAdapter } from '@/lib/database/adapter'
import { createDateToBlockConverter } from '@/lib/utils/date-to-block'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const db = createDatabaseAdapter()
    const { address } = await params
    const { searchParams } = new URL(request.url)
    
    const blockNumber = searchParams.get('blockNumber')
    const date = searchParams.get('date')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const timestamp = searchParams.get('timestamp') // Keep for backward compatibility
    const tokenId = searchParams.get('tokenId')
    const tokenIds = searchParams.get('tokenIds')
    const exactMatch = searchParams.get('exactMatch') === 'true'

    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    if (!blockNumber && !date && !timestamp && !startDate && !endDate) {
      return NextResponse.json({
        success: false,
        error: 'Either blockNumber, date, startDate/endDate, or timestamp is required. Use date parameters for user-friendly date input (YYYY-MM-DD or ISO format)'
      }, { status: 400 })
    }

    // Check for date range parameters
    if (startDate && !endDate) {
      return NextResponse.json({
        success: false,
        error: 'endDate is required when startDate is provided'
      }, { status: 400 })
    }

    if (endDate && !startDate) {
      return NextResponse.json({
        success: false,
        error: 'startDate is required when endDate is provided'
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

    // Handle date range mode (startDate + endDate)
    if (startDate && endDate) {
      try {
        const start = new Date(startDate)
        const end = new Date(endDate)
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return NextResponse.json({
            success: false,
            error: 'Invalid date format. Use YYYY-MM-DD or ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)'
          }, { status: 400 })
        }

        if (start >= end) {
          return NextResponse.json({
            success: false,
            error: 'Start date must be before end date'
          }, { status: 400 })
        }

        const converter = createDateToBlockConverter()
        const { startBlock, endBlock } = await converter.dateRangeToBlocks(start, end)
        
        // Get actual block dates for accuracy
        const [actualStartDate, actualEndDate] = await Promise.all([
          converter.blockToDate(startBlock),
          converter.blockToDate(endBlock)
        ])

        console.log(`📅 Date range snapshot:`)
        console.log(`   Requested: ${startDate} to ${endDate}`)
        console.log(`   Blocks: ${startBlock} to ${endBlock}`)
        console.log(`   Actual: ${actualStartDate.toISOString()} to ${actualEndDate.toISOString()}`)

        // Generate comparison between start and end dates
        return await generateDateRangeSnapshot(address, startBlock, endBlock, actualStartDate, actualEndDate, { startDate, endDate })

      } catch (error: any) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to process date range'
        }, { status: 400 })
      }
    }

    // Convert single date/timestamp to block number if needed
    let targetBlock = blockNumber ? parseInt(blockNumber) : null
    let actualDate: Date | undefined
    
    if (!targetBlock && (date || timestamp)) {
      try {
        if (date) {
          // Modern date parameter - more user friendly
          const targetDate = new Date(date)
          if (isNaN(targetDate.getTime())) {
            return NextResponse.json({
              success: false,
              error: 'Invalid date format. Use YYYY-MM-DD or ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)'
            }, { status: 400 })
          }
          
          targetBlock = await createDateToBlockConverter().dateToBlock(targetDate)
          actualDate = await createDateToBlockConverter().blockToDate(targetBlock)
          console.log(`📅 Converted date ${date} to block ${targetBlock} (actual: ${actualDate.toISOString()})`)
          
        } else if (timestamp) {
          // Legacy timestamp support
          const targetDate = new Date(timestamp)
          if (isNaN(targetDate.getTime())) {
            return NextResponse.json({
              success: false,
              error: 'Invalid timestamp format'
            }, { status: 400 })
          }
          
          targetBlock = await createDateToBlockConverter().dateToBlock(targetDate)
          actualDate = await createDateToBlockConverter().blockToDate(targetBlock)
        }
      } catch (error: any) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to convert date to block number'
        }, { status: 400 })
      }
    }

    if (!targetBlock) {
      return NextResponse.json({
        success: false,
        error: 'Invalid block number, date, or timestamp'
      }, { status: 400 })
    }

    // Parse token IDs if provided
    const tokenIdList: string[] = []
    if (tokenId) {
      tokenIdList.push(tokenId)
    } else if (tokenIds) {
      tokenIdList.push(...tokenIds.split(',').map(id => id.trim()))
    }

    console.log(`🎯 Token filtering: ${tokenIdList.length > 0 ? `${tokenIdList.length} tokens, exactMatch=${exactMatch}` : 'all tokens'}`)

    // Query real historical blockchain data by reconstructing state at the specified block
    let holders: any[] = []
    let hasRealData = false

    try {
      // Use optimized single-query approach to calculate all balances at once
      let balanceQuery: string
      let balanceParams: any[]

      if (tokenIdList.length > 0) {
        // Calculate balances for specific tokens only
        const placeholders = tokenIdList.map(() => '?').join(', ')
        balanceQuery = `
          SELECT
            holder_address,
            SUM(balance) as balance
          FROM (
            SELECT
              to_address as holder_address,
              COUNT(*) as balance
            FROM events
            WHERE contract_address = ? COLLATE NOCASE
            AND block_number <= ?
            AND token_id IN (${placeholders})
            AND to_address != '0x0000000000000000000000000000000000000000'
            GROUP BY to_address

            UNION ALL

            SELECT
              from_address as holder_address,
              -COUNT(*) as balance
            FROM events
            WHERE contract_address = ? COLLATE NOCASE
            AND block_number <= ?
            AND token_id IN (${placeholders})
            AND from_address != '0x0000000000000000000000000000000000000000'
            GROUP BY from_address
          )
          GROUP BY holder_address
          HAVING SUM(balance) > 0
          ORDER BY SUM(balance) DESC
        `
        balanceParams = [
          address.toLowerCase(),
          targetBlock,
          ...tokenIdList,
          address.toLowerCase(),
          targetBlock,
          ...tokenIdList
        ]
      } else {
        // Calculate balances for all tokens
        balanceQuery = `
          SELECT
            holder_address,
            SUM(balance) as balance
          FROM (
            SELECT
              to_address as holder_address,
              COUNT(*) as balance
            FROM events
            WHERE contract_address = ? COLLATE NOCASE
            AND block_number <= ?
            AND to_address != '0x0000000000000000000000000000000000000000'
            GROUP BY to_address

            UNION ALL

            SELECT
              from_address as holder_address,
              -COUNT(*) as balance
            FROM events
            WHERE contract_address = ? COLLATE NOCASE
            AND block_number <= ?
            AND from_address != '0x0000000000000000000000000000000000000000'
            GROUP BY from_address
          )
          GROUP BY holder_address
          HAVING SUM(balance) > 0
          ORDER BY SUM(balance) DESC
        `
        balanceParams = [
          address.toLowerCase(),
          targetBlock,
          address.toLowerCase(),
          targetBlock
        ]
      }

      const holderBalances = db.prepare(balanceQuery).all(...balanceParams) as any

      if (holderBalances && holderBalances.length > 0) {
        hasRealData = true

        // Convert to holder format
        holders = holderBalances.map((row: any) => ({
          holderAddress: row.holder_address,
          balance: row.balance.toString(),
          percentage: 0, // Will calculate after filtering
          rank: 0 // Will set after sorting
        }))

        // Apply exact match filtering if requested
        if (exactMatch && tokenIdList.length > 0) {
          // Filter holders to only those who have EXACTLY the requested tokens (no more, no less)
          holders = holders.filter(holder => {
            const balance = parseInt(holder.balance)
            return balance === tokenIdList.length
          })
          console.log(`✅ Exact match: ${holders.length} holders with exactly ${tokenIdList.length} tokens`)
        } else if (!exactMatch && tokenIdList.length > 0) {
          // For non-exact match, include anyone with at least 1 of the requested tokens (already filtered by query)
          console.log(`✅ Any match: ${holders.length} holders with at least one of the ${tokenIdList.length} tokens`)
        }

        // Sort by balance descending and calculate percentages
        holders.sort((a, b) => parseInt(b.balance) - parseInt(a.balance))
        const totalSupply = holders.reduce((sum: number, h) => sum + parseInt(h.balance), 0)

        holders = holders.map((holder: any, index: number) => ({
          ...holder,
          percentage: totalSupply > 0 ? (parseInt(holder.balance) / totalSupply) * 100 : 0,
          rank: index + 1
        }))
      }
      
    } catch (error: any) {
      console.error('Error fetching historical data:', error)
      hasRealData = false
    }
    
    // If no real data available, return error instead of mock data
    if (!hasRealData) {
      return NextResponse.json({
        success: false,
        error: 'No blockchain data available for this contract at the specified block. Please sync blockchain data first.'
      }, { status: 404 })
    }

    const totalSupply = holders.reduce((sum: number, h) => sum + parseInt(h.balance), 0)

    console.log(`✅ Snapshot generated for block ${targetBlock}: ${holders.length} holders, ${totalSupply} total supply`)

    const response = {
      snapshot: holders,
      metadata: {
        tokenId: tokenId || 'multiple',
        contractAddress: address.toLowerCase(),
        contractName: contract.name,
        totalSupply: totalSupply.toString(),
        uniqueHolders: holders.length,
        timestamp: new Date().toISOString(),
        isDemo: false,
        blockNumber: targetBlock,
        blockDate: actualDate ? actualDate.toISOString() : new Date().toISOString(),
        dateConversion: actualDate ? {
          requestedDate: date || timestamp,
          actualBlockDate: actualDate.toISOString(),
          accuracy: '±12 seconds per block'
        } : undefined
      },
      totalHolders: holders.length,
      blockNumber: targetBlock,
      syncStatus: {
        isSynced: true,
        lastSyncedBlock: targetBlock,
        status: 'synced',
        hasRealData: true
      }
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error: any) {
    console.error('Historical snapshot error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// Helper function to generate date range snapshot comparison
async function generateDateRangeSnapshot(
  address: string,
  startBlock: number,
  endBlock: number,
  actualStartDate: Date,
  actualEndDate: Date,
  requestedDates: { startDate: string, endDate: string }
) {
  const db = createDatabaseAdapter()

  // Generate snapshots for both start and end dates
  const [startHolders, endHolders] = await Promise.all([
    generateSnapshotAtBlock(db, address, startBlock),
    generateSnapshotAtBlock(db, address, endBlock)
  ])

  // Create maps for comparison
  const startMap = new Map(startHolders.map((h: any) => [h.holderAddress, h]))
  const endMap = new Map(endHolders.map((h: any) => [h.holderAddress, h]))
  
  // Find new and removed holders
  const newHolders = endHolders.filter(h => !startMap.has(h.holderAddress))
  const removedHolders = startHolders.filter(h => !endMap.has(h.holderAddress))
  
  // Find holders with balance changes
  const balanceChanges = []
  for (const endHolder of endHolders) {
    const startHolder = startMap.get(endHolder.holderAddress)
    if (startHolder) {
      const startBalance = parseInt(startHolder.balance)
      const endBalance = parseInt(endHolder.balance)
      const change = endBalance - startBalance
      
      if (change !== 0) {
        balanceChanges.push({
          holderAddress: endHolder.holderAddress,
          startBalance: startBalance.toString(),
          endBalance: endBalance.toString(),
          change: change.toString(),
          changeType: change > 0 ? 'increase' : 'decrease'
        })
      }
    }
  }

  const startTotalSupply = startHolders.reduce((sum: number, h) => sum + parseInt(h.balance), 0)
  const endTotalSupply = endHolders.reduce((sum: number, h) => sum + parseInt(h.balance), 0)

  return NextResponse.json({
    success: true,
    data: {
      dateRange: {
        requested: requestedDates,
        actual: {
          startDate: actualStartDate.toISOString(),
          endDate: actualEndDate.toISOString()
        },
        blocks: { startBlock, endBlock },
        accuracy: '±12 seconds per block'
      },
      snapshots: {
        start: {
          date: actualStartDate.toISOString(),
          blockNumber: startBlock,
          totalSupply: startTotalSupply.toString(),
          uniqueHolders: startHolders.length,
          holders: startHolders.slice(0, 50) // Top 50 for display
        },
        end: {
          date: actualEndDate.toISOString(), 
          blockNumber: endBlock,
          totalSupply: endTotalSupply.toString(),
          uniqueHolders: endHolders.length,
          holders: endHolders.slice(0, 50) // Top 50 for display
        }
      },
      comparison: {
        summary: {
          totalSupplyChange: (endTotalSupply - startTotalSupply).toString(),
          holderCountChange: endHolders.length - startHolders.length,
          newHolders: newHolders.length,
          removedHolders: removedHolders.length,
          holdersWithBalanceChanges: balanceChanges.length
        },
        changes: {
          newHolders: newHolders.slice(0, 20),
          removedHolders: removedHolders.slice(0, 20),
          balanceChanges: balanceChanges
            .sort((a, b) => Math.abs(parseInt(b.change)) - Math.abs(parseInt(a.change)))
            .slice(0, 20)
        }
      }
    }
  })
}

// Helper function to generate snapshot at specific block
async function generateSnapshotAtBlock(db: any, address: string, blockNumber: number) {
  // Get all unique holders up to the specified block
  const eventsQuery = `
    SELECT DISTINCT to_address as holder_address
    FROM events 
    WHERE contract_address = ? COLLATE NOCASE
    AND block_number <= ?
    AND to_address != '0x0000000000000000000000000000000000000000'
  `
  
  const holderAddresses = db.prepare(eventsQuery).all(address.toLowerCase(), blockNumber) as any
  const holders = []
  
  // Calculate balance for each holder at the specified block
  for (const holderData of holderAddresses) {
    const holderAddress = holderData.holder_address
    
    // Count tokens received minus tokens sent up to the block number
    const balanceQuery = `
      SELECT 
        COALESCE(received.count, 0) - COALESCE(sent.count, 0) as balance
      FROM (
        SELECT COUNT(*) as count 
        FROM events 
        WHERE contract_address = ? COLLATE NOCASE 
        AND to_address = ? COLLATE NOCASE
        AND block_number <= ?
      ) received
      LEFT JOIN (
        SELECT COUNT(*) as count 
        FROM events 
        WHERE contract_address = ? COLLATE NOCASE 
        AND from_address = ? COLLATE NOCASE
        AND from_address != '0x0000000000000000000000000000000000000000'
        AND block_number <= ?
      ) sent ON 1=1
    `
    
    const balance = db.prepare(balanceQuery).get(
      address.toLowerCase(),
      holderAddress,
      blockNumber,
      address.toLowerCase(),
      holderAddress,
      blockNumber
    ) as any

    if (balance && balance.balance > 0) {
      holders.push({
        holderAddress: holderAddress,
        balance: balance.balance.toString(),
        percentage: 0, // Will calculate after we have all holders
        rank: 0 // Will set after sorting
      })
    }
  }
  
  // Sort by balance descending and calculate percentages
  holders.sort((a, b) => parseInt(b.balance) - parseInt(a.balance))
  const totalSupply = holders.reduce((sum: number, h) => sum + parseInt(h.balance), 0)
  
  return holders.map((holder: any, index: number) => ({
    ...holder,
    percentage: totalSupply > 0 ? (parseInt(holder.balance) / totalSupply) * 100 : 0,
    rank: index + 1
  }))
}