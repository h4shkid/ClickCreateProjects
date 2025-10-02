import { NextRequest, NextResponse } from 'next/server'
import { ContractRegistry } from '@/lib/contracts/registry'

const registry = new ContractRegistry()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const query = searchParams.get('q') || ''
    const contractType = searchParams.get('type') as 'ERC721' | 'ERC1155' | null
    const isVerified = searchParams.get('verified') === 'true' ? true : 
                      searchParams.get('verified') === 'false' ? false : undefined
    const sortBy = searchParams.get('sortBy') as 'usage' | 'name' | 'created' | 'holders' || 'usage'
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc'
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 per request
    const offset = parseInt(searchParams.get('offset') || '0')

    // Validate parameters
    if (contractType && !['ERC721', 'ERC1155'].includes(contractType)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid contract type. Must be ERC721 or ERC1155'
      }, { status: 400 })
    }

    if (!['usage', 'name', 'created', 'holders'].includes(sortBy)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid sortBy. Must be usage, name, created, or holders'
      }, { status: 400 })
    }

    if (!['asc', 'desc'].includes(sortOrder)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid sortOrder. Must be asc or desc'
      }, { status: 400 })
    }

    // Search contracts
    const result = registry.searchContracts({
      query: query.trim(),
      contractType: contractType || undefined,
      isVerified,
      sortBy,
      sortOrder,
      limit,
      offset
    })

    return NextResponse.json({
      success: true,
      data: {
        contracts: result.contracts,
        pagination: {
          total: result.totalCount,
          limit,
          offset,
          hasMore: result.hasMore
        }
      }
    })

  } catch (error) {
    console.error('Contract search error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}