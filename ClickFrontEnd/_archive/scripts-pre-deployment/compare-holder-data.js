const Database = require('better-sqlite3')
const path = require('path')

const CONTRACT_ADDRESS = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'

function main() {
  console.log('🔍 Analyzing holder data differences...')
  console.log('=' * 60)
  
  const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
  db.pragma('journal_mode = WAL')
  
  // Define seasons for analysis
  const seasons = [
    { name: 'Season 1', tokens: Array.from({length: 50}, (_, i) => (i + 2).toString()) },
    { name: 'Season 2', tokens: Array.from({length: 39}, (_, i) => (i + 53).toString()) },
    { name: 'Season 3', tokens: Array.from({length: 5}, (_, i) => (i + 92).toString()) },
    { name: 'SubPasses', tokens: ['1', '52'] },
    { name: 'All Collection', tokens: Array.from({length: 96}, (_, i) => (i + 1).toString()) }
  ]
  
  console.log('📊 Complete Holder Comparison:')
  console.log('-' * 60)
  
  for (const season of seasons) {
    const expectedCount = season.tokens.length
    const placeholders = season.tokens.map(() => '?').join(',')
    
    // Get complete holders from current_state (our existing data)
    const currentStateHolders = db.prepare(`
      SELECT 
        address,
        COUNT(DISTINCT token_id) as tokens_owned,
        SUM(CAST(balance AS INTEGER)) as total_balance
      FROM current_state 
      WHERE contract_address = ? COLLATE NOCASE
      AND token_id IN (${placeholders})
      AND CAST(balance AS INTEGER) > 0
      GROUP BY address
      HAVING COUNT(DISTINCT token_id) = ?
      ORDER BY address
    `).all(CONTRACT_ADDRESS.toLowerCase(), ...season.tokens, expectedCount)
    
    // Get complete holders from fresh download
    const freshHolders = db.prepare(`
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
      ORDER BY address
    `).all(CONTRACT_ADDRESS.toLowerCase(), ...season.tokens, expectedCount)
    
    console.log(`\n🎯 ${season.name} (${expectedCount} tokens):`)
    console.log(`   Current State: ${currentStateHolders.length} complete holders`)
    console.log(`   Fresh Download: ${freshHolders.length} complete holders`)
    
    // Find differences
    const currentAddresses = new Set(currentStateHolders.map(h => h.address.toLowerCase()))
    const freshAddresses = new Set(freshHolders.map(h => h.address.toLowerCase()))
    
    const onlyInCurrent = [...currentAddresses].filter(addr => !freshAddresses.has(addr))
    const onlyInFresh = [...freshAddresses].filter(addr => !currentAddresses.has(addr))
    
    if (onlyInCurrent.length > 0) {
      console.log(`   ⚠️  Only in Current State (${onlyInCurrent.length}):`)
      onlyInCurrent.forEach(addr => console.log(`      ${addr}`))
    }
    
    if (onlyInFresh.length > 0) {
      console.log(`   🆕 Only in Fresh Download (${onlyInFresh.length}):`)
      onlyInFresh.forEach(addr => console.log(`      ${addr}`))
    }
    
    if (onlyInCurrent.length === 0 && onlyInFresh.length === 0) {
      console.log(`   ✅ Perfect match - no differences`)
    }
    
    // Check for balance differences in matching addresses
    const commonAddresses = [...currentAddresses].filter(addr => freshAddresses.has(addr))
    let balanceDifferences = 0
    
    for (const addr of commonAddresses) {
      const currentHolder = currentStateHolders.find(h => h.address.toLowerCase() === addr)
      const freshHolder = freshHolders.find(h => h.address.toLowerCase() === addr)
      
      if (currentHolder.total_balance !== freshHolder.total_balance) {
        balanceDifferences++
        if (balanceDifferences === 1) {
          console.log(`   ⚖️  Balance differences:`)
        }
        console.log(`      ${addr}: ${currentHolder.total_balance} → ${freshHolder.total_balance}`)
      }
    }
    
    if (balanceDifferences === 0 && commonAddresses.length > 0) {
      console.log(`   ✅ All balances match`)
    }
  }
  
  // Detailed analysis for missing holders
  console.log('\n🔬 Detailed Missing Holder Analysis:')
  console.log('-' * 60)
  
  // Check if fresh download found any "almost complete" holders that current_state missed
  for (const season of seasons.slice(0, 3)) { // Only check main seasons
    const expectedCount = season.tokens.length
    const placeholders = season.tokens.map(() => '?').join(',')
    
    console.log(`\n📋 ${season.name} - Almost Complete Holders:`)
    
    // Find holders with high completion rate from fresh download
    const almostComplete = db.prepare(`
      SELECT 
        address,
        COUNT(DISTINCT token_id) as tokens_owned,
        SUM(balance) as total_balance,
        ROUND(CAST(COUNT(DISTINCT token_id) AS FLOAT) / ? * 100, 2) as completion_rate
      FROM holders_analysis 
      WHERE contract_address = ? COLLATE NOCASE
      AND token_id IN (${placeholders})
      AND balance > 0
      GROUP BY address
      HAVING COUNT(DISTINCT token_id) >= ?
      ORDER BY tokens_owned DESC, total_balance DESC
      LIMIT 20
    `).all(expectedCount * 0.9, CONTRACT_ADDRESS.toLowerCase(), ...season.tokens, Math.floor(expectedCount * 0.9))
    
    almostComplete.forEach(holder => {
      const isComplete = holder.tokens_owned === expectedCount
      const status = isComplete ? '✅' : `⏳ ${holder.completion_rate}%`
      console.log(`   ${status} ${holder.address.slice(0, 12)}... ${holder.tokens_owned}/${expectedCount} (${holder.total_balance} balance)`)
    })
  }
  
  // Generate summary statistics
  console.log('\n📈 Summary Statistics:')
  console.log('-' * 40)
  
  // Total unique holders
  const totalCurrentHolders = db.prepare(`
    SELECT COUNT(DISTINCT address) as count
    FROM current_state 
    WHERE contract_address = ? COLLATE NOCASE
    AND CAST(balance AS INTEGER) > 0
  `).get(CONTRACT_ADDRESS.toLowerCase())
  
  const totalFreshHolders = db.prepare(`
    SELECT COUNT(DISTINCT address) as count
    FROM holders_analysis 
    WHERE contract_address = ? COLLATE NOCASE
    AND balance > 0
  `).get(CONTRACT_ADDRESS.toLowerCase())
  
  console.log(`Total Current State Holders: ${totalCurrentHolders.count}`)
  console.log(`Total Fresh Download Holders: ${totalFreshHolders.count}`)
  console.log(`Difference: ${totalFreshHolders.count - totalCurrentHolders.count}`)
  
  // Check data freshness
  const lastSync = db.prepare(`
    SELECT completed_at, current_block
    FROM contract_sync_status 
    WHERE contract_id = (SELECT id FROM contracts WHERE address = ? COLLATE NOCASE)
    ORDER BY completed_at DESC 
    LIMIT 1
  `).get(CONTRACT_ADDRESS.toLowerCase())
  
  if (lastSync) {
    console.log(`Last Sync: ${lastSync.completed_at} (block ${lastSync.current_block})`)
  }
  
  const downloadTime = db.prepare(`
    SELECT downloaded_at
    FROM holders_analysis 
    WHERE contract_address = ? COLLATE NOCASE
    ORDER BY downloaded_at DESC 
    LIMIT 1
  `).get(CONTRACT_ADDRESS.toLowerCase())
  
  if (downloadTime) {
    console.log(`Fresh Download: ${downloadTime.downloaded_at}`)
  }
  
  db.close()
  console.log('\n✅ Analysis complete!')
}

main()