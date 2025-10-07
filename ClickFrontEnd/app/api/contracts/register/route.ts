import { NextRequest, NextResponse } from 'next/server'
import { requireWalletAuth, isValidEthereumAddress, sanitizeInput, checkRateLimit } from '@/lib/auth/middleware'
import { ContractDetector } from '@/lib/contracts/detector'
import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
db.pragma('journal_mode = WAL')

const detector = new ContractDetector()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contractAddress, chainId = 1, walletAddress } = body
    
    // Validate wallet address from request body for now
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      return NextResponse.json({
        success: false,
        error: 'Valid wallet address is required'
      }, { status: 401 })
    }
    
    // Rate limiting: 10 contract registrations per hour per user
    if (!checkRateLimit(walletAddress.toLowerCase(), 10, 60 * 60 * 1000)) {
      return NextResponse.json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.'
      }, { status: 429 })
    }

    const { 
      description,
      websiteUrl,
      twitterUrl,
      discordUrl
    } = body

    // Validate required fields
    if (!contractAddress) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    // Validate contract address format
    if (!isValidEthereumAddress(contractAddress)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid Ethereum address format'
      }, { status: 400 })
    }

    // Validate chain ID
    const supportedChains = [1, 137, 42161, 8453, 360] // Mainnet, Polygon, Arbitrum, Base, Shape
    if (!supportedChains.includes(chainId)) {
      return NextResponse.json({
        success: false,
        error: `Unsupported chain ID. Supported chains: ${supportedChains.join(', ')}`
      }, { status: 400 })
    }

    // Sanitize optional metadata
    const metadata: any = {}
    if (description) {
      metadata.description = sanitizeInput(description)
      if (metadata.description.length > 1000) {
        return NextResponse.json({
          success: false,
          error: 'Description must be less than 1000 characters'
        }, { status: 400 })
      }
    }

    if (websiteUrl) {
      metadata.websiteUrl = sanitizeInput(websiteUrl)
      try {
        new URL(metadata.websiteUrl)
      } catch {
        return NextResponse.json({
          success: false,
          error: 'Invalid website URL format'
        }, { status: 400 })
      }
    }

    if (twitterUrl) {
      metadata.twitterUrl = sanitizeInput(twitterUrl)
      if (!metadata.twitterUrl.includes('twitter.com') && !metadata.twitterUrl.includes('x.com')) {
        return NextResponse.json({
          success: false,
          error: 'Invalid Twitter URL format'
        }, { status: 400 })
      }
    }

    if (discordUrl) {
      metadata.discordUrl = sanitizeInput(discordUrl)
      if (!metadata.discordUrl.includes('discord.gg') && !metadata.discordUrl.includes('discord.com')) {
        return NextResponse.json({
          success: false,
          error: 'Invalid Discord URL format'
        }, { status: 400 })
      }
    }

    // Step 1: Detect the contract using blockchain providers
    console.log(`🔍 Detecting contract ${contractAddress} on chain ${chainId}`)
    const contractInfo = await detector.detectContract(contractAddress, chainId)
    
    if (!contractInfo.isValid) {
      return NextResponse.json({
        success: false,
        error: contractInfo.error || 'Contract validation failed'
      }, { status: 400 })
    }

    // Step 1.5: Fetch OpenSea metadata for collection logo and description
    console.log(`🖼️ Fetching OpenSea metadata for ${contractAddress}`)
    let openSeaData: any = null
    try {
      // Use the OpenSea API directly instead of calling our own endpoint
      const getChainName = (chainId: number) => {
        switch (chainId) {
          case 1: return 'ethereum'
          case 137: return 'matic'
          case 42161: return 'arbitrum'
          case 8453: return 'base'
          case 360: return 'ethereum' // Shape not supported, fallback to ethereum
          default: return 'ethereum'
        }
      }

      const chain = getChainName(chainId)
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'User-Agent': 'ClickFrontEnd/1.0'
      }

      if (process.env.OPENSEA_API_KEY) {
        headers['X-API-KEY'] = process.env.OPENSEA_API_KEY
      }

      // Try contract endpoint first
      const contractUrl = `https://api.opensea.io/api/v2/chain/${chain}/contract/${contractAddress}`
      const contractResponse = await fetch(contractUrl, { headers })
      
      if (contractResponse.ok) {
        const contractData = await contractResponse.json()
        
        // If we have a collection slug, fetch detailed collection info
        if (contractData.collection) {
          const collectionUrl = `https://api.opensea.io/api/v2/collections/${contractData.collection}`
          const collectionResponse = await fetch(collectionUrl, { headers })
          
          if (collectionResponse.ok) {
            const collectionData = await collectionResponse.json()
            openSeaData = {
              name: collectionData.name || contractData.name,
              description: collectionData.description || contractData.description,
              image_url: collectionData.image_url || contractData.image_url,
              banner_image_url: collectionData.banner_image_url,
              external_url: collectionData.external_url || contractData.external_link,
              twitter_username: collectionData.twitter_username,
              discord_url: collectionData.discord_url
            }
            console.log(`✅ OpenSea metadata found:`, openSeaData.name)
          }
        } else {
          // Use contract data only
          openSeaData = {
            name: contractData.name,
            description: contractData.description,
            image_url: contractData.image_url,
            external_url: contractData.external_link
          }
        }
      }
    } catch (openSeaError) {
      console.log(`⚠️ OpenSea metadata fetch failed:`, openSeaError)
      // Continue without OpenSea data
    }

    // Step 2: Check if contract already exists
    const existingContract = db.prepare('SELECT id, address, name FROM contracts WHERE address = ? COLLATE NOCASE').get(contractAddress.toLowerCase()) as { id: number; address: string; name?: string } | undefined
    
    if (existingContract) {
      return NextResponse.json({
        success: false,
        error: `Contract ${existingContract.name || contractAddress} is already registered`
      }, { status: 409 })
    }

    // Step 3: Get or create user profile
    let userProfile = db.prepare('SELECT id FROM user_profiles WHERE wallet_address = ? COLLATE NOCASE').get(walletAddress.toLowerCase()) as any
    
    if (!userProfile) {
      const insertUser = db.prepare(`
        INSERT INTO user_profiles (wallet_address, username, created_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `)
      const result = insertUser.run(walletAddress.toLowerCase(), `user_${walletAddress.slice(0, 8)}`)
      userProfile = { id: result.lastInsertRowid }
    }

    // Step 4: Insert contract into database
    const insertContract = db.prepare(`
      INSERT INTO contracts (
        address, name, symbol, contract_type, chain_id,
        deployment_block, total_supply, is_verified, is_active,
        description, website_url, twitter_url, discord_url,
        image_url, banner_image_url,
        metadata_json, added_by_user_id, usage_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)

    // Combine OpenSea data with user-provided metadata
    const finalName = openSeaData?.name || contractInfo.name || `Contract ${contractAddress.slice(0, 8)}`
    const finalDescription = openSeaData?.description || metadata.description || ''
    const finalWebsiteUrl = openSeaData?.external_url || metadata.websiteUrl || ''
    const finalTwitterUrl = openSeaData?.twitter_username ? `https://twitter.com/${openSeaData.twitter_username}` : metadata.twitterUrl || ''
    const finalDiscordUrl = openSeaData?.discord_url || metadata.discordUrl || ''

    const contractResult = insertContract.run(
      contractAddress.toLowerCase(),
      finalName,
      contractInfo.symbol || 'UNKNOWN',
      contractInfo.contractType,
      chainId,
      contractInfo.deploymentBlock || null,
      contractInfo.totalSupply || '0',
      contractInfo.features.supportsInterface && contractInfo.features.supportsMetadata ? 1 : 0, // Mark as verified if it has proper interfaces
      1, // is_active
      finalDescription,
      finalWebsiteUrl,
      finalTwitterUrl,
      finalDiscordUrl,
      openSeaData?.image_url || null,
      openSeaData?.banner_image_url || null,
      JSON.stringify({
        features: contractInfo.features,
        openSeaData: openSeaData,
        detectionData: {
          confidence: 100, // From our detector
          detectedAt: new Date().toISOString(),
          chainId: chainId
        }
      }),
      userProfile.id,
      0 // usage_count starts at 0
    )

    // Step 5: Log user activity
    const insertActivity = db.prepare(`
      INSERT INTO user_activity (user_id, activity_type, contract_id, metadata, created_at)
      VALUES (?, 'contract_added', ?, ?, CURRENT_TIMESTAMP)
    `)
    
    insertActivity.run(
      userProfile.id,
      contractResult.lastInsertRowid,
      JSON.stringify({
        contractAddress: contractAddress.toLowerCase(),
        contractType: contractInfo.contractType,
        chainId: chainId
      })
    )

    // Step 6: Prepare response
    const registeredContract = {
      id: contractResult.lastInsertRowid.toString(),
      address: contractAddress.toLowerCase(),
      name: finalName,
      symbol: contractInfo.symbol || 'UNKNOWN',
      contractType: contractInfo.contractType,
      chainId: chainId,
      isVerified: contractInfo.features.supportsInterface && contractInfo.features.supportsMetadata,
      description: finalDescription,
      websiteUrl: finalWebsiteUrl,
      twitterUrl: finalTwitterUrl,
      discordUrl: finalDiscordUrl,
      imageUrl: openSeaData?.image_url,
      bannerImageUrl: openSeaData?.banner_image_url,
      deploymentBlock: contractInfo.deploymentBlock,
      totalSupply: contractInfo.totalSupply || '0',
      features: contractInfo.features,
      addedBy: walletAddress.toLowerCase(),
      addedAt: new Date().toISOString()
    }

    console.log(`✅ Contract ${contractInfo.name || contractAddress} registered successfully`)

    return NextResponse.json({
      success: true,
      data: {
        contract: registeredContract,
        warnings: []
      }
    })

  } catch (error) {
    console.error('Contract registration error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}