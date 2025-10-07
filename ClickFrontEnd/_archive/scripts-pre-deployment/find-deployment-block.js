const { ethers } = require('ethers')

const contractAddress = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'

// Create provider
const provider = new ethers.JsonRpcProvider(
  process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT || 
  `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
)

async function findDeploymentBlock() {
  console.log(`🔍 Finding deployment block for: ${contractAddress}`)
  
  try {
    // Get current block
    const currentBlock = await provider.getBlockNumber()
    console.log(`📊 Current block: ${currentBlock}`)
    
    // Binary search to find deployment block
    let low = 1
    let high = currentBlock
    let deploymentBlock = null
    
    console.log(`🔎 Searching between blocks ${low} and ${high}...`)
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2)
      console.log(`📍 Checking block ${mid}...`)
      
      try {
        const code = await provider.getCode(contractAddress, mid)
        
        if (code === '0x') {
          // Contract doesn't exist at this block, search higher
          low = mid + 1
        } else {
          // Contract exists, this could be deployment block or later
          deploymentBlock = mid
          high = mid - 1
        }
      } catch (error) {
        console.warn(`⚠️  Error checking block ${mid}:`, error.message)
        // If we get an error, try to continue
        low = mid + 1
      }
    }
    
    if (deploymentBlock) {
      console.log(`🎉 Contract deployment found at block: ${deploymentBlock}`)
      
      // Get the block details
      try {
        const block = await provider.getBlock(deploymentBlock)
        console.log(`📅 Deployment date: ${new Date(block.timestamp * 1000).toISOString()}`)
        
        // Search for creation transaction in this block
        const logs = await provider.getLogs({
          fromBlock: deploymentBlock,
          toBlock: deploymentBlock,
          address: contractAddress
        })
        
        if (logs.length > 0) {
          console.log(`📋 Found ${logs.length} events in deployment block`)
          console.log(`🏷️  First transaction: ${logs[0].transactionHash}`)
        }
        
      } catch (blockError) {
        console.warn('Could not get block details:', blockError.message)
      }
      
      return deploymentBlock
    } else {
      console.log('❌ Could not find deployment block')
      return null
    }
    
  } catch (error) {
    console.error('❌ Error finding deployment block:', error)
    return null
  }
}

// Alternative approach: check some common early blocks
async function checkEarlyBlocks() {
  console.log('\n🔍 Checking some early blocks for reference...')
  
  const testBlocks = [
    18000000, // September 2023
    19000000, // January 2024  
    20000000, // May 2024
    21000000, // August 2024
    22000000, // November 2024
  ]
  
  for (const blockNum of testBlocks) {
    try {
      const code = await provider.getCode(contractAddress, blockNum)
      const exists = code !== '0x'
      console.log(`   Block ${blockNum}: ${exists ? '✅ Contract exists' : '❌ No contract'}`)
      
      if (exists) {
        const block = await provider.getBlock(blockNum)
        console.log(`     Date: ${new Date(block.timestamp * 1000).toDateString()}`)
      }
    } catch (error) {
      console.log(`   Block ${blockNum}: ❌ Error checking`)
    }
  }
}

async function main() {
  await checkEarlyBlocks()
  
  console.log('\n' + '='.repeat(50))
  const deploymentBlock = await findDeploymentBlock()
  
  if (deploymentBlock) {
    console.log(`\n✅ RESULT: Contract deployed at block ${deploymentBlock}`)
    console.log(`\nTo update the database, run:`)
    console.log(`sqlite3 ./data/nft-snapshot.db "UPDATE contracts SET deployment_block = ${deploymentBlock} WHERE address = '${contractAddress}' COLLATE NOCASE"`)
  }
}

main()