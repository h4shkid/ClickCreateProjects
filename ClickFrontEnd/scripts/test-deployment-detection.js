const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

const contractAddress = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'
const etherscanApiKey = process.env.ETHERSCAN_API_KEY

async function testEtherscanDetection() {
  console.log('🧪 Testing Etherscan API deployment detection')
  console.log('='.repeat(60))
  console.log(`Contract: ${contractAddress}`)
  console.log(`API Key: ${etherscanApiKey ? etherscanApiKey.slice(0, 8) + '...' : 'NOT FOUND'}`)
  
  if (!etherscanApiKey) {
    console.log('❌ No Etherscan API key found!')
    return
  }
  
  try {
    const url = `https://api.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}&apikey=${etherscanApiKey}`
    
    console.log(`\n🌐 Calling Etherscan API...`)
    console.log(`URL: ${url.replace(etherscanApiKey, 'API_KEY')}`)
    
    const response = await axios.get(url, { timeout: 10000 })
    
    console.log(`\n📊 Response Status: ${response.status}`)
    console.log(`📊 API Status: ${response.data.status}`)
    console.log(`📊 API Message: ${response.data.message}`)
    
    if (response.data.status === '1' && response.data.result && response.data.result.length > 0) {
      const creation = response.data.result[0]
      
      console.log(`\n✅ SUCCESS! Contract creation found:`)
      console.log(`   Creator: ${creation.contractCreator}`)
      console.log(`   Transaction: ${creation.txHash}`)
      
      // Parse block number from transaction hash if available
      const { ethers } = require('ethers')
      const provider = new ethers.JsonRpcProvider(
        process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT || 
        `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      )
      
      try {
        const receipt = await provider.getTransactionReceipt(creation.txHash)
        if (receipt) {
          console.log(`   Block Number: ${receipt.blockNumber}`)
          console.log(`   Block Hash: ${receipt.blockHash}`)
          
          const block = await provider.getBlock(receipt.blockNumber)
          if (block) {
            console.log(`   Deployment Date: ${new Date(block.timestamp * 1000).toISOString()}`)
          }
          
          // Verify this matches expected block
          if (receipt.blockNumber === 16671072) {
            console.log(`\n🎉 PERFECT! Detected block matches expected: 16671072`)
          } else {
            console.log(`\n⚠️  Block mismatch! Expected: 16671072, Got: ${receipt.blockNumber}`)
          }
        }
      } catch (providerError) {
        console.warn('⚠️  Could not get transaction details:', providerError.message)
      }
      
    } else {
      console.log(`\n❌ No contract creation data found`)
      console.log(`Response:`, JSON.stringify(response.data, null, 2))
    }
    
  } catch (error) {
    console.error(`\n❌ Error testing Etherscan API:`, error.message)
    if (error.response) {
      console.log(`Response status: ${error.response.status}`)
      console.log(`Response data:`, error.response.data)
    }
  }
}

testEtherscanDetection()