const Database = require('better-sqlite3')
const path = require('path')
const { ethers } = require('ethers')
const axios = require('axios')

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))

console.log('📝 Adding internal collection to database')
console.log('='.repeat(50))

const contractAddress = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'

// Check if contract already exists
const existingContract = db.prepare(`
  SELECT id, name, symbol FROM contracts 
  WHERE address = ? COLLATE NOCASE
`).get(contractAddress.toLowerCase())

if (existingContract) {
  console.log(`✅ Contract already exists: ${existingContract.name} (${existingContract.symbol}) - ID: ${existingContract.id}`)
  process.exit(0)
}

console.log(`🔍 Detecting contract type for: ${contractAddress}`)

// Create provider for contract detection
const provider = new ethers.JsonRpcProvider(
  process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT || 
  `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
)

async function detectDeploymentBlock(address) {
  console.log(`🔍 Detecting deployment block for: ${address}`)
  
  const etherscanApiKey = process.env.ETHERSCAN_API_KEY
  
  // Method 1: Try Etherscan API (fastest)
  if (etherscanApiKey) {
    try {
      const url = `https://api.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${etherscanApiKey}`
      console.log(`🌐 Calling Etherscan API...`)
      
      const response = await axios.get(url, { timeout: 10000 })
      
      if (response.data.status === '1' && response.data.result && response.data.result.length > 0) {
        const creation = response.data.result[0]
        const txHash = creation.txHash
        
        // Get transaction receipt to get block number
        const receipt = await provider.getTransactionReceipt(txHash)
        
        if (receipt) {
          console.log(`✅ Etherscan found deployment at block ${receipt.blockNumber}`)
          console.log(`   Transaction: ${txHash}`)
          return receipt.blockNumber
        }
      }
    } catch (error) {
      console.warn('⚠️  Etherscan API failed, trying fallback method:', error.message)
    }
  }
  
  // Method 2: Fallback - use a reasonable default for old contracts
  console.log('🔄 Using conservative fallback deployment block')
  return 16000000 // Conservative estimate for most ERC-1155 contracts
}

async function detectContractType(address) {
  try {
    // ERC-721 interface
    const erc721Interface = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function supportsInterface(bytes4) view returns (bool)'
    ]
    
    const contract = new ethers.Contract(address, erc721Interface, provider)
    
    // Try to get basic info
    const [name, symbol] = await Promise.all([
      contract.name().catch(() => 'Unknown Collection'),
      contract.symbol().catch(() => 'UNKNOWN')
    ])
    
    // Check for ERC-721 support (interface ID: 0x80ac58cd)
    const supportsERC721 = await contract.supportsInterface('0x80ac58cd').catch(() => false)
    
    // Check for ERC-1155 support (interface ID: 0xd9b67a26)
    const supportsERC1155 = await contract.supportsInterface('0xd9b67a26').catch(() => false)
    
    let contractType = 'ERC721' // Default to ERC721
    if (supportsERC1155) {
      contractType = 'ERC1155'
    } else if (supportsERC721) {
      contractType = 'ERC721'
    }
    
    console.log(`   Name: ${name}`)
    console.log(`   Symbol: ${symbol}`)
    console.log(`   Type: ${contractType}`)
    console.log(`   ERC-721 Support: ${supportsERC721}`)
    console.log(`   ERC-1155 Support: ${supportsERC1155}`)
    
    return { name, symbol, contractType }
  } catch (error) {
    console.error('❌ Error detecting contract:', error.message)
    // Fallback values
    return {
      name: 'ClickCreate Collection',
      symbol: 'CLICK',
      contractType: 'ERC1155'
    }
  }
}

async function addContract() {
  try {
    const contractInfo = await detectContractType(contractAddress)
    const deploymentBlock = await detectDeploymentBlock(contractAddress)
    
    console.log(`\n💾 Adding contract to database...`)
    
    const insertContract = db.prepare(`
      INSERT INTO contracts (
        address, 
        name, 
        symbol, 
        contract_type, 
        chain_id, 
        deployment_block,
        is_verified, 
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    
    const result = insertContract.run(
      contractAddress.toLowerCase(),
      contractInfo.name,
      contractInfo.symbol,
      contractInfo.contractType,
      1, // Ethereum mainnet
      deploymentBlock,
      1  // Mark as verified since it's internal use
    )
    
    console.log(`✅ Contract added successfully!`)
    console.log(`   ID: ${result.lastInsertRowid}`)
    console.log(`   Name: ${contractInfo.name}`)
    console.log(`   Symbol: ${contractInfo.symbol}`)
    console.log(`   Type: ${contractInfo.contractType}`)
    console.log(`   Chain: Ethereum (1)`)
    console.log(`   Deployment Block: ${deploymentBlock}`)
    
    // Verify the insertion
    const verifyContract = db.prepare(`
      SELECT id, address, name, symbol, contract_type, chain_id, is_verified, created_at
      FROM contracts 
      WHERE address = ? COLLATE NOCASE
    `).get(contractAddress.toLowerCase())
    
    if (verifyContract) {
      console.log(`\n🔍 Verification successful:`)
      console.log(`   Database ID: ${verifyContract.id}`)
      console.log(`   Address: ${verifyContract.address}`)
      console.log(`   Created: ${verifyContract.created_at}`)
      console.log(`\n🎉 The internal collection is now ready for blockchain syncing!`)
    } else {
      console.log(`❌ Verification failed - contract not found in database`)
    }
    
  } catch (error) {
    console.error('❌ Error adding contract:', error)
    process.exit(1)
  } finally {
    db.close()
  }
}

// Run the script
addContract()