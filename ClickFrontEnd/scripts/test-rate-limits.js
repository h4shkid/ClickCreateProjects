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

// Test rate limits by sending requests as fast as possible
async function testMaxRequestRate(provider, requestCount = 100) {
  console.log(`\n🔥 Testing MAX request rate (${requestCount} requests, no delays)`)
  const startTime = Date.now()
  let errors = 0
  let rateLimitErrors = 0
  
  const currentBlock = await provider.getBlockNumber()
  
  const promises = Array.from({ length: requestCount }, async (_, i) => {
    try {
      const block = await provider.getBlock(currentBlock - i)
      return { success: true, blockNumber: block.number }
    } catch (error) {
      if (error.message.includes('request limit') || error.message.includes('rate limit')) {
        rateLimitErrors++
      }
      errors++
      return { success: false, error: error.message }
    }
  })
  
  const results = await Promise.allSettled(promises)
  const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length
  
  const totalTime = Date.now() - startTime
  const actualRequestsPerSecond = (requestCount / totalTime) * 1000
  
  console.log(`✅ Max Rate Results:`)
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Requests per second: ${actualRequestsPerSecond.toFixed(2)}`)
  console.log(`   Success rate: ${(successCount / requestCount * 100).toFixed(1)}% (${successCount}/${requestCount})`)
  console.log(`   Total errors: ${errors}`)
  console.log(`   Rate limit errors: ${rateLimitErrors}`)
  
  return { actualRequestsPerSecond, successCount, errors, rateLimitErrors }
}

// Test controlled request rates
async function testControlledRate(provider, targetRequestsPerSecond, duration = 10000) {
  console.log(`\n⚡ Testing CONTROLLED rate (${targetRequestsPerSecond} req/s for ${duration}ms)`)
  const startTime = Date.now()
  let requestCount = 0
  let errors = 0
  let rateLimitErrors = 0
  
  const intervalMs = 1000 / targetRequestsPerSecond
  const currentBlock = await provider.getBlockNumber()
  
  while (Date.now() - startTime < duration) {
    const requestStartTime = Date.now()
    
    try {
      await provider.getBlock(currentBlock - requestCount)
      requestCount++
    } catch (error) {
      if (error.message.includes('request limit') || error.message.includes('rate limit')) {
        rateLimitErrors++
      }
      errors++
    }
    
    const requestTime = Date.now() - requestStartTime
    const sleepTime = Math.max(0, intervalMs - requestTime)
    
    if (sleepTime > 0) {
      await sleep(sleepTime)
    }
  }
  
  const totalTime = Date.now() - startTime
  const actualRequestsPerSecond = (requestCount / totalTime) * 1000
  const successRate = ((requestCount - errors) / requestCount * 100)
  
  console.log(`✅ Controlled Rate Results (${targetRequestsPerSecond} req/s target):`)
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Requests made: ${requestCount}`)
  console.log(`   Actual req/s: ${actualRequestsPerSecond.toFixed(2)}`)
  console.log(`   Success rate: ${successRate.toFixed(1)}%`)
  console.log(`   Total errors: ${errors}`)
  console.log(`   Rate limit errors: ${rateLimitErrors}`)
  
  return { actualRequestsPerSecond, requestCount, errors, rateLimitErrors, successRate }
}

