/**
 * Advanced Snapshot API
 * Unified endpoint for all snapshot queries using hybrid strategy and query builder
 */

import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'
import { HybridSnapshotGenerator } from '@/lib/blockchain/hybrid-snapshot-generator'
import { AdvancedQueryBuilder, SnapshotQuery } from '@/lib/processing/advanced-query-builder'
import { getPreset, buildQueryFromPreset } from '@/lib/processing/snapshot-presets'

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
db.pragma('journal_mode = WAL')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    const { searchParams } = new URL(request.url)

    console.log('🎯 Advanced Snapshot API Request')
    console.log('Contract:', address)

    // Check if using preset
    const presetId = searchParams.get('preset')
    if (presetId) {
      return handlePresetQuery(address, searchParams)
    }

    // Check if using query builder
    const queryMode = searchParams.get('queryMode')
    if (queryMode) {
      return handleQueryBuilder(address, searchParams)
    }

    // Fallback to simple hybrid snapshot
    return handleSimpleHybrid(address, searchParams)

  } catch (error) {
    console.error('❌ Advanced snapshot error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

/**
 * Handle preset-based query
 */
async function handlePresetQuery(
  contractAddress: string,
  searchParams: URLSearchParams
): Promise<NextResponse> {
  const presetId = searchParams.get('preset')!
  const tokenIds = searchParams.get('tokenIds')?.split(',').filter(Boolean)
  const date = searchParams.get('date')
  const minBalance = searchParams.get('minBalance')
  const minTokenCount = searchParams.get('minTokenCount')

  console.log(`📋 Using preset: ${presetId}`)

  // Get preset
  const preset = getPreset(presetId)
  if (!preset) {
    return NextResponse.json({
      success: false,
      error: `Preset not found: ${presetId}`
    }, { status: 404 })
  }

  // Build query from preset
  const query = buildQueryFromPreset(preset, contractAddress, {
    tokenIds,
    date: date || undefined,
    customFilters: {
      minBalance: minBalance ? parseInt(minBalance) : undefined,
      minTokenCount: minTokenCount ? parseInt(minTokenCount) : undefined
    }
  })

  console.log('📊 Built query from preset:', JSON.stringify(query, null, 2))

  // Execute query
  const queryBuilder = new AdvancedQueryBuilder()
  const result = await queryBuilder.executeQuery(query)

  return NextResponse.json({
    success: true,
    data: {
      preset: {
        id: preset.id,
        name: preset.name,
        description: preset.description,
        category: preset.category
      },
      holders: result.holders,
      metadata: result.metadata
    }
  })
}

/**
 * Handle advanced query builder
 */
async function handleQueryBuilder(
  contractAddress: string,
  searchParams: URLSearchParams
): Promise<NextResponse> {
  console.log('🔧 Using advanced query builder')

  // Parse query parameters into SnapshotQuery
  const query: SnapshotQuery = {
    contractAddress,
    tokenSelection: {
      mode: (searchParams.get('tokenMode') as any) || 'all',
      tokenIds: searchParams.get('tokenIds')?.split(',').filter(Boolean),
      range: searchParams.get('rangeStart') && searchParams.get('rangeEnd') ? {
        start: parseInt(searchParams.get('rangeStart')!),
        end: parseInt(searchParams.get('rangeEnd')!)
      } : undefined,
      excludeTokens: searchParams.get('excludeTokens')?.split(',').filter(Boolean)
    },
    holderFilters: {
      minBalance: searchParams.get('minBalance') ? parseInt(searchParams.get('minBalance')!) : undefined,
      maxBalance: searchParams.get('maxBalance') ? parseInt(searchParams.get('maxBalance')!) : undefined,
      minTokenCount: searchParams.get('minTokenCount') ? parseInt(searchParams.get('minTokenCount')!) : undefined,
      maxTokenCount: searchParams.get('maxTokenCount') ? parseInt(searchParams.get('maxTokenCount')!) : undefined,
      hasCompleteSets: searchParams.get('hasCompleteSets') === 'true',
      minSetsCount: searchParams.get('minSetsCount') ? parseInt(searchParams.get('minSetsCount')!) : undefined
    },
    sortBy: (searchParams.get('sortBy') as any) || 'balance',
    sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined
  }

  console.log('📊 Advanced query:', JSON.stringify(query, null, 2))

  // Validate query
  const queryBuilder = new AdvancedQueryBuilder()
  const validation = queryBuilder.validateQuery(query)

  if (!validation.valid) {
    return NextResponse.json({
      success: false,
      errors: validation.errors
    }, { status: 400 })
  }

  // Execute query
  const result = await queryBuilder.executeQuery(query)

  return NextResponse.json({
    success: true,
    data: result
  })
}

/**
 * Handle simple hybrid snapshot (backward compatible)
 */
async function handleSimpleHybrid(
  contractAddress: string,
  searchParams: URLSearchParams
): Promise<NextResponse> {
  console.log('⚡ Using simple hybrid strategy')

  // Get contract info
  const contract = db.prepare(`
    SELECT contract_type FROM contracts
    WHERE address = ? COLLATE NOCASE
  `).get(contractAddress.toLowerCase()) as any

  if (!contract) {
    return NextResponse.json({
      success: false,
      error: 'Contract not found'
    }, { status: 404 })
  }

  // Parse parameters
  const tokenIds = searchParams.get('tokenIds')?.split(',').filter(Boolean)
  const tokenId = searchParams.get('tokenId')
  const blockNumber = searchParams.get('blockNumber') ? parseInt(searchParams.get('blockNumber')!) : undefined
  const quickSyncBlocks = searchParams.get('quickSyncBlocks') ? parseInt(searchParams.get('quickSyncBlocks')!) : 100

  // Generate hybrid snapshot
  const generator = new HybridSnapshotGenerator()
  const result = await generator.generateSnapshot({
    contractAddress,
    contractType: contract.contract_type,
    tokenIds: tokenIds || (tokenId ? [tokenId] : undefined),
    blockNumber,
    quickSyncBlocks
  })

  return NextResponse.json({
    success: true,
    data: {
      holders: result.holders,
      metadata: result.metadata,
      pagination: {
        total: result.holders.length,
        limit: result.holders.length,
        offset: 0,
        hasMore: false
      }
    }
  })
}

/**
 * POST endpoint for complex queries with body
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params
    const body = await request.json()

    console.log('🎯 Advanced Snapshot POST Request')
    console.log('Contract:', address)
    console.log('Body:', JSON.stringify(body, null, 2))

    // Check if using preset
    if (body.presetId) {
      const preset = getPreset(body.presetId)
      if (!preset) {
        return NextResponse.json({
          success: false,
          error: `Preset not found: ${body.presetId}`
        }, { status: 404 })
      }

      const query = buildQueryFromPreset(preset, address, {
        tokenIds: body.tokenIds,
        date: body.date || undefined,
        blockNumber: body.blockNumber,
        customFilters: body.customFilters
      })

      const queryBuilder = new AdvancedQueryBuilder()
      const result = await queryBuilder.executeQuery(query)

      return NextResponse.json({
        success: true,
        data: {
          preset: {
            id: preset.id,
            name: preset.name,
            description: preset.description
          },
          ...result
        }
      })
    }

    // Direct query object
    if (body.query) {
      const query: SnapshotQuery = {
        ...body.query,
        contractAddress: address
      }

      const queryBuilder = new AdvancedQueryBuilder()
      const validation = queryBuilder.validateQuery(query)

      if (!validation.valid) {
        return NextResponse.json({
          success: false,
          errors: validation.errors
        }, { status: 400 })
      }

      const result = await queryBuilder.executeQuery(query)

      return NextResponse.json({
        success: true,
        data: result
      })
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request body. Provide either presetId or query object'
    }, { status: 400 })

  } catch (error) {
    console.error('❌ Advanced snapshot POST error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
