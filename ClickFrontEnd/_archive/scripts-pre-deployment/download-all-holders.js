const { ethers } = require('ethers')
const Database = require('better-sqlite3')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const CONTRACT_ADDRESS = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'

// Create provider
function createProvider() {
  const quickNodeEndpoint = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  
  if (quickNodeEndpoint) {
    console.log('Using QuickNode endpoint')
    return new ethers.JsonRpcProvider(quickNodeEndpoint)
  } else if (alchemyKey) {
    console.log('Using Alchemy endpoint')
    return new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`)
  } else {
    console.log('Using public Ethereum endpoint')
    return new ethers.JsonRpcProvider('https://eth.llamarpc.com')
  }
}

// ERC-1155 ABI for balanceOfBatch
const ERC1155_ABI = [
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"
]

async function main() {
  console.log('🚀 Starting complete holder analysis download...')
  console.log('=' * 60)
  
  // Initialize database
  const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
  db.pragma('journal_mode = WAL')
  
  // Create holders_analysis table
  console.log('📊 Creating holders_analysis table...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS holders_analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_address TEXT NOT NULL,
      address TEXT NOT NULL,
      token_id TEXT NOT NULL,
      balance INTEGER NOT NULL,
      downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(contract_address, address, token_id)
    )
  `)
  
  // Clear existing data for this contract
  db.prepare(`
    DELETE FROM holders_analysis 
    WHERE contract_address = ? COLLATE NOCASE
  `).run(CONTRACT_ADDRESS.toLowerCase())
  
  console.log('✅ Database prepared')
  
  // Get all current holders from our existing data
  console.log('🔍 Getting current holders from database...')
  const currentHolders = db.prepare(`
    SELECT DISTINCT address 
    FROM current_state 
    WHERE contract_address = ? COLLATE NOCASE
    AND CAST(balance AS INTEGER) > 0
    ORDER BY address
  `).all(CONTRACT_ADDRESS.toLowerCase())
  
  console.log(`📋 Found ${currentHolders.length} current holders`)
  
  // Create provider and contract
  const provider = createProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_ABI, provider)
  
  // Define all 96 token IDs
  const allTokenIds = Array.from({ length: 96 }, (_, i) => (i + 1).toString())
  console.log(`🎯 Checking balances for tokens 1-96`)
  
  // Prepare batch insert
  const insertBalance = db.prepare(`
    INSERT OR REPLACE INTO holders_analysis (
      contract_address, address, token_id, balance
    ) VALUES (?, ?, ?, ?)
  `)
  
  const batchInsert = db.transaction((balances) => {
    for (const balance of balances) {
      insertBalance.run(...balance)
    }
  })
  
  let totalBalances = 0
  let processedHolders = 0
  
  // Process holders in batches (ERC-1155 balanceOfBatch has limits)
  const BATCH_SIZE = 50 // Conservative batch size for RPC calls
  
  for (let i = 0; i < currentHolders.length; i += BATCH_SIZE) {
    const holderBatch = currentHolders.slice(i, i + BATCH_SIZE)
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(currentHolders.length / BATCH_SIZE)
    
    console.log(`\n📦 Processing batch ${batchNumber}/${totalBatches} (${holderBatch.length} holders)`)
    
    try {
      // For each holder in this batch, get all their token balances
      for (const holder of holderBatch) {
        const address = holder.address
        
        try {
          // Create arrays for balanceOfBatch call
          const accounts = Array(allTokenIds.length).fill(address)
          const tokenIds = allTokenIds
          
          console.log(`   👤 Checking ${address.slice(0, 8)}...`)
          
          // Get all balances at once
          const balances = await contract.balanceOfBatch(accounts, tokenIds)
          
          // Process results
          const balancesToInsert = []
          let holderTokenCount = 0
          
          for (let j = 0; j < tokenIds.length; j++) {
            const balance = parseInt(balances[j].toString())
            
            if (balance > 0) {
              balancesToInsert.push([
                CONTRACT_ADDRESS.toLowerCase(),
                address.toLowerCase(),
                tokenIds[j],
                balance
              ])
              holderTokenCount++
              totalBalances++
            }
          }
          
          // Insert this holder's balances
          if (balancesToInsert.length > 0) {
            batchInsert(balancesToInsert)
            console.log(`      ✅ ${holderTokenCount} tokens owned`)
          } else {
            console.log(`      ⚠️  No tokens found`)
          }
          
          processedHolders++
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
          
        } catch (holderError) {
          console.error(`   ❌ Error processing ${address}:`, holderError.message)
          
          // If batch call fails, try individual calls for this holder
          console.log(`   🔄 Retrying with individual calls...`)
          
          const balancesToInsert = []
          let successCount = 0
          
          for (const tokenId of allTokenIds) {
            try {
              const balance = await contract.balanceOf(address, tokenId)
              const balanceInt = parseInt(balance.toString())
              
              if (balanceInt > 0) {
                balancesToInsert.push([
                  CONTRACT_ADDRESS.toLowerCase(),
                  address.toLowerCase(),
                  tokenId,
                  balanceInt
                ])
                successCount++
                totalBalances++
              }
              
              // Small delay between individual calls
              await new Promise(resolve => setTimeout(resolve, 50))
              
            } catch (tokenError) {
              console.log(`      ⚠️  Failed token ${tokenId}: ${tokenError.message}`)
            }
          }
          
          if (balancesToInsert.length > 0) {
            batchInsert(balancesToInsert)
            console.log(`   ✅ Recovered ${successCount} tokens via individual calls`)
          }
          
          processedHolders++
        }
      }
      
      // Batch delay
      if (i + BATCH_SIZE < currentHolders.length) {
        console.log('   ⏱️  Batch delay...')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
    } catch (batchError) {
      console.error(`❌ Batch ${batchNumber} failed:`, batchError.message)
      console.log('⏭️  Continuing with next batch...')
    }
  }
  
  console.log('\n📊 Download Summary:')
  console.log('=' * 40)
  console.log(`✅ Processed: ${processedHolders}/${currentHolders.length} holders`)
  console.log(`💾 Stored: ${totalBalances} token balances`)
  
  // Generate analysis statistics
  console.log('\n🔍 Generating analysis statistics...')
  
  // Count complete holders for each season
  const seasonStats = [
    { name: 'Season 1', tokens: Array.from({length: 50}, (_, i) => (i + 2).toString()), count: 50 },
    { name: 'Season 2', tokens: Array.from({length: 39}, (_, i) => (i + 53).toString()), count: 39 },
    { name: 'Season 3', tokens: Array.from({length: 5}, (_, i) => (i + 92).toString()), count: 5 },
    { name: 'SubPasses', tokens: ['1', '52'], count: 2 },
    { name: 'All Collection', tokens: Array.from({length: 96}, (_, i) => (i + 1).toString()), count: 96 }
  ]
  
  console.log('\n🎯 Complete Holder Analysis:')
  console.log('-' * 50)
  
  for (const season of seasonStats) {
    const placeholders = season.tokens.map(() => '?').join(',')
    const completeHolders = db.prepare(`
      SELECT 
        address,
        COUNT(DISTINCT token_id) as tokens_owned,
        SUM(balance) as total_balance
      FROM holders_analysis 
      WHERE contract_address = ? COLLATE NOCASE
      AND token_id IN (${placeholders})
      AND balance > 0
      GROUP BY address
      HAVING COUNT(DISTINCT token_id) = ?
      ORDER BY SUM(balance) DESC
    `).all(CONTRACT_ADDRESS.toLowerCase(), ...season.tokens, season.count)
    
    console.log(`${season.name}: ${completeHolders.length} complete holders`)
    
    if (completeHolders.length > 0 && completeHolders.length <= 10) {
      completeHolders.forEach((holder, idx) => {
        console.log(`  ${idx + 1}. ${holder.address.slice(0, 8)}... (${holder.total_balance} tokens)`)
      })
    }
  }
  
  // Compare with existing current_state data
  console.log('\n🆚 Comparison with current_state data:')
  console.log('-' * 50)
  
  const currentStateCount = db.prepare(`
    SELECT COUNT(DISTINCT address) as count
    FROM current_state 
    WHERE contract_address = ? COLLATE NOCASE
    AND CAST(balance AS INTEGER) > 0
  `).get(CONTRACT_ADDRESS.toLowerCase())
  
  const analysisCount = db.prepare(`
    SELECT COUNT(DISTINCT address) as count
    FROM holders_analysis 
    WHERE contract_address = ? COLLATE NOCASE
    AND balance > 0
  `).get(CONTRACT_ADDRESS.toLowerCase())
  
  console.log(`Current State DB: ${currentStateCount.count} holders`)
  console.log(`Fresh Download: ${analysisCount.count} holders`)
  console.log(`Difference: ${analysisCount.count - currentStateCount.count}`)
  
  db.close()
  console.log('\n✅ Complete holder analysis download finished!')
}

main().catch(error => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})