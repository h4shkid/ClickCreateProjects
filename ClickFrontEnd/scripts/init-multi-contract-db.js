#!/usr/bin/env node

const Database = require('better-sqlite3')
const fs = require('fs')
const path = require('path')

// Initialize database with multi-contract schema
function initializeDatabase() {
  const dbPath = path.join(process.cwd(), 'data', 'nft-snapshot.db')
  const schemaPath = path.join(process.cwd(), 'lib', 'database', 'multi-contract-schema.sql')
  
  console.log('🗄️  Initializing multi-contract database...')
  console.log('Database path:', dbPath)
  
  // Ensure data directory exists
  const dataDir = path.dirname(dbPath)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
    console.log('📁 Created data directory')
  }
  
  // Read schema
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ Schema file not found:', schemaPath)
    process.exit(1)
  }
  
  const schema = fs.readFileSync(schemaPath, 'utf8')
  
  // Initialize database
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  
  try {
    console.log('📝 Executing schema...')
    db.exec(schema)
    
    console.log('✅ Database initialized successfully!')
    
    // Show database info
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
    console.log(`📊 Created ${tables.length} tables:`)
    tables.forEach(table => {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get()
      console.log(`   - ${table.name}: ${count.count} rows`)
    })
    
  } catch (error) {
    console.error('❌ Failed to initialize database:', error)
    process.exit(1)
  } finally {
    db.close()
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
}

module.exports = { initializeDatabase }