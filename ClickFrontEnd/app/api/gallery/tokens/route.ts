import { NextRequest, NextResponse } from 'next/server'

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const contractAddress = searchParams.get('contract')
    const limit = parseInt(searchParams.get('limit') || '24')

    if (!contractAddress) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    if (!OPENSEA_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'OpenSea API key not configured'
      }, { status: 500 })
    }

    // Fetch NFTs from OpenSea API
    const response = await fetch(
      `https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}/nfts?limit=${limit}`,
      {
        headers: {
          'x-api-key': OPENSEA_API_KEY
        }
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('OpenSea API error:', errorData)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch NFTs from OpenSea'
      }, { status: response.status })
    }

    const data = await response.json()

    // Transform OpenSea data to our format
    const tokens = data.nfts?.map((nft: any) => ({
      contractAddress: nft.contract,
      tokenId: nft.identifier,
      name: nft.name || `#${nft.identifier}`,
      description: nft.description,
      imageUrl: nft.image_url || nft.display_image_url,
      attributes: nft.traits?.map((trait: any) => ({
        trait_type: trait.trait_type,
        value: trait.value
      })) || [],
      collection: {
        name: nft.collection,
        imageUrl: nft.image_url
      }
    })) || []

    return NextResponse.json({
      success: true,
      data: {
        tokens,
        pagination: {
          total: tokens.length,
          limit,
          offset: 0,
          hasMore: data.next !== null
        }
      }
    })

  } catch (error: any) {
    console.error('Gallery tokens error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch gallery tokens'
    }, { status: 500 })
  }
}
