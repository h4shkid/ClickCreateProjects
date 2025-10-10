import { ethers } from 'ethers'

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
if (!ALCHEMY_API_KEY) {
  console.error('❌ NEXT_PUBLIC_ALCHEMY_API_KEY required')
  process.exit(1)
}

async function checkLatestBlock() {
  const provider = new ethers.JsonRpcProvider(
    `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
  )

  const contractAddress = '0x33fd426905f149f8376e227d0c9d3340aad17af1'
  const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

  console.log('🔍 Checking latest blockchain state...\n')

  // Get current block number
  const currentBlock = await provider.getBlockNumber()
  console.log(`📊 Current blockchain height: ${currentBlock}`)

  // Get latest events for this contract
  console.log(`\n🔍 Fetching latest events from blocks ${currentBlock - 2000} to ${currentBlock}...`)

  const logs = await provider.getLogs({
    address: contractAddress,
    fromBlock: currentBlock - 2000,
    toBlock: currentBlock,
    topics: [[TRANSFER_EVENT_SIGNATURE]]
  })

  if (logs.length === 0) {
    console.log('❌ No events found in last 2000 blocks')
  } else {
    console.log(`✅ Found ${logs.length} events in last 2000 blocks\n`)

    // Group by block
    const byBlock: Record<number, number> = {}
    logs.forEach(log => {
      byBlock[log.blockNumber] = (byBlock[log.blockNumber] || 0) + 1
    })

    const blocks = Object.keys(byBlock).map(Number).sort((a, b) => b - a)
    console.log(`📊 Latest 10 blocks with events:`)
    blocks.slice(0, 10).forEach(block => {
      console.log(`   Block ${block}: ${byBlock[block]} events`)
    })

    console.log(`\n📊 Highest block with events: ${blocks[0]}`)
  }

  // Check specifically if any events exist after 23543079
  console.log(`\n🔍 Checking for events after block 23543079...`)
  const newLogs = await provider.getLogs({
    address: contractAddress,
    fromBlock: 23543080,
    toBlock: currentBlock,
    topics: [[TRANSFER_EVENT_SIGNATURE]]
  })

  if (newLogs.length === 0) {
    console.log('❌ NO new events found after block 23543079')
    console.log('   Database is UP TO DATE! 23543079 is the correct last synced block.')
  } else {
    console.log(`✅ Found ${newLogs.length} NEW events after block 23543079`)
    const newBlocks: Record<number, number> = {}
    newLogs.forEach(log => {
      newBlocks[log.blockNumber] = (newBlocks[log.blockNumber] || 0) + 1
    })
    const sortedNew = Object.keys(newBlocks).map(Number).sort((a, b) => a - b)
    console.log(`   First new event at block: ${sortedNew[0]}`)
    console.log(`   Latest new event at block: ${sortedNew[sortedNew.length - 1]}`)
  }
}

checkLatestBlock().catch(console.error)
