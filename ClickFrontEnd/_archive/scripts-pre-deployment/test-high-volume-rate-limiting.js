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

// Create synthetic high-volume scenario
function createHighVolumeScenario(blockCount = 100) {
  console.log(`🎯 Creating synthetic high-volume scenario with ${blockCount} blocks`)
  
  const provider = createProvider()
  return provider.getBlockNumber().then(currentBlock => {
    // Generate a realistic distribution of block numbers (many recent, some older)
    const blocks = []
    
    // 60% recent blocks (last 1000 blocks) - high activity period
    const recentCount = Math.floor(blockCount * 0.6)
    for (let i = 0; i < recentCount; i++) {
      blocks.push(currentBlock - Math.floor(Math.random() * 1000))
    }
    
    // 30% medium-age blocks (1000-10000 blocks ago)
    const mediumCount = Math.floor(blockCount * 0.3)
    for (let i = 0; i < mediumCount; i++) {
      blocks.push(currentBlock - 1000 - Math.floor(Math.random() * 9000))
    }
    
    // 10% older blocks (10000+ blocks ago)
    const oldCount = blockCount - recentCount - mediumCount
    for (let i = 0; i < oldCount; i++) {
      blocks.push(currentBlock - 10000 - Math.floor(Math.random() * 50000))
    }
    
    // Remove duplicates and sort
    const uniqueBlocks = [...new Set(blocks)].sort((a, b) => b - a)
    
    console.log(`📊 Generated ${uniqueBlocks.length} unique blocks for testing`)
    console.log(`   Recent blocks (last 1000): ${uniqueBlocks.filter(b => b > currentBlock - 1000).length}`)
    console.log(`   Medium blocks (1k-10k ago): ${uniqueBlocks.filter(b => b <= currentBlock - 1000 && b > currentBlock - 10000).length}`)
    console.log(`   Older blocks (10k+ ago): ${uniqueBlocks.filter(b => b <= currentBlock - 10000).length}`)
    
    return uniqueBlocks
  })
}

// Current approach (from sync route)
async function testCurrentApproach(provider, blockNumbers) {
  console.log(`\n📊 Testing CURRENT APPROACH (15 blocks/batch, 200ms delay)`)
  const startTime = Date.now()
  const BATCH_SIZE = 15
  const DELAY_MS = 200
  let errors = 0
  let rateLimitErrors = 0
  
  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE)
    
    console.log(`🕐 Fetching blocks batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(blockNumbers.length/BATCH_SIZE)} (${batch.length} blocks)`)
    
    try {
      const blockPromises = batch.map(blockNum => 
        provider.getBlock(blockNum).catch(err => {
          if (err.message.includes('request limit') || err.message.includes('rate limit')) {
            rateLimitErrors++
            console.warn(`🚫 Rate limited: block ${blockNum}`)
          } else {
            console.warn(`❌ Failed block ${blockNum}: ${err.message}`)
          }
          errors++
          return { number: blockNum, timestamp: Math.floor(Date.now() / 1000) }
        })
      )
      
      const blocks = await Promise.all(blockPromises)
      const successCount = batch.length - errors
      console.log(`   ✅ ${successCount}/${batch.length} successful`)
      
      if (i + BATCH_SIZE < blockNumbers.length) {
        await sleep(DELAY_MS)
      }
    } catch (error) {
      console.error(`❌ Batch error:`, error.message)
      errors += batch.length
    }
  }
  
  const totalTime = Date.now() - startTime
  const requestsPerSecond = (blockNumbers.length / totalTime) * 1000
  
  return {
    name: 'Current Approach (15/200ms)',
    totalTime,
    requestsPerSecond,
    errors,
    rateLimitErrors,
    successRate: ((blockNumbers.length - errors) / blockNumbers.length * 100)
  }
}

