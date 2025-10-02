const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Created data directory');
}

// Initialize database
const dbPath = path.join(dataDir, 'nft-snapshot.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Read enhanced schema
const enhancedSchemaPath = path.join(__dirname, '..', 'lib', 'database', 'enhanced-schema.sql');
const enhancedSchema = fs.readFileSync(enhancedSchemaPath, 'utf-8');

try {
  console.log('📊 Applying enhanced schema...');
  
  // Split schema by statements and execute each
  const statements = enhancedSchema
    .split(';')
    .filter(stmt => stmt.trim())
    .map(stmt => stmt.trim() + ';');
  
  let createdTables = 0;
  let createdIndexes = 0;
  let createdViews = 0;
  
  for (const statement of statements) {
    try {
      if (statement.includes('CREATE TABLE')) {
        db.exec(statement);
        createdTables++;
      } else if (statement.includes('CREATE INDEX')) {
        db.exec(statement);
        createdIndexes++;
      } else if (statement.includes('CREATE VIEW')) {
        db.exec(statement);
        createdViews++;
      } else {
        db.exec(statement);
      }
    } catch (err) {
      if (!err.message.includes('already exists')) {
        console.error('Error executing statement:', err.message);
        console.error('Statement:', statement.substring(0, 100) + '...');
      }
    }
  }
  
  console.log(`✅ Enhanced schema applied successfully!`);
  console.log(`   Created/Updated: ${createdTables} tables, ${createdIndexes} indexes, ${createdViews} views`);
  
  // Verify all tables exist
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  ).all();
  
  console.log('\n📋 Database tables:');
  const importantTables = [
    'events', 'current_state', 'token_metadata_history', 
    'minting_history', 'burn_history', 'approval_history',
    'extension_registry', 'token_extensions', 'royalty_config',
    'token_supply', 'ownership_timeline', 'collection_stats',
    'sync_progress', 'raw_event_logs'
  ];
  
  for (const tableName of importantTables) {
    const exists = tables.some(t => t.name === tableName);
    const count = exists 
      ? db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count
      : 0;
    console.log(`   ${exists ? '✅' : '❌'} ${tableName} (${count} records)`);
  }
  
  // Get database size
  const dbStats = fs.statSync(dbPath);
  console.log(`\n💾 Database size: ${(dbStats.size / 1024 / 1024).toFixed(2)} MB`);
  
} catch (error) {
  console.error('❌ Schema application failed:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log('\n✨ Database is ready for comprehensive ERC-1155 tracking!');