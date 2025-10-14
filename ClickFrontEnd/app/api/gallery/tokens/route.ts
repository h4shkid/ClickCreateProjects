import { NextRequest, NextResponse } from 'next/server'

const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const contractAddress = searchParams.get('contract')
    const limit = parseInt(searchParams.get('limit') || '200')
    const next = searchParams.get('next')

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

    // Build OpenSea API URL
    let url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}/nfts?limit=${limit}`
    if (next) {
      url += `&next=${next}`
    }

    console.log('[Gallery] Fetching from OpenSea:', url)

    const response = await fetch(url, {
      headers: {
        'x-api-key': OPENSEA_API_KEY
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Gallery] OpenSea API error:', response.status, errorText)
      return NextResponse.json({
        success: false,
        error: `Failed to fetch NFTs from OpenSea: ${response.status}`
      }, { status: response.status })
    }

    const data = await response.json()
    console.log('[Gallery] OpenSea returned:', data.nfts?.length, 'NFTs')

    // Sort by token ID descending (highest first)
    const nfts = data.nfts || []
    nfts.sort((a: any, b: any) => {
      const aId = parseInt(a.identifier)
      const bId = parseInt(b.identifier)
      return bId - aId
    })

    const tokens = nfts.map((nft: any) => ({
      contractAddress: nft.contract,
      tokenId: nft.identifier,
      name: nft.name || `#${nft.identifier}`,
      description: nft.description,
      imageUrl: nft.image_url || nft.display_image_url,
      attributes: nft.traits?.map((trait: any) => ({
        trait_type: trait.trait_type,
        value: trait.value
      })) || []
    }))

    return NextResponse.json({
      success: true,
      data: {
        tokens,
        pagination: {
          next: data.next || null,
          hasMore: data.next !== null
        }
      }
    })

  } catch (error: any) {
    console.error('[Gallery] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch gallery tokens'
    }, { status: 500 })
  }
}
