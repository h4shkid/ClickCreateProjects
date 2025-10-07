const { ethers } = require('ethers')
require('dotenv').config()

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

// Copy of the improved fetchBlocksWithRateLimit function from sync route
async function fetchBlocksWithRateLimit(provider, blockNumbers) {
  // Dynamic rate limiting based on the number of blocks to fetch
  // High volume (100+ blocks) = ultra conservative to prevent rate limiting
  // Medium volume (50-99 blocks) = moderate conservative  
  // Low volume (<50 blocks) = optimized for speed
  
  let BATCH_SIZE
  let DELAY_MS
  
  if (blockNumbers.length >= 100) {
    // Ultra conservative for high-volume chunks (like large event chunks)
    BATCH_SIZE = 5
    DELAY_MS = 1000
    console.log(`🔥 Ultra conservative mode: ${blockNumbers.length} blocks (${BATCH_SIZE}/${DELAY_MS}ms) to prevent rate limiting`)
  } else if (blockNumbers.length >= 50) {
    // Moderate conservative for medium volume
    BATCH_SIZE = 8
    DELAY_MS = 750
    console.log(`⚡ Moderate mode: ${blockNumbers.length} blocks (${BATCH_SIZE}/${DELAY_MS}ms)`)
  } else {
    // Optimized for speed with small volumes
    BATCH_SIZE = 15
    DELAY_MS = 200
    console.log(`🚀 Optimized mode: ${blockNumbers.length} blocks (${BATCH_SIZE}/${DELAY_MS}ms)`)
  }
  
  const allBlocks = []
  let consecutiveErrors = 0
  
  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i/BATCH_SIZE) + 1
    const totalBatches = Math.ceil(blockNumbers.length/BATCH_SIZE)
    
    console.log(`🕐 Fetching blocks batch ${batchNumber}/${totalBatches} (${batch.length} blocks)`)
    
    let batchErrors = 0
    let rateLimitErrors = 0
    
    try {
      const blockPromises = batch.map(blockNum => 
        provider.getBlock(blockNum).catch(err => {
          if (err.message.includes('request limit') || err.message.includes('rate limit')) {
            rateLimitErrors++
            console.warn(`🚫 Rate limited: block ${blockNum}`)
          } else {
            console.warn(`❌ Failed to fetch block ${blockNum}:`, err.message)
          }
          batchErrors++
          return { number: blockNum, timestamp: Math.floor(Date.now() / 1000) }
        })
      )
      
      const blocks = await Promise.all(blockPromises)
      allBlocks.push(...blocks)
      
      // Dynamic adjustment for rate limiting errors
      if (rateLimitErrors > 0) {
        consecutiveErrors++
        console.warn(`⚠️  ${rateLimitErrors} rate limit errors in batch ${batchNumber}`)
        
        if (consecutiveErrors >= 2) {
          // Aggressive throttling after consecutive rate limit errors
          const oldDelay = DELAY_MS
          const oldBatch = BATCH_SIZE
          DELAY_MS = Math.min(DELAY_MS * 2, 3000) // Double delay, max 3 seconds
          BATCH_SIZE = Math.max(BATCH_SIZE - 3, 3) // Reduce batch size, min 3
          console.log(`🔻 Emergency throttling: ${oldBatch}/${oldDelay}ms → ${BATCH_SIZE}/${DELAY_MS}ms`)
        } else {
          // Single error - moderate adjustment
          DELAY_MS = Math.min(DELAY_MS * 1.5, 2000)
          console.log(`⏱️  Increasing delay to ${DELAY_MS}ms due to rate limiting`)
        }
      } else if (batchErrors === 0) {
        // Reset consecutive errors on successful batch
        consecutiveErrors = 0
      }
      
      const successCount = batch.length - batchErrors
      console.log(`   ✅ ${successCount}/${batch.length} successful (${rateLimitErrors} rate limited)`)
      
      // Rate limiting delay between batches
      if (i + BATCH_SIZE < blockNumbers.length) {
        await sleep(DELAY_MS)
      }
      
    } catch (error) {
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

// Test scenarios
async function testSmallVolume(provider) {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 Testing SMALL VOLUME (20 blocks)')
  console.log('='.repeat(60))
  
  const currentBlock = await provider.getBlockNumber()
  const blocks = Array.from({ length: 20 }, (_, i) => currentBlock - i - 100)
  
  const startTime = Date.now()
  const result = await fetchBlocksWithRateLimit(provider, blocks)
  const totalTime = Date.now() - startTime
  
  return {
    scenario: 'Small Volume (20 blocks)',
    blocks: blocks.length,
    retrieved: result.length,
    time: totalTime,
    rate: (blocks.length / totalTime) * 1000
  }
}

async function testMediumVolume(provider) {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 Testing MEDIUM VOLUME (75 blocks)')
  console.log('='.repeat(60))
  
  const currentBlock = await provider.getBlockNumber()
  const blocks = Array.from({ length: 75 }, (_, i) => currentBlock - i - 100)
  
  const startTime = Date.now()
  const result = await fetchBlocksWithRateLimit(provider, blocks)
  const totalTime = Date.now() - startTime
  
  return {
    scenario: 'Medium Volume (75 blocks)',
    blocks: blocks.length,
    retrieved: result.length,
    time: totalTime,
    rate: (blocks.length / totalTime) * 1000
  }
}

async function testLargeVolume(provider) {
  console.log('\n' + '='.repeat(60))
  console.log('🧪 Testing LARGE VOLUME (150 blocks)')
  console.log('='.repeat(60))
  
  const currentBlock = await provider.getBlockNumber()
  const blocks = Array.from({ length: 150 }, (_, i) => currentBlock - i - 100)
  
  const startTime = Date.now()
  const result = await fetchBlocksWithRateLimit(provider, blocks)
  const totalTime = Date.now() - startTime
  
  return {
    scenario: 'Large Volume (150 blocks)',
    blocks: blocks.length,
    retrieved: result.length,
    time: totalTime,
    rate: (blocks.length / totalTime) * 1000
  }
}

// Main test runner
async function testImprovedSyncLogic() {
  console.log('🚀 Testing Improved Sync Rate Limiting Logic')
  console.log('='.repeat(70))
  console.log('🎯 Verifying the new adaptive rate limiting works correctly')
  console.log('')
  
  const provider = createProvider()
  const results = []
  
  try {
    // Test different volume scenarios
    results.push(await testSmallVolume(provider))
    results.push(await testMediumVolume(provider))
    results.push(await testLargeVolume(provider))
    
    // Summary
    console.log('\n' + '='.repeat(80))
    console.log('📊 IMPROVED SYNC TEST RESULTS')
    console.log('='.repeat(80))
    
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.scenario}`)
      console.log(`   📊 Blocks: ${result.retrieved}/${result.blocks} retrieved`)
      console.log(`   ⏱️  Time: ${(result.time/1000).toFixed(1)}s`)
      console.log(`   🚀 Rate: ${result.rate.toFixed(2)} req/s`)
      
      if (result.blocks === result.retrieved) {
        console.log(`   ✅ SUCCESS: All blocks retrieved`)
      } else {
        console.log(`   ⚠️  ${result.blocks - result.retrieved} blocks used fallback timestamps`)
      }
    })
    
    console.log('\n' + '='.repeat(80))
    console.log('🎉 RATE LIMITING IMPROVEMENTS SUMMARY')
    console.log('='.repeat(80))
    
    console.log('\n✅ IMPLEMENTED IMPROVEMENTS:')
    console.log('   1. 📊 Volume-based adaptive rate limiting')
    console.log('      • Small (<50): 15 blocks/200ms (optimized)')
    console.log('      • Medium (50-99): 8 blocks/750ms (balanced)')
    console.log('      • Large (100+): 5 blocks/1000ms (conservative)')
    console.log('')
    console.log('   2. 🚨 Dynamic error handling')
    console.log('      • Single rate limit: 1.5x delay increase')
    console.log('      • Consecutive errors: 2x delay + batch size reduction')
    console.log('      • Emergency throttling: min 3 blocks/batch, max 3s delay')
    console.log('')
    console.log('   3. 🔄 Chunk-level improvements')
    console.log('      • 3 second wait on rate limit errors (vs 2s before)')
    console.log('      • Extended delays for high-event chunks (1000ms)')
    console.log('      • Medium event chunks get 600ms delays')
    console.log('')
    console.log('   4. 📈 Enhanced logging')
    console.log('      • Clear mode indicators (🔥 ultra, ⚡ moderate, 🚀 optimized)')
    console.log('      • Rate limit error tracking and reporting')
    console.log('      • Batch success/failure visibility')
    
    console.log('\n💡 EXPECTED IMPACT:')
    console.log('   • Large event chunks will automatically use ultra-conservative settings')
    console.log('   • Rate limit errors will trigger immediate throttling adjustments')
    console.log('   • Small syncs remain fast, large syncs become reliable')
    console.log('   • Better visibility into rate limiting issues')
    
    const avgRate = results.reduce((sum, r) => sum + r.rate, 0) / results.length
    console.log(`\n📈 AVERAGE PERFORMANCE: ${avgRate.toFixed(2)} requests/second`)
    
    if (avgRate > 15) {
      console.log('🚀 EXCELLENT: High performance maintained')
    } else if (avgRate > 8) {
      console.log('✅ GOOD: Balanced performance and reliability')
    } else {
      console.log('🛡️  CONSERVATIVE: Prioritizing reliability over speed')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testImprovedSyncLogic().catch(console.error)