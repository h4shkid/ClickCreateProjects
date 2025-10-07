const { ethers } = require('ethers')
require('dotenv').config()

// Create provider
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

// Test 1: Sequential block fetching
async function testSequentialFetching(provider, blockNumbers, delayMs = 0) {
  console.log(`\n📊 Testing SEQUENTIAL fetching (${blockNumbers.length} blocks, ${delayMs}ms delay)`)
  const startTime = Date.now()
  let errors = 0
  
  const results = []
  for (const blockNum of blockNumbers) {
    try {
      const block = await provider.getBlock(blockNum)
      results.push(block)
      if (delayMs > 0) await sleep(delayMs)
    } catch (error) {
      errors++
      console.warn(`❌ Failed to fetch block ${blockNum}: ${error.message}`)
    }
  }
  
  const totalTime = Date.now() - startTime
  const avgTime = totalTime / blockNumbers.length
  const requestsPerSecond = (blockNumbers.length / totalTime) * 1000
  
  console.log(`✅ Sequential Results:`)
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Average per block: ${avgTime.toFixed(2)}ms`)
  console.log(`   Requests per second: ${requestsPerSecond.toFixed(2)}`)
  console.log(`   Success rate: ${((blockNumbers.length - errors) / blockNumbers.length * 100).toFixed(1)}%`)
  
  return { totalTime, avgTime, requestsPerSecond, errors, results }
}

// Test 2: Parallel batch fetching
async function testBatchFetching(provider, blockNumbers, batchSize, delayMs = 0) {
  console.log(`\n📊 Testing BATCH fetching (${blockNumbers.length} blocks, batch size: ${batchSize}, ${delayMs}ms delay)`)
  const startTime = Date.now()
  let errors = 0
  
  const results = []
  for (let i = 0; i < blockNumbers.length; i += batchSize) {
    const batch = blockNumbers.slice(i, i + batchSize)
    
    try {
      const blockPromises = batch.map(blockNum => 
        provider.getBlock(blockNum).catch(err => {
          errors++
          console.warn(`❌ Failed block ${blockNum}: ${err.message}`)
          return null
        })
      )
      
      const blocks = await Promise.all(blockPromises)
      results.push(...blocks.filter(block => block !== null))
      
      if (delayMs > 0 && i + batchSize < blockNumbers.length) {
        await sleep(delayMs)
      }
    } catch (error) {
      console.error(`❌ Batch error:`, error.message)
      errors += batch.length
    }
  }
  
  const totalTime = Date.now() - startTime
  const avgTime = totalTime / blockNumbers.length
  const requestsPerSecond = (blockNumbers.length / totalTime) * 1000
  
  console.log(`✅ Batch Results (${batchSize} per batch):`)
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Average per block: ${avgTime.toFixed(2)}ms`)
  console.log(`   Requests per second: ${requestsPerSecond.toFixed(2)}`)
  console.log(`   Success rate: ${((blockNumbers.length - errors) / blockNumbers.length * 100).toFixed(1)}%`)
  
  return { totalTime, avgTime, requestsPerSecond, errors, results }
}

