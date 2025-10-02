const Database = require('better-sqlite3');
const path = require('path');

console.log('🔧 Rebuilding state from events...\n');

const dbPath = path.join(__dirname, '..', 'data', 'nft-snapshot.db');
const db = new Database(dbPath);

try {
  // Clear current state
  db.exec('DELETE FROM current_state');
  console.log('✅ Cleared current state table');
  
  // Get all events
  const events = db.prepare(`
    SELECT * FROM events
    ORDER BY block_number, log_index
  `).all();
  
  console.log(`📊 Processing ${events.length} events...`);
  
  // Build balance map
  const balances = new Map();
  const lastBlocks = new Map();
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  
  for (const event of events) {
    const amount = BigInt(event.amount);
    
    // Process from address
    if (event.from_address.toLowerCase() !== zeroAddress) {
      const key = `${event.from_address}:${event.token_id}`;
      const currentBalance = balances.get(key) || 0n;
      balances.set(key, currentBalance - amount);
      lastBlocks.set(key, event.block_number);
    }
    
    // Process to address
    if (event.to_address.toLowerCase() !== zeroAddress) {
      const key = `${event.to_address}:${event.token_id}`;
      const currentBalance = balances.get(key) || 0n;
      balances.set(key, currentBalance + amount);
      lastBlocks.set(key, event.block_number);
    }
  }
  
  // Insert into current_state
  const insertStmt = db.prepare(`
    INSERT INTO current_state (address, token_id, balance, last_updated_block)
    VALUES (?, ?, ?, ?)
  `);
  
  let inserted = 0;
  let skipped = 0;
  
  for (const [key, balance] of balances.entries()) {
    const [address, tokenId] = key.split(':');
    const lastBlock = lastBlocks.get(key) || 0;
    
    if (balance > 0n) {
      insertStmt.run(address, tokenId, balance.toString(), lastBlock);
      inserted++;
    } else {
      skipped++;
    }
  }
  
  console.log(`\n✅ State rebuilt successfully!`);
  console.log(`  Inserted: ${inserted} holder records`);
  console.log(`  Skipped: ${skipped} zero balances`);
  
  // Show statistics
  const stats = {
    uniqueHolders: db.prepare('SELECT COUNT(DISTINCT address) as count FROM current_state').get().count,
    uniqueTokens: db.prepare('SELECT COUNT(DISTINCT token_id) as count FROM current_state').get().count,
    totalRecords: db.prepare('SELECT COUNT(*) as count FROM current_state').get().count
  };
  
  console.log('\n📈 Current State Statistics:');
  console.log(`  Unique Holders: ${stats.uniqueHolders}`);
  console.log(`  Unique Tokens: ${stats.uniqueTokens}`);
  console.log(`  Total Records: ${stats.totalRecords}`);
  
  // Show sample data
  const samples = db.prepare(`
    SELECT address, token_id, balance 
    FROM current_state 
    ORDER BY CAST(balance AS INTEGER) DESC 
    LIMIT 5
  `).all();
  
  if (samples.length > 0) {
    console.log('\n📋 Top 5 Holdings:');
    samples.forEach((s, i) => {
      console.log(`  ${i+1}. ${s.address.substring(0, 10)}... Token: ${s.token_id.substring(0, 20)}... Balance: ${s.balance}`);
    });
  }
  
} catch (error) {
  console.error('❌ Error rebuilding state:', error);
} finally {
  db.close();
}