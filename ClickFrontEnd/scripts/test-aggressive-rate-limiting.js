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

// Test different aggressive rate limiting approaches
async function testAggressiveRateLimit1(provider, blockNumbers) {
  console.log(`\n🔥 Testing ULTRA CONSERVATIVE (5 blocks/batch, 1000ms delay)`)
  const startTime = Date.now()
  const BATCH_SIZE = 5
  const DELAY_MS = 1000
  let errors = 0
  let rateLimitErrors = 0
  
  const allBlocks = []
  
  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE)
    
    try {
      const blockPromises = batch.map(blockNum => 
        provider.getBlock(blockNum).catch(err => {
          if (err.message.includes('request limit') || err.message.includes('rate limit')) {
            rateLimitErrors++
          }
          errors++
          console.warn(`❌ Failed block ${blockNum}`)
          return { number: blockNum, timestamp: Math.floor(Date.now() / 1000) }
        })
      )
      
      const blocks = await Promise.all(blockPromises)
      allBlocks.push(...blocks)
      
      console.log(`📦 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(blockNumbers.length/BATCH_SIZE)}: ${batch.length} blocks, ${batch.length - errors} success`)
      
      if (i + BATCH_SIZE < blockNumbers.length) {
        await sleep(DELAY_MS)
      }
    } catch (error) {
      console.error(`Batch error:`, error.message)
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

async function testAggressiveRateLimit2(provider, blockNumbers) {
  console.log(`\n🔥 Testing MODERATE AGGRESSIVE (8 blocks/batch, 750ms delay)`)
  const startTime = Date.now()
  const BATCH_SIZE = 8
  const DELAY_MS = 750
  let errors = 0
  let rateLimitErrors = 0
  
  const allBlocks = []
  
  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE)
    
    try {
      const blockPromises = batch.map(blockNum => 
        provider.getBlock(blockNum).catch(err => {
          if (err.message.includes('request limit') || err.message.includes('rate limit')) {
            rateLimitErrors++
          }
          errors++
          console.warn(`❌ Failed block ${blockNum}`)
          return { number: blockNum, timestamp: Math.floor(Date.now() / 1000) }
        })
      )
      
      const blocks = await Promise.all(blockPromises)
      allBlocks.push(...blocks)
      
      console.log(`📦 Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(blockNumbers.length/BATCH_SIZE)}: ${batch.length} blocks, ${batch.length - errors} success`)
      
      if (i + BATCH_SIZE < blockNumbers.length) {
        await sleep(DELAY_MS)
      }
    } catch (error) {
      console.error(`Batch error:`, error.message)
      errors += batch.length
    }
  }
  
  const totalTime = Date.now() - startTime
  const requestsPerSecond = (blockNumbers.length / totalTime) * 1000
  
  return {
    name: 'Moderate Aggressive (8/750ms)',
    totalTime,
    requestsPerSecond,
    errors,
    rateLimitErrors,
    successRate: ((blockNumbers.length - errors) / blockNumbers.length * 100)
  }
}

