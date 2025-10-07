import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'
import { ethers } from 'ethers'
import { createDeploymentDetector } from '@/lib/blockchain/deployment-detector'

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
db.pragma('journal_mode = WAL')

// Event signatures for different token standards
const ERC721_TRANSFER_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' // Transfer(address,address,uint256)
const ERC1155_TRANSFER_SINGLE_SIGNATURE = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62' // TransferSingle(address,address,address,uint256,uint256)
const ERC1155_TRANSFER_BATCH_SIGNATURE = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb' // TransferBatch(address,address,address,uint256[],uint256[])

// Rate limiting utilities
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Create RPC provider for Ethereum mainnet only
function createProvider(chainId = 1) {
  const quickNodeEndpoint = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  
  // Only support Ethereum mainnet (chain ID 1)
  if (chainId !== 1) {
    throw new Error(`Unsupported chain ID ${chainId}. Only Ethereum mainnet (1) is supported.`)
  }
  
  if (quickNodeEndpoint) {
    console.log('Using QuickNode endpoint for Ethereum blockchain sync')
    return new ethers.JsonRpcProvider(quickNodeEndpoint)
  } else if (alchemyKey) {
    console.log('Using Alchemy endpoint for Ethereum blockchain sync')
    return new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`)
  } else {
    console.log('Using public Ethereum endpoint for blockchain sync')
    return new ethers.JsonRpcProvider('https://eth.llamarpc.com')
  }
}

// Optimized block fetching for QuickNode Build Plan (50 req/sec)
async function fetchBlocksWithRateLimit(provider: ethers.JsonRpcProvider, blockNumbers: number[]) {
  // OPTIMIZED FOR QUICKNODE BUILD PLAN: 50 requests/second
  // Target: 40-45 req/sec to leave safety margin
  // Strategy: Larger batches with shorter delays for maximum throughput

  let BATCH_SIZE: number = 15
  let DELAY_MS: number = 100
  
  if (blockNumbers.length >= 200) {
    // High volume: Use large batches with minimal delay
    // 25 blocks per batch @ 50ms = 40 req/sec (well within 50 req/sec limit)
    BATCH_SIZE = 25
    DELAY_MS = 50
    console.log(`🚀 QuickNode optimized mode: ${blockNumbers.length} blocks (${BATCH_SIZE}/${DELAY_MS}ms = ~40 req/sec)`)
  } else if (blockNumbers.length >= 50) {
    // Medium volume: Balanced approach
    BATCH_SIZE = 20
    DELAY_MS = 75
    console.log(`⚡ Balanced mode: ${blockNumbers.length} blocks (${BATCH_SIZE}/${DELAY_MS}ms = ~35 req/sec)`)
  } else {
    // Low volume: Fast processing
    BATCH_SIZE = 15
    DELAY_MS = 100
    console.log(`🎯 Low volume mode: ${blockNumbers.length} blocks (${BATCH_SIZE}/${DELAY_MS}ms = ~25 req/sec)`)
  }
  
  const allBlocks: any[] = []
  let consecutiveErrors = 0
  
  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i/BATCH_SIZE) + 1
    const totalBatches = Math.ceil(blockNumbers.length/BATCH_SIZE)
    
    console.log(`🕐 Fetching blocks batch ${batchNumber}/${totalBatches} (${batch.length} blocks)`)
    
    let batchErrors = 0
    let rateLimitErrors = 0
    
    try {
      const blockPromises = batch.map(async (blockNum) => {
        // Retry logic for rate limited blocks
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const block = await provider.getBlock(blockNum)
            return block
          } catch (err: any) {
            if (err.message.includes('request limit') || err.message.includes('rate limit')) {
              rateLimitErrors++
              console.warn(`🚫 Rate limited: block ${blockNum} (attempt ${attempt + 1}/3)`)
              
              if (attempt < 2) {
                // Wait before retry, with exponential backoff
                const retryDelay = (attempt + 1) * 1000 // 1s, 2s, 3s
                console.log(`⏱️  Retrying block ${blockNum} in ${retryDelay}ms...`)
                await sleep(retryDelay)
                continue
              }
            } else {
              console.warn(`❌ Failed to fetch block ${blockNum}:`, err.message)
            }
            
            // Final attempt failed, use fallback
            batchErrors++
            return { number: blockNum, timestamp: Math.floor(Date.now() / 1000), error: true }
          }
        }
      })
      
      const blocks = await Promise.all(blockPromises)
      allBlocks.push(...blocks)
      
      // Dynamic adjustment for rate limiting errors
      if (rateLimitErrors > 0) {
        consecutiveErrors++
        const rateLimitPercentage = (rateLimitErrors / batch.length) * 100
        console.warn(`⚠️  ${rateLimitErrors}/${batch.length} rate limited (${rateLimitPercentage.toFixed(1)}%) in batch ${batchNumber}`)
        
        if (rateLimitPercentage > 50 || consecutiveErrors >= 2) {
          // Aggressive throttling when >50% rate limited or consecutive errors
          const oldDelay = DELAY_MS
          const oldBatch = BATCH_SIZE
          DELAY_MS = Math.min(DELAY_MS * 2, 5000) // Double delay, max 5 seconds
          BATCH_SIZE = Math.max(BATCH_SIZE - 5, 5) // Reduce batch size more aggressively
          console.log(`🔻 Emergency throttling: ${oldBatch}/${oldDelay}ms → ${BATCH_SIZE}/${DELAY_MS}ms`)
          
          // Also add extra delay after heavy rate limiting
          console.log(`⏱️  Additional cooling down period: 3 seconds`)
          await sleep(3000)
        } else if (rateLimitPercentage > 20) {
          // Moderate adjustment for 20%+ rate limiting
          DELAY_MS = Math.min(DELAY_MS * 1.5, 3000)
          console.log(`⏱️  Increasing delay to ${DELAY_MS}ms due to ${rateLimitPercentage.toFixed(1)}% rate limiting`)
        }
      } else if (batchErrors === 0 && rateLimitErrors === 0) {
        // Reset consecutive errors on fully successful batch
        consecutiveErrors = 0
        
        // Gradually optimize if we're being too conservative
        if (DELAY_MS > 100 && consecutiveErrors === 0) {
          DELAY_MS = Math.max(DELAY_MS * 0.9, 50)
          console.log(`🚀 Optimizing: reducing delay to ${DELAY_MS}ms`)
        }
      }
      
      const successCount = batch.length - batchErrors
      console.log(`   ✅ ${successCount}/${batch.length} successful (${rateLimitErrors} rate limited)`)
      
      // Rate limiting delay between batches
      if (i + BATCH_SIZE < blockNumbers.length) {
        await sleep(DELAY_MS)
      }
      
    } catch (error: any) {
      console.error(`❌ Batch error:`, error.message)
      consecutiveErrors++
      // Add fallback timestamps for failed batch
      batch.forEach(blockNum => {
        allBlocks.push({ number: blockNum, timestamp: Math.floor(Date.now() / 1000) })
      })
    }
  }
  
  console.log(`📊 Block fetching completed: ${allBlocks.length}/${blockNumbers.length} blocks retrieved`)
  
  return allBlocks
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params

    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    // Get contract from database
    const contract = db.prepare(`
      SELECT id, name, contract_type, chain_id FROM contracts 
      WHERE address = ? COLLATE NOCASE
    `).get(address.toLowerCase()) as any

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found'
      }, { status: 404 })
    }

    // Get sync status from database (with fallback for missing progress_percentage column)
    let syncStatus
    try {
      syncStatus = db.prepare(`
        SELECT
          current_block,
          end_block,
          start_block,
          status,
          total_events,
          processed_events,
          progress_percentage,
          completed_at,
          created_at
        FROM contract_sync_status
        WHERE contract_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(contract.id) as any
    } catch (error: any) {
      // Fallback query without progress_percentage for older database schemas
      console.warn('progress_percentage column not found, using fallback query')
      syncStatus = db.prepare(`
        SELECT
          current_block,
          end_block,
          start_block,
          status,
          total_events,
          processed_events,
          completed_at,
          created_at
        FROM contract_sync_status
        WHERE contract_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(contract.id) as any
    }

    // Get event statistics
    let stats = { totalEvents: 0, totalHolders: 0, uniqueTokens: 0 }
    try {
      const eventStats = db.prepare(`
        SELECT 
          COUNT(*) as totalEvents,
          COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) as totalHolders,
          COUNT(DISTINCT token_id) as uniqueTokens
        FROM events 
        WHERE contract_address = ? COLLATE NOCASE
      `).get(address.toLowerCase()) as any
      
      if (eventStats) {
        stats = eventStats
      }
    } catch (error: any) {
      // Events table might not exist, use defaults
      console.log('Events table not found, using default stats')
    }

    // Get real current block number from RPC
    let currentBlockNumber = 0
    try {
      const provider = createProvider(contract.chain_id)
      currentBlockNumber = await provider.getBlockNumber()
    } catch (error: any) {
      console.warn('Could not fetch current block number:', error)
      currentBlockNumber = 21000000 // Fallback only if RPC fails
    }

    // Calculate progress percentage if sync is in progress
    let progressPercentage = 0
    if (syncStatus) {
      if (syncStatus.status === 'completed') {
        progressPercentage = 100
      } else if (syncStatus.status === 'processing' && syncStatus.progress_percentage) {
        progressPercentage = syncStatus.progress_percentage
      } else if (syncStatus.status === 'processing' && syncStatus.current_block && syncStatus.start_block && syncStatus.end_block) {
        // Fallback calculation if progress_percentage is not set
        const totalBlocks = syncStatus.end_block - syncStatus.start_block
        const completedBlocks = syncStatus.current_block - syncStatus.start_block
        progressPercentage = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0
      }
    }

    const response = {
      status: syncStatus?.status || 'never_synced',
      lastSyncedBlock: syncStatus?.current_block || syncStatus?.end_block || null,
      currentBlockNumber: currentBlockNumber,
      progressPercentage: Math.min(Math.max(progressPercentage, 0), 100), // Ensure 0-100 range
      isSynced: syncStatus?.status === 'completed' && syncStatus?.current_block 
        ? (currentBlockNumber - syncStatus.current_block) < 50 
        : false,
      statistics: {
        totalEvents: syncStatus?.total_events || stats?.totalEvents || 0,
        totalHolders: stats?.totalHolders || 0,
        uniqueTokens: stats?.uniqueTokens || 0
      },
      lastUpdate: syncStatus?.completed_at || syncStatus?.created_at || null,
      syncRange: syncStatus ? {
        startBlock: syncStatus.start_block,
        endBlock: syncStatus.end_block,
        currentBlock: syncStatus.current_block
      } : null
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error: any) {
    console.error('Sync status error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params

    if (!address) {
      return NextResponse.json({
        success: false,
        error: 'Contract address is required'
      }, { status: 400 })
    }

    // Get contract from database
    const contract = db.prepare(`
      SELECT id, name, contract_type, chain_id FROM contracts 
      WHERE address = ? COLLATE NOCASE
    `).get(address.toLowerCase()) as any

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found'
      }, { status: 404 })
    }

    console.log(`🔍 Contract details: ${contract.name} (${contract.contract_type})`)

    // For now, just return a mock sync initiation response
    // In a real implementation, this would trigger blockchain sync

    // Get contract deployment block for efficient syncing
    const contractDetails = db.prepare(`
      SELECT deployment_block FROM contracts
      WHERE id = ?
    `).get(contract.id) as any

    let deploymentBlock = contractDetails?.deployment_block
    
    // Get real current block from RPC provider
    let currentBlock = 21000000 // Fallback
    const provider = createProvider(contract.chain_id)
    try {
      currentBlock = await provider.getBlockNumber()
      console.log(`📊 Real current block number: ${currentBlock}`)

      // If deployment block is not set, detect it automatically
      if (!deploymentBlock) {
        console.log(`⚠️  No deployment block found for contract, detecting automatically...`)
        
        try {
          const detector = new (await import('@/lib/blockchain/deployment-detector')).DeploymentDetector(provider, contract.chain_id)
          const deploymentInfo = await detector.detectDeploymentBlock(address)
          
          if (deploymentInfo) {
            deploymentBlock = deploymentInfo.blockNumber
            console.log(`✅ Auto-detected deployment block: ${deploymentBlock} (method: ${deploymentInfo.method})`)
            
            // Update the database with the detected deployment block
            db.prepare(`
              UPDATE contracts 
              SET deployment_block = ? 
              WHERE id = ?
            `).run(deploymentBlock, contract.id)
            
            console.log(`💾 Updated database with deployment block ${deploymentBlock}`)
          } else {
            // Use conservative fallback
            deploymentBlock = 16000000
            console.log(`⚠️  Could not detect deployment block, using conservative fallback: ${deploymentBlock}`)
          }
        } catch (error: any) {
          console.error('❌ Deployment detection failed:', error)
          deploymentBlock = 16000000 // Conservative fallback
          console.log(`⚠️  Using fallback deployment block: ${deploymentBlock}`)
        }
      } else {
        console.log(`📍 Using stored deployment block: ${deploymentBlock}`)
      }
    } catch (error: any) {
      console.warn('Could not fetch current block, using fallback:', error)
    }

    // First, check if any sync already exists for this contract
    const existingSync = db.prepare(`
      SELECT id, status, sync_type, current_block, start_block FROM contract_sync_status
      WHERE contract_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(contract.id) as any

    let syncId: number
    let startFromBlock = deploymentBlock

    if (existingSync) {
      // Determine where to resume from
      if (existingSync.current_block && existingSync.current_block > deploymentBlock) {
        startFromBlock = existingSync.current_block + 1 // Resume from next block
        console.log(`📍 Resuming sync from block ${startFromBlock} (previous: ${existingSync.current_block})`)
      } else {
        console.log(`🔄 Starting fresh sync from deployment block ${deploymentBlock}`)
      }
      
      // Update existing sync record
      console.log(`Updating existing sync record ${existingSync.id} for contract ${contract.name}`)
      
      db.prepare(`
        UPDATE contract_sync_status 
        SET status = 'processing', 
            started_at = CURRENT_TIMESTAMP,
            start_block = ?,
            end_block = ?
        WHERE id = ?
      `).run(startFromBlock, currentBlock, existingSync.id)
      
      syncId = existingSync.id
    } else {
      // Insert a new sync record only if none exists
      try {
        console.log(`Creating new sync record for contract ${contract.name}`)
        
        const insertSyncStatus = db.prepare(`
          INSERT INTO contract_sync_status (
            contract_id, 
            sync_type, 
            start_block, 
            end_block, 
            current_block, 
            status,
            started_at,
            created_at
          )
          VALUES (?, 'full_refresh', ?, ?, ?, 'processing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `)
        
        const result = insertSyncStatus.run(contract.id, startFromBlock, currentBlock, startFromBlock)
        syncId = result.lastInsertRowid as number
      } catch (dbError: any) {
        console.error('Could not insert sync status:', dbError)
        return NextResponse.json({
          success: false,
          error: 'Failed to initiate sync: ' + (dbError instanceof Error ? dbError.message : 'Unknown error')
        }, { status: 500 })
      }
    }

    // Calculate total blocks for duration estimation
    let totalBlocks = 0
    
    // Fetch REAL blockchain data
    try {
      console.log(`🔄 Starting REAL blockchain sync for contract ${contract.name} from block ${startFromBlock}`)
      
      const provider = createProvider(contract.chain_id)
      const currentBlock = await provider.getBlockNumber()
      console.log(`📊 Current blockchain block: ${currentBlock}, starting from: ${startFromBlock}`)
      
      let eventsInserted = 0
      let processedBlocks = 0
      
      // Process blocks in chunks - optimized for Ethereum mainnet
      const CHUNK_SIZE = 1000  // Optimized for Ethereum with QuickNode/Alchemy
      totalBlocks = currentBlock - startFromBlock
      console.log(`🔢 Total blocks to process: ${totalBlocks}`)
      console.log(`🚀 Using optimized chunking for Ethereum mainnet: ${CHUNK_SIZE} blocks per chunk`)
      
      // Prepare batch insert statement
      const insertEvent = db.prepare(`
        INSERT OR IGNORE INTO events (
          contract_address, token_id, from_address, to_address, 
          amount, block_number, block_timestamp, transaction_hash, 
          log_index, event_type, operator, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Transfer', ?, CURRENT_TIMESTAMP)
      `)
      
      // Create transaction for batch inserts
      const insertEventsBatch = db.transaction((events: any[]) => {
        for (const event of events) {
          const result = insertEvent.run(...event)
          if (result.changes > 0) {
            eventsInserted++
          }
        }
      })
      
      for (let fromBlock = startFromBlock; fromBlock <= currentBlock; fromBlock += CHUNK_SIZE) {
        const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, currentBlock)
        
        // Calculate and display progress percentage
        const completedBlocks = fromBlock - startFromBlock
        const progressPercent = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0
        
        console.log(`📦 Processing blocks ${fromBlock} to ${toBlock} (${progressPercent}% complete)`)
        
        // Declare logs variable outside try block so it's accessible later
        let logs: any[] = []
        
        try {
          // Fetch transfer events for this chunk based on contract type
          let transferTopics: string[]
          
          if (contract.contract_type === 'ERC1155') {
            // ERC-1155: Listen for both TransferSingle and TransferBatch events
            transferTopics = [ERC1155_TRANSFER_SINGLE_SIGNATURE, ERC1155_TRANSFER_BATCH_SIGNATURE]
            console.log(`🎯 Fetching ERC-1155 transfer events (TransferSingle + TransferBatch)`)
          } else {
            // ERC-721: Listen for standard Transfer events
            transferTopics = [ERC721_TRANSFER_SIGNATURE]
            console.log(`🎯 Fetching ERC-721 transfer events`)
          }
          
          logs = await provider.getLogs({
            address: address,
            fromBlock: fromBlock,
            toBlock: toBlock,
            topics: [transferTopics] // Multiple event signatures
          })
          
          console.log(`📋 Found ${logs.length} transfer events in blocks ${fromBlock}-${toBlock}`)
          
          if (logs.length === 0) {
            processedBlocks += (toBlock - fromBlock + 1)
            continue
          }
          
          // Batch fetch block timestamps for all unique blocks with rate limiting
          const uniqueBlockNumbers = [...new Set(logs.map(log => log.blockNumber))]
          console.log(`🕐 Fetching timestamps for ${uniqueBlockNumbers.length} unique blocks`)
          
          const blocks = await fetchBlocksWithRateLimit(provider, uniqueBlockNumbers)
          const blockTimestamps = Object.fromEntries(
            blocks.map(block => [block.number, block.timestamp])
          )
          
          // Prepare all events for batch insert
          const eventsToInsert: any[] = []
          
          for (const log of logs) {
            try {
              // Decode based on event signature
              const eventSignature = log.topics[0]
              
              if (eventSignature === ERC721_TRANSFER_SIGNATURE) {
                // ERC-721 Transfer: Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
                const fromAddress = '0x' + log.topics[1].slice(26) // Remove padding
                const toAddress = '0x' + log.topics[2].slice(26) // Remove padding
                const tokenId = BigInt(log.topics[3]).toString()
                
                // Use cached block timestamp
                const blockTimestamp = blockTimestamps[log.blockNumber] || Math.floor(Date.now() / 1000)
                
                eventsToInsert.push([
                  address.toLowerCase(),
                  tokenId,
                  fromAddress.toLowerCase(),
                  toAddress.toLowerCase(),
                  '1', // ERC-721 transfers always 1 token
                  log.blockNumber,
                  blockTimestamp,
                  log.transactionHash.toLowerCase(),
                  log.index,
                  address.toLowerCase() // operator is the contract
                ])
                
              } else if (eventSignature === ERC1155_TRANSFER_SINGLE_SIGNATURE) {
                // ERC-1155 TransferSingle: TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
                const operator = '0x' + log.topics[1].slice(26)
                const fromAddress = '0x' + log.topics[2].slice(26)
                const toAddress = '0x' + log.topics[3].slice(26)
                
                // Decode data field for id and value
                const dataHex = log.data.slice(2) // Remove 0x
                const tokenId = BigInt('0x' + dataHex.slice(0, 64)).toString()
                const amount = BigInt('0x' + dataHex.slice(64, 128)).toString()
                
                const blockTimestamp = blockTimestamps[log.blockNumber] || Math.floor(Date.now() / 1000)
                
                eventsToInsert.push([
                  address.toLowerCase(),
                  tokenId,
                  fromAddress.toLowerCase(),
                  toAddress.toLowerCase(),
                  amount,
                  log.blockNumber,
                  blockTimestamp,
                  log.transactionHash.toLowerCase(),
                  log.index,
                  operator.toLowerCase()
                ])
                
              } else if (eventSignature === ERC1155_TRANSFER_BATCH_SIGNATURE) {
                // ERC-1155 TransferBatch: TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)
                const operator = '0x' + log.topics[1].slice(26)
                const fromAddress = '0x' + log.topics[2].slice(26)
                const toAddress = '0x' + log.topics[3].slice(26)
                
                try {
                  // Properly decode ERC-1155 batch transfer data
                  const dataHex = log.data.slice(2) // Remove 0x
                  
                  // Use ethers ABI coder to decode the data properly
                  const abiCoder = ethers.AbiCoder.defaultAbiCoder()
                  const decoded = abiCoder.decode(['uint256[]', 'uint256[]'], '0x' + dataHex)
                  
                  const tokenIds = decoded[0]
                  const amounts = decoded[1]
                  
                  const blockTimestamp = blockTimestamps[log.blockNumber] || Math.floor(Date.now() / 1000)
                  
                  // Create individual events for each token in the batch
                  for (let i = 0; i < tokenIds.length && i < amounts.length; i++) {
                    eventsToInsert.push([
                      address.toLowerCase(),
                      tokenIds[i].toString(),
                      fromAddress.toLowerCase(),
                      toAddress.toLowerCase(),
                      amounts[i].toString(),
                      log.blockNumber,
                      blockTimestamp,
                      log.transactionHash.toLowerCase(),
                      log.index + i, // Unique log index for each batch item
                      operator.toLowerCase()
                    ])
                  }
                  
                  console.log(`📦 Processed ERC-1155 batch transfer: ${tokenIds.length} tokens`)
                  
                } catch (decodeError: any) {
                  console.warn(`❌ Failed to decode batch transfer, skipping:`, decodeError.message)
                  // Skip problematic batch transfers rather than creating fake Token ID 0
                }
              }
              
            } catch (decodeError: any) {
              console.warn(`Failed to decode log:`, decodeError)
            }
          }
          
          // Batch insert all events for this chunk
          if (eventsToInsert.length > 0) {
            console.log(`💾 Batch inserting ${eventsToInsert.length} events`)
            insertEventsBatch(eventsToInsert)
          }
          
          processedBlocks += (toBlock - fromBlock + 1)
          
          // Calculate final progress for this chunk
          const finalCompletedBlocks = (toBlock - startFromBlock) + 1
          const finalProgressPercent = totalBlocks > 0 ? Math.round((finalCompletedBlocks / totalBlocks) * 100) : 0
          
          // Update sync progress with percentage (with fallback for older schemas)
          try {
            db.prepare(`
              UPDATE contract_sync_status 
              SET current_block = ?, 
                  processed_events = ?,
                  progress_percentage = ?
              WHERE id = ?
            `).run(toBlock, eventsInserted, Math.min(finalProgressPercent, 100), syncId)
          } catch (updateError: any) {
            // Fallback update without progress_percentage
            console.warn('progress_percentage column not found in update, using fallback')
            db.prepare(`
              UPDATE contract_sync_status 
              SET current_block = ?, 
                  processed_events = ?
              WHERE id = ?
            `).run(toBlock, eventsInserted, syncId)
          }
          
        } catch (chunkError: any) {
          console.error(`Error processing chunk ${fromBlock}-${toBlock}:`, chunkError)
          // Wait before retrying if rate limited
          if (chunkError.message?.includes('request limit') || chunkError.message?.includes('rate limit')) {
            console.log('⏱️ Rate limited, waiting 2 seconds before continuing...')
            await sleep(2000)
          } else {
            await sleep(500)
          }
        }
        
        // Optimized chunk delays for QuickNode Build Plan (50 req/sec)
        let chunkDelay = 100 // Much faster base delay for QuickNode
        
        if (logs && logs.length > 1000) {
          // Very large event chunk - moderate delay to prevent overwhelming
          chunkDelay = 500
          console.log(`⏱️  Moderate chunk delay (${chunkDelay}ms) due to ${logs.length} events`)
        } else if (logs && logs.length > 300) {
          // Large event chunk - small delay
          chunkDelay = 250
        }
        
        await sleep(chunkDelay)
      }
      
      console.log(`📊 Processed ${processedBlocks} blocks and found ${eventsInserted} real transfer events`)
      
      // Calculate current balances from real events using optimized bulk query
      console.log(`🧮 Calculating real holder balances...`)
      let statesUpdated = 0
      
      try {
        // Calculate current balances for ERC-1155 (supports multiple owners per token)
        let currentOwners;
        
        if (contract.contract_type === 'ERC1155') {
          // ERC-1155: Calculate net balance for each (token_id, address) pair
          currentOwners = db.prepare(`
            WITH balance_changes AS (
              SELECT 
                token_id,
                to_address as address,
                CAST(amount AS INTEGER) as amount_change
              FROM events 
              WHERE contract_address = ? COLLATE NOCASE
              AND to_address != '0x0000000000000000000000000000000000000000'
              
              UNION ALL
              
              SELECT 
                token_id,
                from_address as address,
                -CAST(amount AS INTEGER) as amount_change
              FROM events 
              WHERE contract_address = ? COLLATE NOCASE
              AND from_address != '0x0000000000000000000000000000000000000000'
            ),
            net_balances AS (
              SELECT 
                token_id,
                address,
                SUM(amount_change) as net_balance
              FROM balance_changes
              GROUP BY token_id, address
              HAVING SUM(amount_change) > 0
            )
            SELECT 
              token_id,
              address as current_owner,
              net_balance as balance,
              (SELECT MAX(block_number) FROM events e WHERE e.contract_address = ? COLLATE NOCASE AND e.token_id = net_balances.token_id AND (e.to_address = net_balances.address OR e.from_address = net_balances.address)) as block_number
            FROM net_balances
            ORDER BY token_id, address
          `).all(address.toLowerCase(), address.toLowerCase(), address.toLowerCase()) as any
        } else {
          // ERC-721: Use original logic (one owner per token)
          currentOwners = db.prepare(`
            WITH latest_transfers AS (
              SELECT 
                token_id,
                to_address as current_owner,
                block_number,
                ROW_NUMBER() OVER (
                  PARTITION BY token_id 
                  ORDER BY block_number DESC, log_index DESC
                ) as rn
              FROM events 
              WHERE contract_address = ? COLLATE NOCASE
              AND to_address != '0x0000000000000000000000000000000000000000'
            )
            SELECT 
              token_id,
              current_owner,
              block_number,
              1 as balance
            FROM latest_transfers 
            WHERE rn = 1
          `).all(address.toLowerCase()) as any
        }
        
        console.log(`🏷️ Found ${currentOwners.length} currently owned tokens`)
        
        if (currentOwners.length > 0) {
          console.log(`💾 Clearing existing state and rebuilding for contract ${address.toLowerCase()}`)
          
          // Create transaction to atomically clear and rebuild state
          const rebuildStateTransaction = db.transaction(() => {
            // Step 1: Clear existing state for this contract
            const deleteResult = db.prepare(`
              DELETE FROM current_state WHERE contract_address = ? COLLATE NOCASE
            `).run(address.toLowerCase())
            
            console.log(`  🗑️ Cleared ${deleteResult.changes} existing state records`)
            
            // Step 2: Insert current owners (only positive balances)
            const insertCurrentState = db.prepare(`
              INSERT INTO current_state (
                contract_address, token_id, address, balance, last_updated_block, updated_at
              )
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `)
            
            let insertedCount = 0
            for (const owner of currentOwners) {
              const balance = owner.balance || 1
              if (balance > 0) {
                insertCurrentState.run(
                  address.toLowerCase(),
                  owner.token_id,
                  owner.current_owner.toLowerCase(),
                  balance,
                  owner.block_number
                )
                insertedCount++
                statesUpdated++
              }
            }
            
            console.log(`  ✅ Inserted ${insertedCount} current holder records`)
            
            return insertedCount
          })
          
          // Execute the atomic rebuild
          console.log(`💾 Batch rebuilding ${currentOwners.length} holder states`)
          rebuildStateTransaction()
        }
        
      } catch (balanceError: any) {
        console.error('Error calculating balances:', balanceError)
      }
      
      // Mark sync as completed with 100% progress (with fallback for older schemas)
      try {
        db.prepare(`
          UPDATE contract_sync_status 
          SET status = 'completed', 
              current_block = ?, 
              completed_at = CURRENT_TIMESTAMP,
              total_events = ?,
              processed_events = ?,
              progress_percentage = 100
          WHERE id = ?
        `).run(currentBlock, eventsInserted, eventsInserted, syncId)
      } catch (completionError: any) {
        // Fallback completion update without progress_percentage
        console.warn('progress_percentage column not found in completion, using fallback')
        db.prepare(`
          UPDATE contract_sync_status 
          SET status = 'completed', 
              current_block = ?, 
              completed_at = CURRENT_TIMESTAMP,
              total_events = ?,
              processed_events = ?
          WHERE id = ?
        `).run(currentBlock, eventsInserted, eventsInserted, syncId)
      }

      console.log(`✅ REAL blockchain sync completed for ${contract.name}!`)
      console.log(`📊 Summary: ${eventsInserted} events, ${statesUpdated} holder states, ${processedBlocks} blocks processed`)

    } catch (error: any) {
      console.error('Failed to complete REAL blockchain sync:', error)
      
      // Mark sync as failed
      db.prepare(`
        UPDATE contract_sync_status 
        SET status = 'failed', 
            error_message = ?,
            completed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(error instanceof Error ? error.message : 'Unknown error', syncId)
      
      return NextResponse.json({
        success: false,
        error: 'Real blockchain sync failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Blockchain sync initiated from block ${startFromBlock}`,
      data: {
        contractId: contract.id,
        contractName: contract.name,
        status: 'syncing',
        syncType: existingSync && existingSync.current_block ? 'resume' : 'full_refresh',
        startBlock: startFromBlock,
        endBlock: currentBlock,
        estimatedDuration: totalBlocks > 100000 ? '5-15 minutes' : '1-5 minutes'
      }
    })

  } catch (error: any) {
    console.error('Sync initiation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}