// Test burst vs sustained rates
async function testBurstPattern(provider, burstSize, burstDelayMs, sustainedRate) {
  console.log(`\n💥 Testing BURST pattern (${burstSize} requests, then ${burstDelayMs}ms pause, ${sustainedRate} req/s)`)
  const startTime = Date.now()
  let totalRequests = 0
  let errors = 0
  let rateLimitErrors = 0
  const duration = 30000 // 30 seconds
  
  const currentBlock = await provider.getBlockNumber()
  
  while (Date.now() - startTime < duration) {
    // Burst phase
    const burstPromises = Array.from({ length: burstSize }, async (_, i) => {
      try {
        await provider.getBlock(currentBlock - totalRequests - i)
        return { success: true }
      } catch (error) {
        if (error.message.includes('request limit') || error.message.includes('rate limit')) {
          rateLimitErrors++
        }
        return { success: false, error: error.message }
      }
    })
    
    const burstResults = await Promise.allSettled(burstPromises)
    const burstErrors = burstResults.filter(r => r.status === 'fulfilled' && !r.value.success).length
    
    totalRequests += burstSize
    errors += burstErrors
    
    console.log(`  💥 Burst of ${burstSize}: ${burstSize - burstErrors} success, ${burstErrors} errors`)
    
    // Pause between bursts
    await sleep(burstDelayMs)
    
    // Sustained rate phase
    const sustainedDuration = 5000 // 5 seconds of sustained rate
    const sustainedStartTime = Date.now()
    const intervalMs = 1000 / sustainedRate
    
    while (Date.now() - sustainedStartTime < sustainedDuration && Date.now() - startTime < duration) {
      const requestStartTime = Date.now()
      
      try {
        await provider.getBlock(currentBlock - totalRequests)
        totalRequests++
      } catch (error) {
        if (error.message.includes('request limit') || error.message.includes('rate limit')) {
          rateLimitErrors++
        }
        errors++
      }
      
      const requestTime = Date.now() - requestStartTime
      const sleepTime = Math.max(0, intervalMs - requestTime)
      
      if (sleepTime > 0) {
        await sleep(sleepTime)
      }
    }
  }
  
  const totalTime = Date.now() - startTime
  const actualRequestsPerSecond = (totalRequests / totalTime) * 1000
  const successRate = ((totalRequests - errors) / totalRequests * 100)
  
  console.log(`✅ Burst Pattern Results:`)
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Total requests: ${totalRequests}`)
  console.log(`   Average req/s: ${actualRequestsPerSecond.toFixed(2)}`)
  console.log(`   Success rate: ${successRate.toFixed(1)}%`)
  console.log(`   Total errors: ${errors}`)
  console.log(`   Rate limit errors: ${rateLimitErrors}`)
  
  return { actualRequestsPerSecond, totalRequests, errors, rateLimitErrors, successRate }
}

// Main test runner
async function runRateLimitTests() {
  console.log('🚀 Starting Rate Limit Testing')
  console.log('='.repeat(60))
  
  const provider = createProvider()
  
  try {
    // Test 1: Find absolute maximum rate
    const maxRateResult = await testMaxRequestRate(provider, 100)
    
    // Test 2: Conservative rates
    const results = []
    
    for (const targetRate of [20, 30, 40, 50, 60]) {
      const result = await testControlledRate(provider, targetRate, 15000)
      results.push({
        name: `${targetRate} req/s controlled`,
        targetRate,
        ...result
      })
      
      // Small pause between tests
      await sleep(2000)
    }
    
    // Test 3: Burst patterns
    const burstResult = await testBurstPattern(provider, 10, 1000, 30)
    
    // Analysis
    console.log('\n' + '='.repeat(80))
    console.log('📊 RATE LIMIT ANALYSIS')
    console.log('='.repeat(80))
    
    console.log('\n1. MAXIMUM RATE TEST:')
    console.log(`   Peak performance: ${maxRateResult.actualRequestsPerSecond.toFixed(1)} req/s`)
    console.log(`   Rate limit threshold: ${maxRateResult.rateLimitErrors > 0 ? 'EXCEEDED' : 'NOT REACHED'}`)
    
    console.log('\n2. CONTROLLED RATE TESTS:')
    const successfulRates = results.filter(r => r.successRate > 95)
    const reliableRates = results.filter(r => r.rateLimitErrors === 0)
    
    results.forEach(result => {
      const status = result.rateLimitErrors === 0 ? '✅' : result.successRate > 95 ? '⚠️' : '❌'
      console.log(`   ${status} ${result.name}: ${result.successRate.toFixed(1)}% success, ${result.rateLimitErrors} rate limit errors`)
    })
    
    console.log('\n3. OPTIMAL SETTINGS RECOMMENDATION:')
    
    if (reliableRates.length > 0) {
      const bestReliable = reliableRates[reliableRates.length - 1] // Highest rate with no errors
      console.log(`   ✅ Recommended rate: ${bestReliable.targetRate} req/s`)
      console.log(`   💡 This rate had ${bestReliable.successRate.toFixed(1)}% success with no rate limit errors`)
      
      // Calculate optimal batch settings
      const optimalBatchSize = Math.floor(bestReliable.targetRate / 4) // 4 batches per second
      const optimalDelay = 250 // 250ms between batches
      
      console.log('')
      console.log('   🔧 RECOMMENDED SYNC SETTINGS:')
      console.log(`   • Block fetch batch size: ${optimalBatchSize}`)
      console.log(`   • Delay between batches: ${optimalDelay}ms`)
      console.log(`   • Expected rate: ~${bestReliable.targetRate} requests/second`)
      console.log('')
      console.log('   📝 UPDATE YOUR SYNC CODE:')
      console.log(`   const BATCH_SIZE = ${optimalBatchSize}`)
      console.log(`   const DELAY_MS = ${optimalDelay}`)
      
    } else {
      console.log('   ⚠️  All rates encountered errors - your provider has strict limits')
      console.log('   💡 Recommend starting with 10-15 req/s and increasing gradually')
    }
    
    if (burstResult.rateLimitErrors === 0) {
      console.log('\n   💥 Burst pattern worked well - can handle occasional spikes')
    } else {
      console.log('\n   ⚠️  Burst pattern triggered rate limits - stick to steady rates')
    }
    
  } catch (error) {
    console.error('❌ Test error:', error)
  }
}

// Run the tests
runRateLimitTests().catch(console.error)