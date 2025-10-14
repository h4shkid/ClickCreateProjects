import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

// Create a public client for ENS lookups (server-side only)
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
    : 'https://eth.merkle.io')
})

// In-memory cache
const ensCache = new Map<string, string | null>()

export async function POST(request: NextRequest) {
  try {
    const { addresses } = await request.json()

    if (!addresses || !Array.isArray(addresses)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid addresses array'
      }, { status: 400 })
    }

    const results: Record<string, string | null> = {}

    // Resolve ENS names with rate limiting
    for (const address of addresses) {
      const lowerAddress = address.toLowerCase()

      // Check cache first
      if (ensCache.has(lowerAddress)) {
        results[address] = ensCache.get(lowerAddress)!
        continue
      }

      try {
        const ensName = await publicClient.getEnsName({
          address: address as `0x${string}`
        })

        ensCache.set(lowerAddress, ensName)
        results[address] = ensName
      } catch (error) {
        console.error(`ENS resolution failed for ${address}:`, error)
        ensCache.set(lowerAddress, null)
        results[address] = null
      }
    }

    return NextResponse.json({
      success: true,
      data: results
    })

  } catch (error: any) {
    console.error('[ENS API] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to resolve ENS names'
    }, { status: 500 })
  }
}