// Test 3: Rate-limited bulk fetching
async function testRateLimitedFetching(provider, blockNumbers, maxRequestsPerSecond) {
  console.log(`\n📊 Testing RATE LIMITED fetching (${blockNumbers.length} blocks, max ${maxRequestsPerSecond} req/s)`)
  const startTime = Date.now()
  let errors = 0
  
  const delayMs = 1000 / maxRequestsPerSecond
  const results = []
  
  for (const blockNum of blockNumbers) {
    try {
      const block = await provider.getBlock(blockNum)
      results.push(block)
      await sleep(delayMs)
    } catch (error) {
      errors++
      console.warn(`❌ Failed to fetch block ${blockNum}: ${error.message}`)
    }
  }
  
  const totalTime = Date.now() - startTime
  const avgTime = totalTime / blockNumbers.length
  const actualRequestsPerSecond = (blockNumbers.length / totalTime) * 1000
  
  console.log(`✅ Rate Limited Results (${maxRequestsPerSecond} req/s target):`)
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Average per block: ${avgTime.toFixed(2)}ms`)
  console.log(`   Actual requests per second: ${actualRequestsPerSecond.toFixed(2)}`)
  console.log(`   Success rate: ${((blockNumbers.length - errors) / blockNumbers.length * 100).toFixed(1)}%`)
  
  return { totalTime, avgTime, requestsPerSecond: actualRequestsPerSecond, errors, results }
}

// Main test runner
async function runBlockFetchingTests() {
  console.log('🚀 Starting Block Fetching Performance Tests')
  console.log('='.repeat(60))
  
  const provider = createProvider()
  
  // Get recent block numbers for testing
  const currentBlock = await provider.getBlockNumber()
  const testBlockCount = 50 // Test with 50 blocks
  const testBlocks = Array.from(
    { length: testBlockCount }, 
    (_, i) => currentBlock - i - 100 // Start from 100 blocks ago
  )
  
  console.log(`📝 Testing with ${testBlockCount} blocks starting from ${testBlocks[0]}`)
  
  const results = []
  
  try {
    // Test 1: Sequential with no delay
    results.push({
      name: 'Sequential (no delay)',
      ...(await testSequentialFetching(provider, testBlocks, 0))
    })
    
    // Test 2: Sequential with 50ms delay
    results.push({
      name: 'Sequential (50ms delay)',
      ...(await testSequentialFetching(provider, testBlocks, 50))
    })
    
    // Test 3: Batch size 5
    results.push({
      name: 'Batch size 5',
      ...(await testBatchFetching(provider, testBlocks, 5, 0))
    })
    
    // Test 4: Batch size 10
    results.push({
      name: 'Batch size 10',
      ...(await testBatchFetching(provider, testBlocks, 10, 0))
    })
    
    // Test 5: Batch size 20
    results.push({
      name: 'Batch size 20',
      ...(await testBatchFetching(provider, testBlocks, 20, 0))
    })
    
    // Test 6: Batch size 10 with 100ms delay
    results.push({
      name: 'Batch size 10 (100ms delay)',
      ...(await testBatchFetching(provider, testBlocks, 10, 100))
    })
    
    // Test 7: Rate limited to 30 req/s
    results.push({
      name: 'Rate limited 30 req/s',
      ...(await testRateLimitedFetching(provider, testBlocks, 30))
    })
    
    // Test 8: Rate limited to 40 req/s
    results.push({
      name: 'Rate limited 40 req/s',
      ...(await testRateLimitedFetching(provider, testBlocks, 40))
    })
    
  } catch (error) {
    console.error('❌ Test error:', error)
  }
  
  // Summary report
  console.log('\n' + '='.repeat(80))
  console.log('📊 PERFORMANCE SUMMARY')
  console.log('='.repeat(80))
  
  results.sort((a, b) => a.totalTime - b.totalTime)
  
  console.log('Ranked by total time (fastest first):')
  console.log('')
  
  results.forEach((result, index) => {
    const successRate = ((testBlockCount - result.errors) / testBlockCount * 100).toFixed(1)
    console.log(`${index + 1}. ${result.name}`)
    console.log(`   ⏱️  ${result.totalTime}ms total | ${result.avgTime.toFixed(1)}ms avg | ${result.requestsPerSecond.toFixed(1)} req/s`)
    console.log(`   ✅ ${successRate}% success rate (${result.errors} errors)`)
    console.log('')
  })
  
  const fastest = results[0]
  console.log(`🏆 WINNER: ${fastest.name}`)
  console.log(`   Best performance: ${fastest.totalTime}ms total, ${fastest.requestsPerSecond.toFixed(1)} req/s`)
  console.log('')
  console.log('💡 RECOMMENDATIONS:')
  
  if (fastest.requestsPerSecond > 45) {
    console.log('   ⚠️  Very high request rate - may hit rate limits in production')
    console.log('   💭 Consider adding small delays or reducing batch size')
  } else if (fastest.requestsPerSecond < 10) {
    console.log('   🐌 Low request rate - could be faster')
    console.log('   💭 Consider increasing batch size or reducing delays')
  } else {
    console.log('   ✅ Good balance of speed and stability')
  }
  
  if (fastest.errors > 0) {
    console.log(`   ⚠️  ${fastest.errors} errors occurred - consider more conservative approach`)
  }
}

// Run the tests
runBlockFetchingTests().catch(console.error)