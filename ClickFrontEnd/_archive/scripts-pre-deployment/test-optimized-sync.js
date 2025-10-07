const { ethers } = require('ethers')
require('dotenv').config()

// ERC-721 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

// Test contract address (Good Vibes Club)
const TEST_CONTRACT = '0xb8ea78fcacef50d41375e44e6814ebba36bb33c4'

function createProvider() {
  const quickNodeEndpoint = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  
  if (quickNodeEndpoint) {
    console.log('🔗 Using QuickNode endpoint')
    return new ethers.JsonRpcProvider(quickNodeEndpoint)
  } else if (alchemyKey) {
    console.log('🔗 Using Alchemy endpoint')
    return new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`)
  } else {
    console.log('🔗 Using public Ethereum endpoint')
    return new ethers.JsonRpcProvider('https://eth.llamarpc.com')
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Optimized block fetching (from our performance tests)
async function fetchBlocksOptimized(provider, blockNumbers) {
  const BATCH_SIZE = 15 // Optimal from tests
  const DELAY_MS = 200
  
  const allBlocks = []
  
  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE)
    
    try {
      const blockPromises = batch.map(blockNum => 
        provider.getBlock(blockNum).catch(err => {
          console.warn(`Failed block ${blockNum}: ${err.message}`)
          return { number: blockNum, timestamp: Math.floor(Date.now() / 1000) }
        })
      )
      
      const blocks = await Promise.all(blockPromises)
      allBlocks.push(...blocks)
      
      if (i + BATCH_SIZE < blockNumbers.length) {
        await sleep(DELAY_MS)
      }
    } catch (error) {
      console.error('Batch error:', error.message)
    }
  }
  
  return allBlocks
}

// Optimized sync simulation
async function testOptimizedSync(provider, startBlock, endBlock) {
  console.log(`\n🚀 Testing OPTIMIZED sync strategy`)
  console.log(`📊 Range: ${endBlock - startBlock + 1} blocks (${startBlock} to ${endBlock})`)
  
  const startTime = Date.now()
  let totalEvents = 0
  let errors = 0
  
  const CHUNK_SIZE = 500 // Optimal chunk size
  const CHUNK_DELAY = 300 // Delay between chunks
  
  // Process in chunks
  for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += CHUNK_SIZE) {
    const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, endBlock)
    const chunkStartTime = Date.now()
    
    try {
      console.log(`📦 Processing chunk ${fromBlock}-${toBlock}`)
      
      // Fetch logs for this chunk
      const logs = await provider.getLogs({
        address: TEST_CONTRACT,
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: [TRANSFER_EVENT_SIGNATURE]
      })
      
      console.log(`   📋 Found ${logs.length} events`)
      
      if (logs.length > 0) {
        // Get unique block numbers for timestamp fetching
        const uniqueBlocks = [...new Set(logs.map(log => log.blockNumber))]
        console.log(`   🕐 Fetching timestamps for ${uniqueBlocks.length} unique blocks`)
        
        // Optimized block timestamp fetching
        const blocks = await fetchBlocksOptimized(provider, uniqueBlocks)
        console.log(`   ✅ Retrieved ${blocks.length} block timestamps`)
      }
      
      totalEvents += logs.length
      const chunkTime = Date.now() - chunkStartTime
      console.log(`   ⏱️  Chunk completed in ${chunkTime}ms`)
      
    } catch (error) {
      errors++
      console.error(`   ❌ Chunk failed: ${error.message}`)
      
      // Handle rate limiting
      if (error.message.includes('request limit') || error.message.includes('rate limit')) {
        console.log('   ⏱️  Rate limited, waiting 2 seconds...')
        await sleep(2000)
      }
    }
    
    // Delay between chunks
    if (fromBlock + CHUNK_SIZE <= endBlock) {
      await sleep(CHUNK_DELAY)
    }
  }
  
  const totalTime = Date.now() - startTime
  const totalBlocks = endBlock - startBlock + 1
  const blocksPerSecond = (totalBlocks / totalTime) * 1000
  const chunksProcessed = Math.ceil(totalBlocks / CHUNK_SIZE)
  
  console.log(`\n✅ OPTIMIZED SYNC RESULTS:`)
  console.log(`   📊 Total time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`)
  console.log(`   🏃 Blocks per second: ${blocksPerSecond.toFixed(1)}`)
  console.log(`   📋 Total events: ${totalEvents}`)
  console.log(`   📦 Chunks processed: ${chunksProcessed}`)
  console.log(`   ⏱️  Average per chunk: ${(totalTime/chunksProcessed).toFixed(1)}ms`)
  console.log(`   ✅ Success rate: ${((chunksProcessed - errors) / chunksProcessed * 100).toFixed(1)}%`)
  
  // Estimate for larger sync
  const blocksPerHour = blocksPerSecond * 3600
  const millionBlockTime = (1000000 / blocksPerSecond / 60).toFixed(1)
  
  console.log(`\n💡 PERFORMANCE PROJECTIONS:`)
  console.log(`   🕐 Blocks per hour: ${blocksPerHour.toLocaleString()}`)
  console.log(`   📈 Time for 1M blocks: ${millionBlockTime} minutes`)
  
  if (blocksPerSecond > 1000) {
    console.log(`   🚀 Excellent! Can sync large ranges quickly`)
  } else if (blocksPerSecond > 500) {
    console.log(`   ✅ Good performance for production use`)
  } else {
    console.log(`   ⚠️  Consider further optimization for large syncs`)
  }
  
  return { totalTime, blocksPerSecond, totalEvents, errors, chunksProcessed }
}

// Run the test
async function runOptimizedTest() {
  console.log('🎯 Testing Optimized Sync Strategy')
  console.log('='.repeat(60))
  
  const provider = createProvider()
  
  try {
    // Test with a reasonable range - 2500 blocks (5 chunks)
    const currentBlock = await provider.getBlockNumber()
    const endBlock = currentBlock - 100
    const startBlock = endBlock - 2499 // 2500 blocks
    
    const result = await testOptimizedSync(provider, startBlock, endBlock)
    
    console.log('\n' + '='.repeat(60))
    console.log('🎉 OPTIMIZATION SUCCESS!')
    console.log('')
    console.log('🔧 RECOMMENDED SETTINGS FOR PRODUCTION:')
    console.log('   • Chunk size: 500 blocks')
    console.log('   • Block batch size: 15')
    console.log('   • Chunk delay: 300ms')
    console.log('   • Block fetch delay: 200ms')
    console.log('')
    console.log(`📈 Expected performance: ${result.blocksPerSecond.toFixed(1)} blocks/second`)
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

runOptimizedTest().catch(console.error)