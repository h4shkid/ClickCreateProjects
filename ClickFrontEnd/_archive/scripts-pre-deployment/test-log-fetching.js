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

// Test 1: Sequential chunk processing
async function testSequentialChunks(provider, startBlock, endBlock, chunkSize, delayMs = 0) {
  console.log(`\n📊 Testing SEQUENTIAL chunks (${chunkSize} blocks/chunk, ${delayMs}ms delay)`)
  const startTime = Date.now()
  let totalLogs = 0
  let errors = 0
  
  for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, endBlock)
    
    try {
      const logs = await provider.getLogs({
        address: TEST_CONTRACT,
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: [TRANSFER_EVENT_SIGNATURE]
      })
      
      totalLogs += logs.length
      console.log(`  📦 Blocks ${fromBlock}-${toBlock}: ${logs.length} events`)
      
      if (delayMs > 0) await sleep(delayMs)
    } catch (error) {
      errors++
      console.warn(`❌ Failed chunk ${fromBlock}-${toBlock}: ${error.message}`)
    }
  }
  
  const totalTime = Date.now() - startTime
  const totalBlocks = endBlock - startBlock + 1
  const chunks = Math.ceil(totalBlocks / chunkSize)
  const avgTimePerChunk = totalTime / chunks
  const blocksPerSecond = (totalBlocks / totalTime) * 1000
  
  console.log(`✅ Sequential Results:`)
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Chunks processed: ${chunks}`)
  console.log(`   Average per chunk: ${avgTimePerChunk.toFixed(2)}ms`)
  console.log(`   Blocks per second: ${blocksPerSecond.toFixed(2)}`)
  console.log(`   Total events found: ${totalLogs}`)
  console.log(`   Success rate: ${((chunks - errors) / chunks * 100).toFixed(1)}%`)
  
  return { totalTime, avgTimePerChunk, blocksPerSecond, errors, totalLogs, chunks }
}

// Test 2: Parallel chunk processing
async function testParallelChunks(provider, startBlock, endBlock, chunkSize, concurrency = 3, delayMs = 0) {
  console.log(`\n📊 Testing PARALLEL chunks (${chunkSize} blocks/chunk, ${concurrency} concurrent, ${delayMs}ms delay)`)
  const startTime = Date.now()
  let totalLogs = 0
  let errors = 0
  
  const chunks = []
  for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, endBlock)
    chunks.push({ fromBlock, toBlock })
  }
  
  // Process chunks in parallel batches
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency)
    
    try {
      const promises = batch.map(async ({ fromBlock, toBlock }) => {
        try {
          const logs = await provider.getLogs({
            address: TEST_CONTRACT,
            fromBlock: fromBlock,
            toBlock: toBlock,
            topics: [TRANSFER_EVENT_SIGNATURE]
          })
          console.log(`  📦 Blocks ${fromBlock}-${toBlock}: ${logs.length} events`)
          return logs.length
        } catch (error) {
          console.warn(`❌ Failed chunk ${fromBlock}-${toBlock}: ${error.message}`)
          throw error
        }
      })
      
      const results = await Promise.allSettled(promises)
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          totalLogs += result.value
        } else {
          errors++
        }
      })
      
      if (delayMs > 0 && i + concurrency < chunks.length) {
        await sleep(delayMs)
      }
    } catch (error) {
      console.error(`❌ Batch error:`, error.message)
      errors += batch.length
    }
  }
  
  const totalTime = Date.now() - startTime
  const totalBlocks = endBlock - startBlock + 1
  const avgTimePerChunk = totalTime / chunks.length
  const blocksPerSecond = (totalBlocks / totalTime) * 1000
  
  console.log(`✅ Parallel Results (${concurrency} concurrent):`)
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Chunks processed: ${chunks.length}`)
  console.log(`   Average per chunk: ${avgTimePerChunk.toFixed(2)}ms`)
  console.log(`   Blocks per second: ${blocksPerSecond.toFixed(2)}`)
  console.log(`   Total events found: ${totalLogs}`)
  console.log(`   Success rate: ${((chunks.length - errors) / chunks.length * 100).toFixed(1)}%`)
  
  return { totalTime, avgTimePerChunk, blocksPerSecond, errors, totalLogs, chunks: chunks.length }
}

