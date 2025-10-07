const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))

console.log('🔧 Fixing duplicate token records in current_state')
console.log('='.repeat(60))

const contractAddress = '0xb8ea78fcacef50d41375e44e6814ebba36bb33c4'

// Check current duplicates
const duplicates = db.prepare(`
  SELECT token_id, COUNT(*) as count 
  FROM current_state 
  WHERE contract_address = ? COLLATE NOCASE 
  GROUP BY token_id 
  HAVING COUNT(*) > 1
`).all(contractAddress.toLowerCase())

console.log(`🔍 Found ${duplicates.length} tokens with duplicate records:`)
duplicates.forEach(dup => {
  console.log(`   Token ${dup.token_id}: ${dup.count} records`)
})

if (duplicates.length === 0) {
  console.log('✅ No duplicates found!')
  process.exit(0)
}

// Delete all current_state records for this contract
console.log(`\n🗑️  Clearing all current_state records...`)
const deleteResult = db.prepare(`
  DELETE FROM current_state 
  WHERE contract_address = ? COLLATE NOCASE
`).run(contractAddress.toLowerCase())

console.log(`   Deleted ${deleteResult.changes} records`)

// Rebuild with proper latest-owner-only logic
console.log(`\n🧮 Rebuilding with correct latest-owner-only logic...`)

const latestOwners = db.prepare(`
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
  ORDER BY token_id
`).all(contractAddress.toLowerCase())

console.log(`📋 Found ${latestOwners.length} tokens with current owners`)

// Check the specific tokens that were duplicated
const problematicTokens = duplicates.map(d => d.token_id)
const fixedTokens = latestOwners.filter(owner => problematicTokens.includes(owner.token_id))

console.log(`\n🔧 Fixed problematic tokens:`)
fixedTokens.forEach(token => {
  console.log(`   Token ${token.token_id}: now owned by ${token.current_owner} (block ${token.block_number})`)
})

// Insert corrected current_state data
const insertCurrentState = db.prepare(`
  INSERT INTO current_state (
    contract_address, 
    token_id, 
    address, 
    balance, 
    last_updated_block, 
    updated_at
  )
  VALUES (?, ?, ?, '1', ?, CURRENT_TIMESTAMP)
`)

const insertStates = db.transaction((owners) => {
  let insertedCount = 0
  
  owners.forEach(owner => {
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

const insertedCount = insertStates(latestOwners)
console.log(`\n💾 Inserted ${insertedCount} current_state records`)

// Verify the fix
const newTotal = db.prepare(`
  SELECT COUNT(*) as total_records 
  FROM current_state 
  WHERE contract_address = ? COLLATE NOCASE
`).get(contractAddress.toLowerCase())

const newUnique = db.prepare(`
  SELECT COUNT(DISTINCT token_id) as unique_tokens 
  FROM current_state 
  WHERE contract_address = ? COLLATE NOCASE
`).get(contractAddress.toLowerCase())

const newDuplicates = db.prepare(`
  SELECT COUNT(*) as duplicate_count
  FROM (
    SELECT token_id, COUNT(*) as count 
    FROM current_state 
    WHERE contract_address = ? COLLATE NOCASE 
    GROUP BY token_id 
    HAVING COUNT(*) > 1
  )
`).get(contractAddress.toLowerCase())

console.log(`\n✅ VERIFICATION:`)
console.log(`   Total records: ${newTotal.total_records}`)
console.log(`   Unique tokens: ${newUnique.unique_tokens}`)
console.log(`   Duplicates: ${newDuplicates.duplicate_count}`)

if (newTotal.total_records === newUnique.unique_tokens && newDuplicates.duplicate_count === 0) {
  console.log(`\n🎉 SUCCESS: Total supply now correctly shows ${newUnique.unique_tokens} tokens!`)
  console.log(`   The snapshot should now display the correct total supply of 6969.`)
} else {
  console.log(`\n⚠️  Issue still exists - please check the data manually`)
}

db.close()