// Ultra conservative approach
async function testUltraConservative(provider, blockNumbers) {
  console.log(`\n📊 Testing ULTRA CONSERVATIVE (5 blocks/batch, 1000ms delay)`)
  const startTime = Date.now()
  const BATCH_SIZE = 5
  const DELAY_MS = 1000
  let errors = 0
  let rateLimitErrors = 0
  
  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE)
    
    console.log(`🕐 Fetching blocks batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(blockNumbers.length/BATCH_SIZE)} (${batch.length} blocks)`)
    
    try {
      const blockPromises = batch.map(blockNum => 
        provider.getBlock(blockNum).catch(err => {
          if (err.message.includes('request limit') || err.message.includes('rate limit')) {
            rateLimitErrors++
            console.warn(`🚫 Rate limited: block ${blockNum}`)
          } else {
            console.warn(`❌ Failed block ${blockNum}: ${err.message}`)
          }
          errors++
          return { number: blockNum, timestamp: Math.floor(Date.now() / 1000) }
        })
      )
      
      const blocks = await Promise.all(blockPromises)
      const successCount = batch.length - errors
      console.log(`   ✅ ${successCount}/${batch.length} successful`)
      
      if (i + BATCH_SIZE < blockNumbers.length) {
        await sleep(DELAY_MS)
      }
    } catch (error) {
      console.error(`❌ Batch error:`, error.message)
      errors += batch.length
    }
  }
  
  const totalTime = Date.now() - startTime
  const requestsPerSecond = (blockNumbers.length / totalTime) * 1000
  
  return {
    name: 'Ultra Conservative (5/1000ms)',
    totalTime,
    requestsPerSecond,
    errors,
    rateLimitErrors,
    successRate: ((blockNumbers.length - errors) / blockNumbers.length * 100)
  }
}

// Dynamic adaptive approach
async function testDynamicApproach(provider, blockNumbers) {
  console.log(`\n📊 Testing DYNAMIC ADAPTIVE (starts 8/500ms, adjusts based on errors)`)
  const startTime = Date.now()
  let BATCH_SIZE = 8
  let DELAY_MS = 500
  let errors = 0
  let rateLimitErrors = 0
  let consecutiveErrors = 0
  
  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE)
    let batchErrors = 0
    
    console.log(`🕐 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(blockNumbers.length/BATCH_SIZE)} (${batch.length} blocks, ${BATCH_SIZE}/${DELAY_MS}ms)`)
    
    try {
      const blockPromises = batch.map(blockNum => 
        provider.getBlock(blockNum).catch(err => {
          if (err.message.includes('request limit') || err.message.includes('rate limit')) {
            rateLimitErrors++
            console.warn(`🚫 Rate limited: block ${blockNum}`)
          } else {
            console.warn(`❌ Failed block ${blockNum}: ${err.message}`)
          }
          batchErrors++
          errors++
          return { number: blockNum, timestamp: Math.floor(Date.now() / 1000) }
        })
      )
      
      const blocks = await Promise.all(blockPromises)
      const successCount = batch.length - batchErrors
      console.log(`   ✅ ${successCount}/${batch.length} successful`)
      
      // Dynamic adjustment logic
      if (batchErrors > 0) {
        consecutiveErrors++
        if (consecutiveErrors >= 2) {
          // More aggressive throttling
          DELAY_MS = Math.min(DELAY_MS * 1.8, 2000)
          BATCH_SIZE = Math.max(BATCH_SIZE - 2, 3)
          console.log(`🔻 Throttling: batch size → ${BATCH_SIZE}, delay → ${DELAY_MS}ms (${consecutiveErrors} consecutive errors)`)
        }
      } else {
        consecutiveErrors = 0
        // Gradually optimize if no errors
        if (DELAY_MS > 300) {
          DELAY_MS = Math.max(DELAY_MS * 0.9, 300)
        }
        if (BATCH_SIZE < 10 && DELAY_MS <= 500) {
          BATCH_SIZE = Math.min(BATCH_SIZE + 1, 10)
        }
      }
      
      if (i + BATCH_SIZE < blockNumbers.length) {
        await sleep(DELAY_MS)
      }
    } catch (error) {
      console.error(`❌ Batch error:`, error.message)
      errors += batch.length
      consecutiveErrors++
    }
  }
  
  const totalTime = Date.now() - startTime
  const requestsPerSecond = (blockNumbers.length / totalTime) * 1000
  
  return {
    name: 'Dynamic Adaptive',
    totalTime,
    requestsPerSecond,
    errors,
    rateLimitErrors,
    successRate: ((blockNumbers.length - errors) / blockNumbers.length * 100)
  }
}

