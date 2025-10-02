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

// ERC-1155 ABI
const ERC1155_ABI = [
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
  "function balanceOf(address account, uint256 id) view returns (uint256)"
]

async function checkCompleteSeasonHolders() {
  console.log('🔍 Quick Complete Season Holders Check')
  console.log('=' * 50)
  
  const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
  db.pragma('journal_mode = WAL')
  
  // Get some top holders who might be complete (holders with most tokens)
  console.log('📋 Getting top holders from database...')
  const topHolders = db.prepare(`
    SELECT 
      address,
      COUNT(DISTINCT token_id) as tokens_owned,
      SUM(CAST(balance AS INTEGER)) as total_balance
    FROM current_state 
    WHERE contract_address = ? COLLATE NOCASE
    AND CAST(balance AS INTEGER) > 0
    GROUP BY address
    ORDER BY COUNT(DISTINCT token_id) DESC, SUM(CAST(balance AS INTEGER)) DESC
    LIMIT 100
  `).all(CONTRACT_ADDRESS.toLowerCase())
  
  console.log(`📊 Checking top ${topHolders.length} holders...`)
  
  // Create provider and contract
  const provider = createProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_ABI, provider)
  
  // Define season groups
  const seasons = [
    { name: 'Season 1', tokens: Array.from({length: 50}, (_, i) => (i + 2).toString()) },
    { name: 'Season 2', tokens: Array.from({length: 39}, (_, i) => (i + 53).toString()) },
    { name: 'Season 3', tokens: Array.from({length: 5}, (_, i) => (i + 92).toString()) },
    { name: 'SubPasses', tokens: ['1', '52'] },
    { name: 'All Collection', tokens: Array.from({length: 96}, (_, i) => (i + 1).toString()) }
  ]
  
  // Store results
  const results = {}
  
  for (const season of seasons) {
    console.log(`\n🎯 Checking ${season.name} (${season.tokens.length} tokens)...`)
    
    const completeHolders = []
    let checked = 0
    
    for (const holder of topHolders) {
      if (holder.tokens_owned >= season.tokens.length) {
        try {
          // Check if this holder has all tokens in the season
          const accounts = Array(season.tokens.length).fill(holder.address)
          const balances = await contract.balanceOfBatch(accounts, season.tokens)
          
          let hasAllTokens = true
          let totalBalance = 0
          
          for (let i = 0; i < balances.length; i++) {
            const balance = parseInt(balances[i].toString())
            if (balance === 0) {
              hasAllTokens = false
              break
            }
            totalBalance += balance
          }
          
          if (hasAllTokens) {
            completeHolders.push({
              address: holder.address,
              totalBalance: totalBalance,
              dbTokens: holder.tokens_owned,
              dbBalance: holder.total_balance
            })
            console.log(`   ✅ ${holder.address.slice(0, 12)}... (${totalBalance} tokens)`)
          }
          
          checked++
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
          
        } catch (error) {
          console.log(`   ❌ Error checking ${holder.address.slice(0, 12)}...: ${error.message}`)
        }
      }
      
      // Stop if we've found enough or checked enough
      if (completeHolders.length >= 50 || checked >= 50) {
        break
      }
    }
    
    results[season.name] = completeHolders
    console.log(`   📊 Found ${completeHolders.length} complete ${season.name} holders`)
    
    // Compare with database results
    const dbComplete = db.prepare(`
      SELECT COUNT(*) as count
      FROM (
        SELECT address
        FROM current_state 
        WHERE contract_address = ? COLLATE NOCASE
        AND token_id IN (${season.tokens.map(() => '?').join(',')})
        AND CAST(balance AS INTEGER) > 0
        GROUP BY address
        HAVING COUNT(DISTINCT token_id) = ?
      )
    `).get(CONTRACT_ADDRESS.toLowerCase(), ...season.tokens, season.tokens.length)
    
    console.log(`   🔄 Database shows: ${dbComplete.count} complete holders`)
    console.log(`   🆚 Blockchain shows: ${completeHolders.length} complete holders (from top ${checked} checked)`)
    
    if (completeHolders.length > dbComplete.count) {
      console.log(`   🚨 Found ${completeHolders.length - dbComplete.count} MORE complete holders than database!`)
    }
  }
  
  // Summary
  console.log('\n📈 Summary:')
  console.log('-' * 40)
  for (const [seasonName, holders] of Object.entries(results)) {
    console.log(`${seasonName}: ${holders.length} complete holders found`)
    
    if (holders.length > 0) {
      console.log(`   Top holder: ${holders[0].address.slice(0, 12)}... (${holders[0].totalBalance} tokens)`)
    }
  }
  
  db.close()
  console.log('\n✅ Quick check complete!')
}

checkCompleteSeasonHolders().catch(error => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})