async function testDynamicRateLimit(provider, blockNumbers) {
  console.log(`\n🔥 Testing DYNAMIC RATE LIMITING (adaptive based on errors)`)
  const startTime = Date.now()
  let BATCH_SIZE = 10
  let DELAY_MS = 500
  let errors = 0
  let rateLimitErrors = 0
  let consecutiveErrors = 0
  
  const allBlocks = []
  
  for (let i = 0; i < blockNumbers.length; i += BATCH_SIZE) {
    const batch = blockNumbers.slice(i, i + BATCH_SIZE)
    const batchStartTime = Date.now()
    let batchErrors = 0
    
    try {
      const blockPromises = batch.map(blockNum => 
        provider.getBlock(blockNum).catch(err => {
          if (err.message.includes('request limit') || err.message.includes('rate limit')) {
            rateLimitErrors++
          }
          batchErrors++
          errors++
          console.warn(`❌ Failed block ${blockNum}`)
          return { number: blockNum, timestamp: Math.floor(Date.now() / 1000) }
        })
      )
      
      const blocks = await Promise.all(blockPromises)
      allBlocks.push(...blocks)
      
      // Dynamic adjustment based on errors
      if (batchErrors > 0) {
        consecutiveErrors++
        if (consecutiveErrors >= 2) {
          // Increase delay and decrease batch size after consecutive errors
          DELAY_MS = Math.min(DELAY_MS * 1.5, 2000)
          BATCH_SIZE = Math.max(BATCH_SIZE - 2, 3)
          console.log(`🔻 Adjusting: batch size → ${BATCH_SIZE}, delay → ${DELAY_MS}ms`)
        }
      } else {
        consecutiveErrors = 0
        // Gradually optimize if no errors
        if (DELAY_MS > 300) {
          DELAY_MS = Math.max(DELAY_MS * 0.9, 300)
        }
      }
      
      console.log(`📦 Batch ${Math.floor(i/BATCH_SIZE) + 1}: ${batch.length} blocks, ${batch.length - batchErrors} success (${BATCH_SIZE}/${DELAY_MS}ms)`)
      
      if (i + BATCH_SIZE < blockNumbers.length) {
        await sleep(DELAY_MS)
      }
    } catch (error) {
      console.error(`Batch error:`, error.message)
      errors += batch.length
      consecutiveErrors++
    }
  }
  
  const totalTime = Date.now() - startTime
  const requestsPerSecond = (blockNumbers.length / totalTime) * 1000
  
  return {
    name: 'Dynamic Rate Limiting',
    totalTime,
    requestsPerSecond,
    errors,
    rateLimitErrors,
    successRate: ((blockNumbers.length - errors) / blockNumbers.length * 100)
  }
}

// Simulate a real chunk with many events
async function testWithRealEventChunk(provider) {
  console.log(`\n🎯 Testing with REAL event chunk (simulating large transfer volume)`)
  
  try {
    // Fetch a chunk that likely has many events
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = currentBlock - 1000
    const toBlock = currentBlock - 500
    
    console.log(`📊 Fetching events from blocks ${fromBlock} to ${toBlock}`)
    
    const logs = await provider.getLogs({
      address: TEST_CONTRACT,
      fromBlock: fromBlock,
      toBlock: toBlock,
      topics: [TRANSFER_EVENT_SIGNATURE]
    })
    
    console.log(`📋 Found ${logs.length} events`)
    
    if (logs.length === 0) {
      console.log('⚠️  No events found in this range, using synthetic test data')
      const currentBlock = await provider.getBlockNumber()
      const syntheticBlocks = Array.from({ length: 50 }, (_, i) => currentBlock - i - 100)
      return syntheticBlocks
    }
    
    // Get unique block numbers
    const uniqueBlocks = [...new Set(logs.map(log => log.blockNumber))]
    console.log(`🕐 Need to fetch timestamps for ${uniqueBlocks.length} unique blocks`)
    
    return uniqueBlocks
    
  } catch (error) {
    console.error('Error fetching real events:', error.message)
    // Fallback to synthetic data
    const currentBlock = await provider.getBlockNumber()
    return Array.from({ length: 50 }, (_, i) => currentBlock - i - 100)
  }
}

