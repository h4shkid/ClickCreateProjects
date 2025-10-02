const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))

console.log('🗑️  Removing collection 0x300e7a5fb0ab08af367d5fb3915930791bb08c2b from database')
console.log('='.repeat(80))

const contractAddress = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'

// Check what data exists for this contract
console.log('📊 Checking existing data for contract:', contractAddress)

try {
  // Check contracts table
  const contract = db.prepare(`
    SELECT id, name, symbol, contract_type, chain_id, created_at
    FROM contracts 
    WHERE address = ? COLLATE NOCASE
  `).get(contractAddress.toLowerCase())
  
  if (contract) {
    console.log(`   Contract found: ${contract.name} (${contract.symbol}) - ID: ${contract.id}`)
  } else {
    console.log('   No contract found in contracts table')
  }

  // Check events table
  const eventsCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM events 
    WHERE contract_address = ? COLLATE NOCASE
  `).get(contractAddress.toLowerCase())
  console.log(`   Events: ${eventsCount.count}`)

  // Check current_state table
  const currentStateCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM current_state 
    WHERE contract_address = ? COLLATE NOCASE
  `).get(contractAddress.toLowerCase())
  console.log(`   Current state records: ${currentStateCount.count}`)

  // Check nft_metadata table
  const metadataCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM nft_metadata 
    WHERE contract_address = ? COLLATE NOCASE
  `).get(contractAddress.toLowerCase())
  console.log(`   Metadata records: ${metadataCount.count}`)

  // Check contract_sync_status table
  const syncStatusCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM contract_sync_status 
    WHERE contract_id = ?
  `).get(contract?.id || 0)
  console.log(`   Sync status records: ${syncStatusCount.count}`)

  // Check if contract exists before proceeding
  if (!contract) {
    console.log('❌ Contract not found in database. Nothing to remove.')
    process.exit(0)
  }

  console.log('\n🚨 Starting removal process...')
  
  // Start transaction for atomic removal
  const removeAllData = db.transaction(() => {
    let totalRemoved = 0
    
    // 1. Remove sync status records
    console.log('1️⃣ Removing contract sync status records...')
    const deleteSyncStatus = db.prepare(`
      DELETE FROM contract_sync_status 
      WHERE contract_id = ?
    `).run(contract.id)
    console.log(`   Removed ${deleteSyncStatus.changes} sync status records`)
    totalRemoved += deleteSyncStatus.changes

    // 2. Remove NFT metadata
    console.log('2️⃣ Removing NFT metadata records...')
    const deleteMetadata = db.prepare(`
      DELETE FROM nft_metadata 
      WHERE contract_address = ? COLLATE NOCASE
    `).run(contractAddress.toLowerCase())
    console.log(`   Removed ${deleteMetadata.changes} metadata records`)
    totalRemoved += deleteMetadata.changes

    // 3. Remove current state records
    console.log('3️⃣ Removing current state records...')
    const deleteCurrentState = db.prepare(`
      DELETE FROM current_state 
      WHERE contract_address = ? COLLATE NOCASE
    `).run(contractAddress.toLowerCase())
    console.log(`   Removed ${deleteCurrentState.changes} current state records`)
    totalRemoved += deleteCurrentState.changes

    // 4. Remove events
    console.log('4️⃣ Removing event records...')
    const deleteEvents = db.prepare(`
      DELETE FROM events 
      WHERE contract_address = ? COLLATE NOCASE
    `).run(contractAddress.toLowerCase())
    console.log(`   Removed ${deleteEvents.changes} event records`)
    totalRemoved += deleteEvents.changes

    // 5. Remove contract record last
    console.log('5️⃣ Removing contract record...')
    const deleteContract = db.prepare(`
      DELETE FROM contracts 
      WHERE address = ? COLLATE NOCASE
    `).run(contractAddress.toLowerCase())
    console.log(`   Removed ${deleteContract.changes} contract record`)
    totalRemoved += deleteContract.changes

    return totalRemoved
  })

  // Execute the transaction
  const totalRemoved = removeAllData()
  
  console.log(`\n✅ REMOVAL COMPLETE`)
  console.log(`   Total records removed: ${totalRemoved}`)
  console.log(`   Contract ${contractAddress} has been completely removed from the database`)
  
  // Verify removal
  console.log('\n🔍 Verifying removal...')
  const verifyContract = db.prepare(`
    SELECT COUNT(*) as count FROM contracts WHERE address = ? COLLATE NOCASE
  `).get(contractAddress.toLowerCase())
  
  const verifyEvents = db.prepare(`
    SELECT COUNT(*) as count FROM events WHERE contract_address = ? COLLATE NOCASE
  `).get(contractAddress.toLowerCase())
  
  const verifyCurrentState = db.prepare(`
    SELECT COUNT(*) as count FROM current_state WHERE contract_address = ? COLLATE NOCASE
  `).get(contractAddress.toLowerCase())
  
  const verifyMetadata = db.prepare(`
    SELECT COUNT(*) as count FROM nft_metadata WHERE contract_address = ? COLLATE NOCASE
  `).get(contractAddress.toLowerCase())

  console.log(`   Contracts remaining: ${verifyContract.count}`)
  console.log(`   Events remaining: ${verifyEvents.count}`)
  console.log(`   Current state remaining: ${verifyCurrentState.count}`)
  console.log(`   Metadata remaining: ${verifyMetadata.count}`)

  if (verifyContract.count === 0 && verifyEvents.count === 0 && 
      verifyCurrentState.count === 0 && verifyMetadata.count === 0) {
    console.log('\n🎉 SUCCESS: All data for contract has been completely removed!')
    console.log('   You can now re-add this collection and fetch fresh data.')
  } else {
    console.log('\n⚠️  Warning: Some data may still exist. Please check manually.')
  }

} catch (error) {
  console.error('❌ Error during removal:', error)
  process.exit(1)
} finally {
  db.close()
}