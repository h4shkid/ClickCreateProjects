const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
db.pragma('journal_mode = WAL')

console.log('🔧 Adding progress_percentage column to contract_sync_status table...')

try {
  // Check if column already exists
  const tableInfo = db.prepare("PRAGMA table_info(contract_sync_status)").all()
  const hasProgressColumn = tableInfo.some(column => column.name === 'progress_percentage')
  
  if (hasProgressColumn) {
    console.log('✅ progress_percentage column already exists')
  } else {
    // Add the progress_percentage column
    db.prepare(`
      ALTER TABLE contract_sync_status 
      ADD COLUMN progress_percentage INTEGER DEFAULT 0
    `).run()
    
    console.log('✅ Successfully added progress_percentage column')
  }
  
  // Update existing completed syncs to 100%
  const updated = db.prepare(`
    UPDATE contract_sync_status 
    SET progress_percentage = 100 
    WHERE status = 'completed' AND progress_percentage = 0
  `).run()
  
  console.log(`📊 Updated ${updated.changes} completed syncs to 100% progress`)
  
} catch (error) {
  console.error('❌ Error adding progress column:', error)
  process.exit(1)
} finally {
  db.close()
}

console.log('🎉 Database migration completed!')