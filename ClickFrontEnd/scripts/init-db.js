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

// Read schema
const schemaPath = path.join(__dirname, '..', 'lib', 'database', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');

try {
  // Execute schema
  db.exec(schema);
  
  // Verify tables were created
  const tables = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
  ).all();
  
  console.log('✅ Database initialized successfully');
  console.log('📊 Created tables:');
  tables.forEach(table => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    console.log(`   - ${table.name} (${count.count} records)`);
  });
  
  // Test insert
  const testInsert = db.prepare(`
    INSERT OR REPLACE INTO sync_status (contract_address, last_synced_block, status)
    VALUES (?, ?, ?)
  `).run('0x0000000000000000000000000000000000000000', 0, 'initialized');
  
  console.log('✅ Database test insert successful');
  
} catch (error) {
  console.error('❌ Database initialization failed:', error);
  process.exit(1);
} finally {
  db.close();
}

console.log(`\n📁 Database created at: ${dbPath}`);
console.log('✨ Database initialization complete!');