import { NextRequest, NextResponse } from 'next/server'

interface OpenSeaV2Collection {
  name: string
  description: string
  image_url: string
  banner_image_url?: string
  external_url?: string
  twitter_username?: string
  discord_url?: string
  opensea_url?: string
  project_url?: string
}

interface OpenSeaV2Contract {
  collection: string
  name: string
  description?: string
  image_url?: string
  external_link?: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get('address')
    const chainId = searchParams.get('chainId') || '1'

    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    // Determine the chain name for OpenSea API v2
    const getChainName = (chainId: string) => {
      switch (chainId) {
        case '1': return 'ethereum'
        case '137': return 'matic'
        case '42161': return 'arbitrum'
        case '8453': return 'base'
        case '10': return 'optimism'
        case '56': return 'bsc'
        case '43114': return 'avalanche'
        case '360': return 'ethereum' // Shape not supported, fallback to ethereum
        default: return 'ethereum'
      }
    }

    const chain = getChainName(chainId)
    
    // Set up headers with API key
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'User-Agent': 'ClickFrontEnd/1.0'
    }

    // Add API key (required for v2)
    if (process.env.OPENSEA_API_KEY) {
      headers['X-API-KEY'] = process.env.OPENSEA_API_KEY
    } else {
      console.warn('OpenSea API key not found')
    }

    // First, try to get contract information using OpenSea API v2
    const contractUrl = `https://api.opensea.io/api/v2/chain/${chain}/contract/${address}`
    
    console.log(`Fetching contract data from: ${contractUrl}`)
    
    try {
      const contractResponse = await fetch(contractUrl, {
        headers,
        next: { revalidate: 3600 } // Cache for 1 hour
      })

      if (contractResponse.ok) {
        const contractData: OpenSeaV2Contract = await contractResponse.json()
        console.log('Contract data received:', contractData)
        
        // If we have a collection slug, fetch detailed collection info
        if (contractData.collection) {
          const collectionUrl = `https://api.opensea.io/api/v2/collections/${contractData.collection}`
          console.log(`Fetching collection data from: ${collectionUrl}`)
          
          try {
            const collectionResponse = await fetch(collectionUrl, {
              headers,
              next: { revalidate: 3600 }
            })

            if (collectionResponse.ok) {
              const collectionData: OpenSeaV2Collection = await collectionResponse.json()
              console.log('Collection data received:', collectionData)
              
              return NextResponse.json({
                success: true,
                collection: {
                  name: collectionData.name || contractData.name,
                  description: collectionData.description || contractData.description,
                  image_url: collectionData.image_url || contractData.image_url,
                  banner_image_url: collectionData.banner_image_url,
                  external_url: collectionData.external_url || contractData.external_link,
                  twitter_username: collectionData.twitter_username,
                  discord_url: collectionData.discord_url,
                  opensea_url: collectionData.opensea_url,
                  project_url: collectionData.project_url
                }
              })
            }
          } catch (collectionError: any) {
            console.log('Collection fetch failed, using contract data:', collectionError)
          }
        }
        
        // Return contract data if collection fetch fails or no collection slug
        return NextResponse.json({
          success: true,
          collection: {
            name: contractData.name,
            description: contractData.description,
            image_url: contractData.image_url,
            external_url: contractData.external_link
          }
        })
      } else {
        console.log(`Contract API failed: ${contractResponse.status} ${contractResponse.statusText}`)
      }
    } catch (contractError: any) {
      console.log('Contract fetch failed:', contractError)
    }

    // Fallback: Try NFT endpoint to get collection info
    try {
      const nftUrl = `https://api.opensea.io/api/v2/chain/${chain}/contract/${address}/nfts?limit=1`
      console.log(`Trying NFT endpoint fallback: ${nftUrl}`)
      
      const nftResponse = await fetch(nftUrl, {
        headers,
        next: { revalidate: 3600 }
      })

      if (nftResponse.ok) {
        const nftData = await nftResponse.json()
        if (nftData.nfts && nftData.nfts.length > 0) {
          const firstNft = nftData.nfts[0]
          if (firstNft.collection) {
            return NextResponse.json({
              success: true,
              collection: {
                name: firstNft.collection,
                description: firstNft.description || 'Collection description not available',
                image_url: firstNft.image_url,
                external_url: firstNft.opensea_url
              }
            })
          }
        }
      }
    } catch (nftError: any) {
      console.log('NFT endpoint fallback failed:', nftError)
    }
    
    console.log(`All OpenSea API attempts failed for contract ${address} on chain ${chain}`)
    return NextResponse.json({
      success: false,
      error: 'Collection not found on OpenSea'
    }, { status: 404 })

  } catch (error: any) {
    console.error('OpenSea API error:', error)

    return NextResponse.json({
      success: false,
      error: 'Failed to fetch collection data'
    }, { status: 500 })
  }
}