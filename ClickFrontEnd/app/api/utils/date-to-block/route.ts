import { NextRequest, NextResponse } from 'next/server'
import { createDateToBlockConverter } from '@/lib/utils/date-to-block'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date')
    const block = searchParams.get('block')
    
    if (!date && !block) {
      return NextResponse.json({
        success: false,
        error: 'Either date or block parameter is required'
      }, { status: 400 })
    }

    const converter = createDateToBlockConverter()

    if (date) {
      // Convert date to block
      const targetDate = new Date(date)
      
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json({
          success: false,
          error: 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)'
        }, { status: 400 })
      }

      const blockNumber = await converter.dateToBlock(targetDate)
      const actualDate = await converter.blockToDate(blockNumber)

      return NextResponse.json({
        success: true,
        data: {
          inputDate: date,
          estimatedBlock: blockNumber,
          actualBlockDate: actualDate.toISOString(),
          accuracy: `±12 seconds per block`
        }
      })
    }

    if (block) {
      // Convert block to date
      const blockNumber = parseInt(block)
      
      if (isNaN(blockNumber) || blockNumber < 1) {
        return NextResponse.json({
          success: false,
          error: 'Invalid block number'
        }, { status: 400 })
      }

      const blockDate = await converter.blockToDate(blockNumber)

      return NextResponse.json({
        success: true,
        data: {
          blockNumber,
          blockDate: blockDate.toISOString(),
          blockTimestamp: Math.floor(blockDate.getTime() / 1000)
        }
      })
    }

  } catch (error) {
    console.error('Date to block conversion error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Conversion failed'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { startDate, endDate } = body
    
    if (!startDate || !endDate) {
      return NextResponse.json({
        success: false,
        error: 'Both startDate and endDate are required'
      }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({
        success: false,
        error: 'Invalid date format. Use ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)'
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
    
    // Get actual block dates for accuracy verification
    const [actualStartDate, actualEndDate] = await Promise.all([
      converter.blockToDate(startBlock),
      converter.blockToDate(endBlock)
    ])

    return NextResponse.json({
      success: true,
      data: {
        inputRange: {
          startDate: startDate,
          endDate: endDate
        },
        blockRange: {
          startBlock,
          endBlock,
          totalBlocks: endBlock - startBlock + 1
        },
        actualRange: {
          startDate: actualStartDate.toISOString(),
          endDate: actualEndDate.toISOString()
        },
        estimatedAccuracy: '±12 seconds per block'
      }
    })

  } catch (error) {
    console.error('Date range conversion error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Conversion failed'
    }, { status: 500 })
  }
}