// Main test runner
async function runAggressiveRateLimitTests() {
  console.log('🚀 Testing Aggressive Rate Limiting Strategies')
  console.log('='.repeat(70))
  
  const provider = createProvider()
  
  try {
    // Get test data - either real event blocks or synthetic
    const testBlocks = await testWithRealEventChunk(provider)
    
    console.log(`\n📝 Testing with ${testBlocks.length} block timestamps`)
    console.log(`🎯 Simulating the exact scenario causing rate limit issues`)
    console.log('')
    
    const results = []
    
    // Test 1: Current optimized approach (for comparison)
    console.log(`\n📊 CURRENT APPROACH (15 blocks/batch, 200ms delay)`)
    const currentStartTime = Date.now()
    let currentErrors = 0
    let currentRateLimitErrors = 0
    
    const CURRENT_BATCH_SIZE = 15
    const CURRENT_DELAY_MS = 200
    
    for (let i = 0; i < testBlocks.length; i += CURRENT_BATCH_SIZE) {
      const batch = testBlocks.slice(i, i + CURRENT_BATCH_SIZE)
      
      try {
        const blockPromises = batch.map(blockNum => 
          provider.getBlock(blockNum).catch(err => {
            if (err.message.includes('request limit') || err.message.includes('rate limit')) {
              currentRateLimitErrors++
            }
            currentErrors++
            console.warn(`❌ Failed block ${blockNum}`)
            return { number: blockNum, timestamp: Math.floor(Date.now() / 1000) }
          })
        )
        
        const blocks = await Promise.all(blockPromises)
        console.log(`📦 Current batch ${Math.floor(i/CURRENT_BATCH_SIZE) + 1}: ${batch.length - currentErrors} success`)
        
        if (i + CURRENT_BATCH_SIZE < testBlocks.length) {
          await sleep(CURRENT_DELAY_MS)
        }
      } catch (error) {
        console.error(`Batch error:`, error.message)
        currentErrors += batch.length
      }
    }
    
    const currentTotalTime = Date.now() - currentStartTime
    const currentRequestsPerSecond = (testBlocks.length / currentTotalTime) * 1000
    
    results.push({
      name: 'Current Approach (15/200ms)',
      totalTime: currentTotalTime,
      requestsPerSecond: currentRequestsPerSecond,
      errors: currentErrors,
      rateLimitErrors: currentRateLimitErrors,
      successRate: ((testBlocks.length - currentErrors) / testBlocks.length * 100)
    })
    
    // Test aggressive approaches
    results.push(await testAggressiveRateLimit1(provider, testBlocks))
    results.push(await testAggressiveRateLimit2(provider, testBlocks))
    results.push(await testDynamicRateLimit(provider, testBlocks))
    
    // Results analysis
    console.log('\n' + '='.repeat(80))
    console.log('📊 AGGRESSIVE RATE LIMITING RESULTS')
    console.log('='.repeat(80))
    
    results.forEach((result, index) => {
      const status = result.rateLimitErrors === 0 ? '✅' : result.rateLimitErrors < 5 ? '⚠️' : '❌'
      console.log(`\n${index + 1}. ${status} ${result.name}`)
      console.log(`   ⏱️  Total time: ${result.totalTime}ms`)
      console.log(`   🚀 Requests/sec: ${result.requestsPerSecond.toFixed(2)}`)
      console.log(`   ✅ Success rate: ${result.successRate.toFixed(1)}%`)
      console.log(`   ❌ Total errors: ${result.errors}`)
      console.log(`   🚫 Rate limit errors: ${result.rateLimitErrors}`)
    })
    
    // Find best approach
    const noRateLimitErrors = results.filter(r => r.rateLimitErrors === 0)
    const bestApproach = noRateLimitErrors.length > 0 
      ? noRateLimitErrors.sort((a, b) => a.totalTime - b.totalTime)[0]
      : results.sort((a, b) => a.rateLimitErrors - b.rateLimitErrors || a.totalTime - b.totalTime)[0]
    
    console.log('\n' + '='.repeat(80))
    console.log('🏆 RECOMMENDED APPROACH')
    console.log('='.repeat(80))
    
    console.log(`\n✅ Best approach: ${bestApproach.name}`)
    console.log(`   🎯 ${bestApproach.rateLimitErrors} rate limit errors`)
    console.log(`   ⏱️  ${bestApproach.totalTime}ms total time`)
    console.log(`   📈 ${bestApproach.successRate.toFixed(1)}% success rate`)
    
    if (bestApproach.name.includes('Ultra Conservative')) {
      console.log('\n🔧 RECOMMENDED SYNC SETTINGS:')
      console.log('   const BATCH_SIZE = 5')
      console.log('   const DELAY_MS = 1000')
      console.log('   // Ultra conservative for high-traffic chunks')
    } else if (bestApproach.name.includes('Moderate Aggressive')) {
      console.log('\n🔧 RECOMMENDED SYNC SETTINGS:')
      console.log('   const BATCH_SIZE = 8')  
      console.log('   const DELAY_MS = 750')
      console.log('   // Balanced approach for most scenarios')
    } else if (bestApproach.name.includes('Dynamic')) {
      console.log('\n🔧 RECOMMENDED SYNC SETTINGS:')
      console.log('   // Use dynamic rate limiting with error-based adjustment')
      console.log('   let BATCH_SIZE = 10')
      console.log('   let DELAY_MS = 500')
      console.log('   // Adjust based on consecutive errors')
    }
    
    console.log('\n💡 NEXT STEPS:')
    console.log('   1. Implement the recommended approach in sync route')
    console.log('   2. Add dynamic adjustment based on chunk event count')
    console.log('   3. Monitor for rate limit errors in production')
    console.log('   4. Consider caching block timestamps for frequently accessed blocks')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

runAggressiveRateLimitTests().catch(console.error)