// Main test runner
async function runHighVolumeRateLimitTests() {
  console.log('🚀 High-Volume Rate Limiting Tests')
  console.log('='.repeat(70))
  console.log('🎯 Simulating real-world high-traffic NFT collection sync')
  console.log('')
  
  const provider = createProvider()
  
  try {
    // Create high-volume test scenario (100 unique blocks)
    const testBlocks = await createHighVolumeScenario(100)
    
    console.log(`\n📝 Testing ${testBlocks.length} block timestamp fetches`)
    console.log('🚨 This simulates the exact scenario causing rate limit issues')
    console.log('')
    
    const results = []
    
    // Test all approaches
    results.push(await testCurrentApproach(provider, testBlocks))
    results.push(await testUltraConservative(provider, testBlocks))  
    results.push(await testDynamicApproach(provider, testBlocks))
    
    // Analysis
    console.log('\n' + '='.repeat(80))
    console.log('📊 HIGH-VOLUME RATE LIMITING RESULTS')
    console.log('='.repeat(80))
    
    results.forEach((result, index) => {
      const status = result.rateLimitErrors === 0 ? '✅' : result.rateLimitErrors < 10 ? '⚠️' : '❌'
      console.log(`\n${index + 1}. ${status} ${result.name}`)
      console.log(`   ⏱️  Total time: ${(result.totalTime/1000).toFixed(1)}s (${result.totalTime}ms)`)
      console.log(`   🚀 Rate: ${result.requestsPerSecond.toFixed(2)} requests/second`)
      console.log(`   ✅ Success: ${result.successRate.toFixed(1)}%`)
      console.log(`   ❌ Errors: ${result.errors} total`)
      console.log(`   🚫 Rate limits: ${result.rateLimitErrors}`)
      
      if (result.rateLimitErrors === 0) {
        console.log(`   🎯 PERFECT: No rate limit errors!`)
      } else if (result.rateLimitErrors < 5) {
        console.log(`   ✨ GOOD: Minimal rate limiting`)
      } else {
        console.log(`   ⚠️  NEEDS WORK: Too many rate limit errors`)
      }
    })
    
    // Find winner
    const winner = results
      .filter(r => r.rateLimitErrors < 5) // Must have minimal rate limiting
      .sort((a, b) => a.totalTime - b.totalTime)[0] || results[0]
    
    console.log('\n' + '='.repeat(80))
    console.log('🏆 RECOMMENDED SOLUTION')
    console.log('='.repeat(80))
    
    console.log(`\n🥇 Winner: ${winner.name}`)
    console.log(`   🎯 Rate limit errors: ${winner.rateLimitErrors}`)
    console.log(`   ⏱️  Time: ${(winner.totalTime/1000).toFixed(1)}s`)
    console.log(`   📈 Success rate: ${winner.successRate.toFixed(1)}%`)
    
    if (winner.name.includes('Ultra Conservative')) {
      console.log('\n🔧 PRODUCTION SETTINGS:')
      console.log('```typescript')
      console.log('// Ultra conservative for high-event chunks')
      console.log('const BATCH_SIZE = 5')
      console.log('const DELAY_MS = 1000')
      console.log('')
      console.log('// Estimated rate: ~4-5 requests/second')
      console.log('// Time for 100 blocks: ~25 seconds')
      console.log('// Time for 1000 blocks: ~4-5 minutes')
      console.log('```')
    } else if (winner.name.includes('Dynamic')) {
      console.log('\n🔧 PRODUCTION SETTINGS:')
      console.log('```typescript')
      console.log('// Dynamic adaptive approach')
      console.log('let BATCH_SIZE = 8')
      console.log('let DELAY_MS = 500')
      console.log('let consecutiveErrors = 0')
      console.log('')
      console.log('// Adjust on errors:')
      console.log('if (batchErrors > 0) {')
      console.log('  consecutiveErrors++')
      console.log('  if (consecutiveErrors >= 2) {')
      console.log('    DELAY_MS = Math.min(DELAY_MS * 1.8, 2000)')
      console.log('    BATCH_SIZE = Math.max(BATCH_SIZE - 2, 3)')
      console.log('  }')
      console.log('}')
      console.log('```')
    }
    
    console.log('\n💡 IMPLEMENTATION RECOMMENDATIONS:')
    console.log('1. Update fetchBlocksWithRateLimit() in sync route')
    console.log('2. Add chunk size detection (if many events, use conservative settings)')
    console.log('3. Implement retry logic with exponential backoff')
    console.log('4. Add progress logging for large chunks')
    console.log('5. Monitor rate limit errors in production logs')
    
    if (winner.rateLimitErrors === 0) {
      console.log('\n🎉 SUCCESS: This approach should eliminate rate limit issues!')
    } else {
      console.log('\n⚠️  Still some rate limiting - consider even more conservative settings')
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

runHighVolumeRateLimitTests().catch(console.error)