const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))

console.log('🔄 Rebuilding current_state table from real blockchain events')
console.log('='.repeat(60))

const contractAddress = '0xb8ea78fcacef50d41375e44e6814ebba36bb33c4'

// Check existing data
const existingEvents = db.prepare(`
  SELECT COUNT(*) as count 
  FROM events 
  WHERE contract_address = ? COLLATE NOCASE
`).get(contractAddress.toLowerCase())

const existingStates = db.prepare(`
  SELECT COUNT(*) as count 
  FROM current_state 
  WHERE contract_address = ? COLLATE NOCASE
`).get(contractAddress.toLowerCase())

console.log(`📊 Current data:`)
console.log(`   Events: ${existingEvents.count}`)
console.log(`   States: ${existingStates.count}`)

// Delete existing current_state data for this contract
console.log(`\n🗑️  Clearing existing current_state data...`)
const deleteResult = db.prepare(`
  DELETE FROM current_state 
  WHERE contract_address = ? COLLATE NOCASE
`).run(contractAddress.toLowerCase())

console.log(`   Deleted ${deleteResult.changes} old state records`)

// Calculate current ownership from real events
console.log(`\n🧮 Calculating current token ownership from real events...`)

const currentOwners = db.prepare(`
  WITH latest_transfers AS (
    SELECT 
      token_id,
      to_address as current_owner,
      block_number,
      log_index,
      ROW_NUMBER() OVER (
        PARTITION BY token_id 
        ORDER BY block_number DESC, log_index DESC
      ) as rn
    FROM events 
    WHERE contract_address = ? COLLATE NOCASE
    AND to_address <> '0x0000000000000000000000000000000000000000'
  )
  SELECT 
    token_id,
    current_owner,
    block_number
  FROM latest_transfers 
  WHERE rn = 1
  ORDER BY current_owner
`).all(contractAddress.toLowerCase())

console.log(`📋 Found ${currentOwners.length} currently owned tokens`)

if (currentOwners.length === 0) {
  console.log('❌ No token ownership data found!')
  process.exit(1)
}

// Group by holder to count tokens per holder
const holderBalances = {}
currentOwners.forEach(owner => {
  const holder = owner.current_owner.toLowerCase()
  if (!holderBalances[holder]) {
    holderBalances[holder] = {
      address: holder,
      balance: 0,
      lastBlock: 0
    }
  }
  holderBalances[holder].balance++
  holderBalances[holder].lastBlock = Math.max(holderBalances[holder].lastBlock, owner.block_number)
})

const holders = Object.values(holderBalances)
console.log(`👥 Found ${holders.length} unique holders`)

// Show top holders
const topHolders = holders
  .sort((a, b) => b.balance - a.balance)
  .slice(0, 5)

console.log(`\n🏆 Top 5 holders:`)
topHolders.forEach((holder, index) => {
  console.log(`   ${index + 1}. ${holder.address}: ${holder.balance} tokens`)
})

// Insert real current_state data
console.log(`\n💾 Inserting real current_state data...`)

const insertCurrentState = db.prepare(`
  INSERT OR REPLACE INTO current_state (
    contract_address, 
    token_id, 
    address, 
    balance, 
    last_updated_block, 
    updated_at
  )
  VALUES (?, ?, ?, '1', ?, CURRENT_TIMESTAMP)
`)

const insertHolderStates = db.transaction((holders) => {
  let insertedCount = 0
  
  // Insert individual token ownership records
  currentOwners.forEach(owner => {
    try {
      insertCurrentState.run(
        contractAddress.toLowerCase(),
        owner.token_id,
        owner.current_owner.toLowerCase(),
        owner.block_number
      )
      insertedCount++
    } catch (error) {
      console.warn(`Failed to insert token ${owner.token_id}:`, error.message)
    }
  })
  
  return insertedCount
})

const insertedCount = insertHolderStates(currentOwners)
console.log(`   ✅ Inserted ${insertedCount} token ownership records`)

// Verify the results
const newStates = db.prepare(`
  SELECT COUNT(*) as count 
  FROM current_state 
  WHERE contract_address = ? COLLATE NOCASE
`).get(contractAddress.toLowerCase())

const newHolders = db.prepare(`
  SELECT 
    address,
    COUNT(*) as balance
  FROM current_state 
  WHERE contract_address = ? COLLATE NOCASE
  GROUP BY address
  ORDER BY balance DESC
  LIMIT 5
`).all(contractAddress.toLowerCase())

console.log(`\n✅ RESULTS:`)
console.log(`   Total state records: ${newStates.count}`)
console.log(`   Unique holders: ${holders.length}`)

console.log(`\n🏆 New top 5 holders:`)
newHolders.forEach((holder, index) => {
  console.log(`   ${index + 1}. ${holder.address}: ${holder.balance} tokens`)
})

console.log(`\n🎉 current_state table rebuilt with REAL blockchain data!`)
console.log(`   The snapshot should now show real holders instead of demo data.`)

db.close()