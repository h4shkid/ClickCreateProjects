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
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])"
]

async function verifyCompleteHolders() {
  console.log('🔍 Verifying ALL Database Complete Holders vs Blockchain')
  console.log('=' * 60)
  
  const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
  db.pragma('journal_mode = WAL')
  
  // Create provider and contract
  const provider = createProvider()
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_ABI, provider)
  
  // Focus on Season 3 first (since it showed discrepancy)
  const season3Tokens = ['92', '93', '94', '95', '96']
  
  console.log('🎯 Verifying ALL Season 3 complete holders from database...')
  
  // Get ALL addresses that database claims are complete for Season 3
  const dbCompleteHolders = db.prepare(`
    SELECT 
      address,
      COUNT(DISTINCT token_id) as tokens_owned,
      SUM(CAST(balance AS INTEGER)) as total_balance
    FROM current_state 
    WHERE contract_address = ? COLLATE NOCASE
    AND token_id IN ('92','93','94','95','96')
    AND CAST(balance AS INTEGER) > 0
    GROUP BY address
    HAVING COUNT(DISTINCT token_id) = 5
    ORDER BY SUM(CAST(balance AS INTEGER)) DESC
  `).all(CONTRACT_ADDRESS.toLowerCase())
  
  console.log(`📋 Database claims ${dbCompleteHolders.length} complete Season 3 holders`)
  console.log('🔍 Verifying each one on blockchain...')
  
  let actualCompleteCount = 0
  let falsePositives = []
  let verified = []
  
  for (let i = 0; i < dbCompleteHolders.length; i++) {
    const holder = dbCompleteHolders[i]
    
    try {
      console.log(`   ${i + 1}/${dbCompleteHolders.length} Checking ${holder.address.slice(0, 12)}... (DB: ${holder.total_balance} tokens)`)
      
      // Check all Season 3 tokens for this address
      const accounts = Array(season3Tokens.length).fill(holder.address)
      const balances = await contract.balanceOfBatch(accounts, season3Tokens)
      
      let isActuallyComplete = true
      let blockchainTotal = 0
      let missingTokens = []
      
      for (let j = 0; j < balances.length; j++) {
        const balance = parseInt(balances[j].toString())
        blockchainTotal += balance
        
        if (balance === 0) {
          isActuallyComplete = false
          missingTokens.push(season3Tokens[j])
        }
      }
      
      if (isActuallyComplete) {
        actualCompleteCount++
        verified.push({
          address: holder.address,
          dbBalance: holder.total_balance,
          blockchainBalance: blockchainTotal
        })
        
        if (holder.total_balance !== blockchainTotal) {
          console.log(`      ✅ Complete (but balance diff: DB=${holder.total_balance}, BC=${blockchainBalance})`)
        } else {
          console.log(`      ✅ Complete and matches`)
        }
      } else {
        falsePositives.push({
          address: holder.address,
          dbBalance: holder.total_balance,
          blockchainBalance: blockchainTotal,
          missingTokens: missingTokens
        })
        console.log(`      ❌ NOT complete - missing tokens: ${missingTokens.join(', ')}`)
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 150))
      
    } catch (error) {
      console.log(`      🚫 Error checking ${holder.address.slice(0, 12)}...: ${error.message}`)
    }
  }
  
  console.log('\n📊 Season 3 Verification Results:')
  console.log('-' * 50)
  console.log(`Database claimed: ${dbCompleteHolders.length} complete holders`)
  console.log(`Blockchain verified: ${actualCompleteCount} complete holders`)
  console.log(`False positives: ${falsePositives.length}`)
  console.log(`Accuracy: ${((actualCompleteCount / dbCompleteHolders.length) * 100).toFixed(1)}%`)
  
  if (falsePositives.length > 0) {
    console.log('\n❌ False Positives (DB says complete, blockchain says incomplete):')
    falsePositives.forEach((fp, idx) => {
      console.log(`   ${idx + 1}. ${fp.address.slice(0, 12)}... missing: ${fp.missingTokens.join(', ')}`)
    })
  }
  
  if (verified.length !== actualCompleteCount) {
    console.log('\n⚠️  Some verification mismatches detected')
  }
  
  // Now let's verify SubPasses as well
  console.log('\n🎯 Verifying SubPasses complete holders...')
  
  const subpassTokens = ['1', '52']
  const dbSubpassHolders = db.prepare(`
    SELECT 
      address,
      COUNT(DISTINCT token_id) as tokens_owned,
      SUM(CAST(balance AS INTEGER)) as total_balance
    FROM current_state 
    WHERE contract_address = ? COLLATE NOCASE
    AND token_id IN ('1','52')
    AND CAST(balance AS INTEGER) > 0
    GROUP BY address
    HAVING COUNT(DISTINCT token_id) = 2
    ORDER BY SUM(CAST(balance AS INTEGER)) DESC
  `).all(CONTRACT_ADDRESS.toLowerCase())
  
  console.log(`📋 Database claims ${dbSubpassHolders.length} complete SubPass holders`)
  
  let subpassActualComplete = 0
  let subpassFalsePositives = []
  
  for (let i = 0; i < dbSubpassHolders.length; i++) {
    const holder = dbSubpassHolders[i]
    
    try {
      console.log(`   ${i + 1}/${dbSubpassHolders.length} Checking ${holder.address.slice(0, 12)}...`)
      
      const accounts = Array(subpassTokens.length).fill(holder.address)
      const balances = await contract.balanceOfBatch(accounts, subpassTokens)
      
      let isComplete = true
      let blockchainTotal = 0
      let missingTokens = []
      
      for (let j = 0; j < balances.length; j++) {
        const balance = parseInt(balances[j].toString())
        blockchainTotal += balance
        
        if (balance === 0) {
          isComplete = false
          missingTokens.push(subpassTokens[j])
        }
      }
      
      if (isComplete) {
        subpassActualComplete++
        console.log(`      ✅ Complete`)
      } else {
        subpassFalsePositives.push({
          address: holder.address,
          missingTokens: missingTokens
        })
        console.log(`      ❌ NOT complete - missing: ${missingTokens.join(', ')}`)
      }
      
      await new Promise(resolve => setTimeout(resolve, 150))
      
    } catch (error) {
      console.log(`      🚫 Error: ${error.message}`)
    }
  }
  
  console.log('\n📊 SubPasses Verification Results:')
  console.log('-' * 50)
  console.log(`Database claimed: ${dbSubpassHolders.length} complete holders`)
  console.log(`Blockchain verified: ${subpassActualComplete} complete holders`)
  console.log(`False positives: ${subpassFalsePositives.length}`)
  
  console.log('\n✅ Verification complete!')
  
  // Summary recommendation
  console.log('\n💡 Recommendations:')
  if (falsePositives.length > 0 || subpassFalsePositives.length > 0) {
    console.log('- Database contains stale/incorrect data')
    console.log('- Consider re-syncing or rebuilding current_state table')
    console.log('- Some holders may have transferred tokens since last sync')
  } else {
    console.log('- Database accuracy is good')
    console.log('- The "missing" holders in quick check were likely due to sample size limitation')
  }
  
  db.close()
}

verifyCompleteHolders().catch(error => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})