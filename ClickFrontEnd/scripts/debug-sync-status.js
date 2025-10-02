const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))

// Test the sync status query for the Good Vibes Club contract
const address = '0xb8ea78fcacef50d41375e44e6814ebba36bb33c4'

console.log('🔍 Debugging Sync Status API for Good Vibes Club')
console.log('='.repeat(60))

// Get contract ID
const contract = db.prepare(`
  SELECT id, name FROM contracts 
  WHERE address = ? COLLATE NOCASE
`).get(address.toLowerCase())

if (!contract) {
  console.log('❌ Contract not found in database')
  process.exit(1)
}

console.log(`📝 Contract: ${contract.name} (ID: ${contract.id})`)

// Get sync status with progress_percentage
let syncStatus
try {
  syncStatus = db.prepare(`
    SELECT 
      current_block,
      end_block,
      start_block,
      status,
      total_events,
      processed_events,
      progress_percentage,
      completed_at,
      created_at,
      started_at
    FROM contract_sync_status 
    WHERE contract_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(contract.id)
  
  console.log('✅ Successfully queried with progress_percentage column')
} catch (error) {
  console.log('⚠️  progress_percentage column not found, using fallback')
  syncStatus = db.prepare(`
    SELECT 
      current_block,
      end_block,
      start_block,
      status,
      total_events,
      processed_events,
      completed_at,
      created_at,
      started_at
    FROM contract_sync_status 
    WHERE contract_id = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(contract.id)
}

if (!syncStatus) {
  console.log('❌ No sync status found')
  process.exit(1)
}

console.log('\n📊 Raw Sync Status from Database:')
console.log(JSON.stringify(syncStatus, null, 2))

// Calculate progress percentage
let progressPercentage = 0
if (syncStatus) {
  if (syncStatus.status === 'completed') {
    progressPercentage = 100
  } else if (syncStatus.status === 'processing' && syncStatus.progress_percentage) {
    progressPercentage = syncStatus.progress_percentage
    console.log(`\n✅ Using stored progress_percentage: ${progressPercentage}%`)
  } else if (syncStatus.status === 'processing' && syncStatus.current_block && syncStatus.start_block && syncStatus.end_block) {
    // Fallback calculation
    const totalBlocks = syncStatus.end_block - syncStatus.start_block
    const completedBlocks = syncStatus.current_block - syncStatus.start_block
    progressPercentage = totalBlocks > 0 ? Math.round((completedBlocks / totalBlocks) * 100) : 0
    console.log(`\n🔢 Fallback calculation:`)
    console.log(`   Total blocks: ${totalBlocks}`)
    console.log(`   Completed blocks: ${completedBlocks}`)
    console.log(`   Progress: ${progressPercentage}%`)
  }
}

const finalProgress = Math.min(Math.max(progressPercentage, 0), 100)

console.log('\n🎯 Final API Response:')
console.log({
  status: syncStatus?.status || 'never_synced',
  progressPercentage: finalProgress,
  syncRange: {
    startBlock: syncStatus?.start_block,
    currentBlock: syncStatus?.current_block,
    endBlock: syncStatus?.end_block
  }
})

// Check if there are recent updates
if (syncStatus.started_at) {
  const startedAt = new Date(syncStatus.started_at)
  const now = new Date()
  const minutesAgo = (now - startedAt) / (1000 * 60)
  console.log(`\n⏰ Sync started ${minutesAgo.toFixed(1)} minutes ago`)
}

// Check events table for progress
try {
  const eventCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM events 
    WHERE contract_address = ? COLLATE NOCASE
  `).get(address.toLowerCase())
  
  console.log(`\n📋 Events in database: ${eventCount.count}`)
  
  if (syncStatus.total_events) {
    console.log(`📊 Expected events: ${syncStatus.total_events}`)
    console.log(`📈 Event progress: ${((eventCount.count / syncStatus.total_events) * 100).toFixed(1)}%`)
  }
} catch (error) {
  console.log('\n❌ Could not check events table')
}

db.close()