// Test 3: Adaptive chunk sizing
async function testAdaptiveChunks(provider, startBlock, endBlock, initialChunkSize = 1000) {
  console.log(`\n📊 Testing ADAPTIVE chunks (starting with ${initialChunkSize} blocks/chunk)`)
  const startTime = Date.now()
  let totalLogs = 0
  let errors = 0
  let chunkSize = initialChunkSize
  let chunks = 0
  
  for (let fromBlock = startBlock; fromBlock <= endBlock; fromBlock += chunkSize) {
    const toBlock = Math.min(fromBlock + chunkSize - 1, endBlock)
    chunks++
    
    try {
      const chunkStartTime = Date.now()
      
      const logs = await provider.getLogs({
        address: TEST_CONTRACT,
        fromBlock: fromBlock,
        toBlock: toBlock,
        topics: [TRANSFER_EVENT_SIGNATURE]
      })
      
      const chunkTime = Date.now() - chunkStartTime
      totalLogs += logs.length
      
      console.log(`  📦 Blocks ${fromBlock}-${toBlock} (size: ${chunkSize}): ${logs.length} events in ${chunkTime}ms`)
      
      // Adaptive sizing based on response time and events found
      if (chunkTime > 3000) {
        // Too slow, reduce chunk size
        chunkSize = Math.max(100, Math.floor(chunkSize * 0.7))
        console.log(`  🔻 Reducing chunk size to ${chunkSize} (slow response)`)
      } else if (chunkTime < 500 && logs.length < 50) {
        // Fast and few events, increase chunk size
        chunkSize = Math.min(5000, Math.floor(chunkSize * 1.5))
        console.log(`  🔺 Increasing chunk size to ${chunkSize} (fast response)`)
      }
      
    } catch (error) {
      errors++
      console.warn(`❌ Failed chunk ${fromBlock}-${toBlock}: ${error.message}`)
      
      // On error, reduce chunk size significantly
      chunkSize = Math.max(100, Math.floor(chunkSize * 0.5))
      console.log(`  🔻 Reducing chunk size to ${chunkSize} (error recovery)`)
    }
  }
  
  const totalTime = Date.now() - startTime
  const totalBlocks = endBlock - startBlock + 1
  const avgTimePerChunk = totalTime / chunks
  const blocksPerSecond = (totalBlocks / totalTime) * 1000
  
  console.log(`✅ Adaptive Results:`)
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   Chunks processed: ${chunks}`)
  console.log(`   Average per chunk: ${avgTimePerChunk.toFixed(2)}ms`)
  console.log(`   Blocks per second: ${blocksPerSecond.toFixed(2)}`)
  console.log(`   Total events found: ${totalLogs}`)
  console.log(`   Final chunk size: ${chunkSize}`)
  console.log(`   Success rate: ${((chunks - errors) / chunks * 100).toFixed(1)}%`)
  
  return { totalTime, avgTimePerChunk, blocksPerSecond, errors, totalLogs, chunks }
}

// Main test runner
async function runLogFetchingTests() {
  console.log('🚀 Starting Log Fetching Performance Tests')
  console.log('='.repeat(60))
  
  const provider = createProvider()
  
  // Test range: 5000 blocks (should have decent amount of events)
  const currentBlock = await provider.getBlockNumber()
  const endBlock = currentBlock - 100  // Start from 100 blocks ago
  const startBlock = endBlock - 4999   // 5000 blocks total
  
  console.log(`📝 Testing ${endBlock - startBlock + 1} blocks from ${startBlock} to ${endBlock}`)
  console.log(`📋 Contract: ${TEST_CONTRACT}`)
  console.log('')
  
  const results = []
  
  try {
    // Test 1: Sequential 500 block chunks
    results.push({
      name: 'Sequential 500-block chunks',
      ...(await testSequentialChunks(provider, startBlock, endBlock, 500, 0))
    })
    
    // Test 2: Sequential 1000 block chunks  
    results.push({
      name: 'Sequential 1000-block chunks',
      ...(await testSequentialChunks(provider, startBlock, endBlock, 1000, 0))
    })
    
    // Test 3: Sequential 2000 block chunks
    results.push({
      name: 'Sequential 2000-block chunks',
      ...(await testSequentialChunks(provider, startBlock, endBlock, 2000, 0))
    })
    
    // Test 4: Sequential 1000 blocks with 250ms delay
    results.push({
      name: 'Sequential 1000-block (250ms delay)',
      ...(await testSequentialChunks(provider, startBlock, endBlock, 1000, 250))
    })
    
    // Test 5: Parallel 1000 blocks, 2 concurrent
    results.push({
      name: 'Parallel 1000-block (2 concurrent)',
      ...(await testParallelChunks(provider, startBlock, endBlock, 1000, 2, 0))
    })
    
    // Test 6: Parallel 500 blocks, 3 concurrent
    results.push({
      name: 'Parallel 500-block (3 concurrent)',
      ...(await testParallelChunks(provider, startBlock, endBlock, 500, 3, 0))
    })
    
    // Test 7: Parallel with delay
    results.push({
      name: 'Parallel 1000-block (2 concurrent, 500ms delay)',
      ...(await testParallelChunks(provider, startBlock, endBlock, 1000, 2, 500))
    })
    
    // Test 8: Adaptive sizing
    results.push({
      name: 'Adaptive chunk sizing',
      ...(await testAdaptiveChunks(provider, startBlock, endBlock, 1000))
    })
    
  } catch (error) {
    console.error('❌ Test error:', error)
  }
  
  // Summary report
  console.log('\n' + '='.repeat(80))
  console.log('📊 LOG FETCHING PERFORMANCE SUMMARY')
  console.log('='.repeat(80))
  
  results.sort((a, b) => a.totalTime - b.totalTime)
  
  console.log('Ranked by total time (fastest first):')
  console.log('')
  
  results.forEach((result, index) => {
    const successRate = ((result.chunks - result.errors) / result.chunks * 100).toFixed(1)
    console.log(`${index + 1}. ${result.name}`)
    console.log(`   ⏱️  ${result.totalTime}ms total | ${result.avgTimePerChunk.toFixed(1)}ms avg/chunk | ${result.blocksPerSecond.toFixed(1)} blocks/s`)
    console.log(`   📊 ${result.totalLogs} events | ${result.chunks} chunks | ${successRate}% success`)
    console.log('')
  })
  
  const fastest = results[0]
  console.log(`🏆 WINNER: ${fastest.name}`)
  console.log(`   Best performance: ${fastest.totalTime}ms total, ${fastest.blocksPerSecond.toFixed(1)} blocks/s`)
  console.log('')
  
  console.log('💡 SYNC OPTIMIZATION RECOMMENDATIONS:')
  console.log('')
  
  if (fastest.errors === 0) {
    console.log(`✅ Zero errors - ${fastest.name} is very reliable`)
  } else {
    console.log(`⚠️  ${fastest.errors} errors in fastest method - consider backup strategy`)
  }
  
  if (fastest.blocksPerSecond > 2000) {
    console.log('🚀 Excellent performance - can sync large ranges quickly')
  } else if (fastest.blocksPerSecond > 1000) {
    console.log('✅ Good performance - reasonable for production use')
  } else {
    console.log('🐌 Slower performance - consider optimization or smaller chunks')
  }
  
  // Find best balance of speed and reliability
  const reliableResults = results.filter(r => r.errors === 0)
  if (reliableResults.length > 0) {
    const mostReliable = reliableResults[0]
    console.log('')
    console.log(`💎 MOST RELIABLE: ${mostReliable.name}`)
    console.log(`   Zero errors with ${mostReliable.blocksPerSecond.toFixed(1)} blocks/s`)
  }
}

// Run the tests
runLogFetchingTests().catch(console.error)