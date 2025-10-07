import { NextRequest, NextResponse } from 'next/server'
import { ContractRegistry } from '@/lib/contracts/registry'

const registry = new ContractRegistry()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50) // Max 50 trending contracts

    // Get trending contracts
    const trendingContracts = registry.getTrendingContracts(limit)

    return NextResponse.json({
      success: true,
      data: {
        contracts: trendingContracts
      }
    })

  } catch (error: any) {
    console.error('Trending contracts error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}