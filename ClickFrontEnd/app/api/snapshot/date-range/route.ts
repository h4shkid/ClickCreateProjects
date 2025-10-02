import { NextRequest, NextResponse } from 'next/server'
import { SnapshotGenerator } from '@/lib/processing/snapshot-generator'
import { getDatabase } from '@/lib/database/init'
import { createDateToBlockConverter } from '@/lib/utils/date-to-block'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { startDate, endDate, tokenId, comparison = true } = body
    
    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'Both startDate and endDate are required. Use format: YYYY-MM-DD or ISO format'
      }, { status: 400 })
    }

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

    // Initialize database and converter
    const dbManager = getDatabase()
    await dbManager.initialize()
    const converter = createDateToBlockConverter()
    
    // Convert dates to blocks
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

    // Create snapshot generator
    const generator = new SnapshotGenerator()

    // Generate snapshots for both dates
    const [startSnapshot, endSnapshot] = await Promise.all([
      generator.generateHistoricalSnapshot({
        blockNumber: startBlock,
        tokenId: tokenId || undefined
      }),
      generator.generateHistoricalSnapshot({
        blockNumber: endBlock,
        tokenId: tokenId || undefined
      })
    ])

    const startData = startSnapshot[0]
    const endData = endSnapshot[0]

    if (!startData || !endData) {
      return NextResponse.json({
        success: false,
        error: 'No snapshot data found for the specified date range'
      }, { status: 404 })
    }

    // Prepare response data
    const responseData: any = {
      dateRange: {
        requested: { startDate, endDate },
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
          totalSupply: startData.totalSupply,
          uniqueHolders: startData.holderCount,
          topHolders: startData.holders.slice(0, 10) // Top 10 for summary
        },
        end: {
          date: actualEndDate.toISOString(),
          blockNumber: endBlock,
          totalSupply: endData.totalSupply,
          uniqueHolders: endData.holderCount,
          topHolders: endData.holders.slice(0, 10) // Top 10 for summary
        }
      }
    }

    // If comparison requested, calculate changes
    if (comparison) {
      // Create maps for easy lookup
      const startMap = new Map(startData.holders.map(h => [h.holderAddress, h]))
      const endMap = new Map(endData.holders.map(h => [h.holderAddress, h]))
      
      // Find new and removed holders
      const newHolders = endData.holders.filter(h => !startMap.has(h.holderAddress))
      const removedHolders = startData.holders.filter(h => !endMap.has(h.holderAddress))
      
      // Find holders with balance changes
      const balanceChanges = []
      for (const endHolder of endData.holders) {
        const startHolder = startMap.get(endHolder.holderAddress)
        if (startHolder) {
          const startBalance = BigInt(startHolder.balance || 0)
          const endBalance = BigInt(endHolder.balance || 0)
          const change = endBalance - startBalance
          
          if (change !== BigInt(0)) {
            balanceChanges.push({
              holderAddress: endHolder.holderAddress,
              startBalance: startBalance.toString(),
              endBalance: endBalance.toString(),
              change: change.toString(),
              changeType: change > BigInt(0) ? 'increase' : 'decrease'
            })
          }
        }
      }

      responseData.comparison = {
        summary: {
          totalSupplyChange: (BigInt(endData.totalSupply) - BigInt(startData.totalSupply)).toString(),
          holderCountChange: endData.holderCount - startData.holderCount,
          newHolders: newHolders.length,
          removedHolders: removedHolders.length,
          holdersWithBalanceChanges: balanceChanges.length
        },
        changes: {
          newHolders: newHolders.slice(0, 20), // Top 20 new holders
          removedHolders: removedHolders.slice(0, 20), // Top 20 removed holders
          balanceChanges: balanceChanges
            .sort((a, b) => Math.abs(parseInt(b.change)) - Math.abs(parseInt(a.change)))
            .slice(0, 20) // Top 20 biggest balance changes
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('Date range snapshot error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate date range snapshot'
    }, { status: 500 })
  }
}