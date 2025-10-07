import { NextRequest, NextResponse } from 'next/server'
import DataValidator from '@/lib/validation/data-validator'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  let validator: DataValidator | null = null
  
  try {
    const { address } = await params
    const { searchParams } = new URL(request.url)
    
    const blockNumber = searchParams.get('blockNumber')
    const validationType = searchParams.get('type') || 'full' // full, balance, blocks, snapshot
    const startBlock = searchParams.get('startBlock')
    const endBlock = searchParams.get('endBlock')

    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    console.log(`🔍 Running validation for contract ${address}, type: ${validationType}`)

    validator = new DataValidator()
    let validationResult

    switch (validationType) {
      case 'balance':
        validationResult = await validator.validateHolderBalances(
          address, 
          blockNumber ? parseInt(blockNumber) : undefined
        )
        break
        
      case 'blocks':
        if (!startBlock || !endBlock) {
          return NextResponse.json({
            success: false,
            error: 'startBlock and endBlock are required for block validation'
          }, { status: 400 })
        }
        validationResult = await validator.validateBlockRange(
          address,
          parseInt(startBlock),
          parseInt(endBlock)
        )
        break
        
      case 'snapshot':
        if (!blockNumber) {
          return NextResponse.json({
            success: false,
            error: 'blockNumber is required for snapshot validation'
          }, { status: 400 })
        }
        // First get the snapshot data to validate
        const snapshotResponse = await fetch(
          `${request.nextUrl.origin}/api/contracts/${address}/snapshot/historical?blockNumber=${blockNumber}`
        )
        const snapshotData = await snapshotResponse.json()
        
        if (!snapshotData.success) {
          return NextResponse.json({
            success: false,
            error: 'Failed to fetch snapshot data for validation'
          }, { status: 400 })
        }

        validationResult = await validator.validateSnapshotAccuracy(
          address,
          parseInt(blockNumber),
          snapshotData.data
        )
        break
        
      case 'full':
      default:
        validationResult = await validator.generateValidationReport(
          address,
          blockNumber ? parseInt(blockNumber) : undefined
        )
        break
    }

    return NextResponse.json({
      success: true,
      data: {
        contractAddress: address,
        validationType,
        timestamp: new Date().toISOString(),
        validation: validationResult
      }
    })

  } catch (error: any) {
    console.error('Validation API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    }, { status: 500 })
  } finally {
    // Clean up validator connection
    if (validator) {
      validator.close()
    }
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  let validator: DataValidator | null = null
  
  try {
    const { address } = await params
    const body = await request.json()
    
    const { snapshotData, csvData } = body

    if (!snapshotData || !csvData) {
      return NextResponse.json({
        success: false,
        error: 'Both snapshotData and csvData are required for CSV validation'
      }, { status: 400 })
    }

    console.log(`📊 Validating CSV export for contract ${address}`)

    validator = new DataValidator()
    const validationResult = validator.validateCSVExport(snapshotData, csvData)

    return NextResponse.json({
      success: true,
      data: {
        contractAddress: address,
        timestamp: new Date().toISOString(),
        validation: validationResult
      }
    })

  } catch (error: any) {
    console.error('CSV validation API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'CSV validation failed'
    }, { status: 500 })
  } finally {
    if (validator) {
      validator.close()
    }
  }
}