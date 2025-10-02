#!/usr/bin/env node

/**
 * Migration script to transform single-contract database to multi-contract platform
 * This script safely migrates existing ClickCreate data to the new schema
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Configuration
const DB_PATH = path.join(__dirname, '..', 'data', 'nft-snapshot.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'lib', 'database', 'multi-contract-schema.sql');
const CLICKCREATE_CONTRACT = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';

console.log('🔄 Starting migration to multi-contract platform...');

// Backup existing database
function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${DB_PATH}.backup-${timestamp}`;
  
  try {
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`✅ Database backed up to: ${backupPath}`);
    return backupPath;
  } catch (error) {
    console.error('❌ Failed to create backup:', error.message);
    process.exit(1);
  }
}

// Apply new schema
function applySchema(db) {
  try {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    
    console.log('📄 Applying schema...');
    
    // Execute the entire schema at once (SQLite can handle multiple statements)
    db.exec(schema);
    
    console.log('✅ Schema applied successfully');
  } catch (error) {
    // If that fails, try statement by statement
    console.log('⚠️ Bulk execution failed, trying statement by statement...');
    
    // Split schema into individual statements, handling multi-line constructs
    const statements = [];
    let currentStatement = '';
    let inTrigger = false;
    
    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    schemaContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (trimmed.startsWith('--') || trimmed === '') {
        return;
      }
      
      currentStatement += line + '\n';
      
      // Detect trigger/view/function blocks
      if (trimmed.match(/^CREATE\s+(TRIGGER|VIEW)/i)) {
        inTrigger = true;
      }
      
      if (trimmed === 'END;' || (trimmed.endsWith(';') && !inTrigger)) {
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim());
        }
        currentStatement = '';
        inTrigger = false;
      }
    });
    
    // Add any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`📄 Applying ${statements.length} schema statements individually...`);
    
    // Execute each statement
    statements.forEach((statement, index) => {
      try {
        if (statement.trim()) {
          db.exec(statement);
        }
      } catch (error) {
        // Some statements might fail if they already exist, that's OK
        if (!error.message.includes('already exists') && 
            !error.message.includes('duplicate column name')) {
          console.warn(`⚠️  Statement ${index + 1} warning: ${error.message}`);
        }
      }
    });
    
    console.log('✅ Schema applied successfully (individual statements)');
  }
}

// Migrate existing data
function migrateExistingData(db) {
  console.log('🔄 Migrating existing ClickCreate data...');
  
  try {
    db.transaction(() => {
      // 1. Insert ClickCreate contract into contracts table
      const insertContract = db.prepare(`
        INSERT OR IGNORE INTO contracts (
          address, name, symbol, contract_type, creator_address, 
          deployment_block, is_verified, description, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertContract.run(
        CLICKCREATE_CONTRACT,
        'ClickCreate Collection',
        'CLICK',
        'ERC1155',
        '0x0000000000000000000000000000000000000000', // Will be updated when we detect actual creator
        18500000, // Approximate deployment block
        1, // Verified
        'The original ClickCreate NFT collection - migrated from single-contract platform',
        1 // Active
      );
      
      // 2. Get the contract ID
      const getContractId = db.prepare('SELECT id FROM contracts WHERE address = ?');
      const contractRow = getContractId.get(CLICKCREATE_CONTRACT);
      
      if (!contractRow) {
        throw new Error('Failed to insert or find ClickCreate contract');
      }
      
      const contractId = contractRow.id;
      console.log(`✅ ClickCreate contract inserted with ID: ${contractId}`);
      
      // 3. Update existing events table
      const updateEvents = db.prepare(`
        UPDATE events 
        SET contract_address = ? 
        WHERE contract_address IS NULL OR contract_address = ''
      `);
      
      const eventsUpdated = updateEvents.run(CLICKCREATE_CONTRACT);
      console.log(`✅ Updated ${eventsUpdated.changes} events records`);
      
      // 4. Update existing current_state table
      const updateCurrentState = db.prepare(`
        UPDATE current_state 
        SET contract_address = ? 
        WHERE contract_address IS NULL OR contract_address = ''
      `);
      
      const stateUpdated = updateCurrentState.run(CLICKCREATE_CONTRACT);
      console.log(`✅ Updated ${stateUpdated.changes} current_state records`);
      
      // 5. Update existing nft_metadata table
      const updateMetadata = db.prepare(`
        UPDATE nft_metadata 
        SET contract_address = ? 
        WHERE contract_address IS NULL OR contract_address = ''
      `);
      
      const metadataUpdated = updateMetadata.run(CLICKCREATE_CONTRACT);
      console.log(`✅ Updated ${metadataUpdated.changes} nft_metadata records`);
      
      // 6. Initialize contract sync status
      const insertSyncStatus = db.prepare(`
        INSERT OR IGNORE INTO contract_sync_status (
          contract_id, sync_type, start_block, end_block, current_block, 
          status, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Get latest block from events
      const getLatestBlock = db.prepare('SELECT MAX(block_number) as max_block FROM events');
      const latestBlockRow = getLatestBlock.get();
      const latestBlock = latestBlockRow?.max_block || 18500000;
      
      insertSyncStatus.run(
        contractId,
        'initial',
        18500000,
        latestBlock,
        latestBlock,
        'completed',
        new Date().toISOString()
      );
      
      console.log(`✅ Initialized sync status for blocks 18500000 to ${latestBlock}`);
      
      // 7. Create initial analytics entry
      const countHolders = db.prepare(`
        SELECT COUNT(DISTINCT address) as holder_count 
        FROM current_state 
        WHERE CAST(balance AS INTEGER) > 0
      `);
      
      const countTokens = db.prepare(`
        SELECT COUNT(DISTINCT token_id) as token_count 
        FROM current_state 
        WHERE CAST(balance AS INTEGER) > 0
      `);
      
      const countTransfers = db.prepare('SELECT COUNT(*) as transfer_count FROM events');
      
      const holderCount = countHolders.get()?.holder_count || 0;
      const tokenCount = countTokens.get()?.token_count || 0;
      const transferCount = countTransfers.get()?.transfer_count || 0;
      
      const insertAnalytics = db.prepare(`
        INSERT OR IGNORE INTO contract_analytics (
          contract_id, analysis_date, total_holders, total_supply, 
          unique_tokens, total_transfers
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      insertAnalytics.run(
        contractId,
        new Date().toISOString().split('T')[0], // Today's date
        holderCount,
        '0', // Will be calculated by analytics engine
        tokenCount,
        transferCount
      );
      
      console.log(`✅ Created initial analytics: ${holderCount} holders, ${tokenCount} tokens, ${transferCount} transfers`);
      
    })();
    
    console.log('✅ Data migration completed successfully');
    
  } catch (error) {
    console.error('❌ Failed to migrate data:', error.message);
    throw error;
  }
}

// Verify migration
function verifyMigration(db) {
  console.log('🔍 Verifying migration...');
  
  try {
    // Check contracts table
    const contractCount = db.prepare('SELECT COUNT(*) as count FROM contracts').get().count;
    console.log(`📊 Contracts: ${contractCount}`);
    
    // Check events with contract addresses
    const eventsWithContract = db.prepare(`
      SELECT COUNT(*) as count 
      FROM events 
      WHERE contract_address = ?
    `).get(CLICKCREATE_CONTRACT).count;
    console.log(`📊 Events with contract address: ${eventsWithContract}`);
    
    // Check current_state with contract addresses
    const stateWithContract = db.prepare(`
      SELECT COUNT(*) as count 
      FROM current_state 
      WHERE contract_address = ?
    `).get(CLICKCREATE_CONTRACT).count;
    console.log(`📊 Current state records with contract address: ${stateWithContract}`);
    
    // Check if new tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' 
      AND name IN ('user_profiles', 'user_snapshots', 'blockchain_cache')
    `).all();
    
    console.log(`📊 New tables created: ${tables.map(t => t.name).join(', ')}`);
    
    if (tables.length === 3) {
      console.log('✅ Migration verification passed');
      return true;
    } else {
      console.log('❌ Migration verification failed - missing tables');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

// Main migration function
function runMigration() {
  let db;
  let backupPath;
  
  try {
    // Check if database exists
    if (!fs.existsSync(DB_PATH)) {
      console.log('📁 Database does not exist, creating new one...');
      // Create data directory if it doesn't exist
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } else {
      // Create backup of existing database
      backupPath = createBackup();
    }
    
    // Open database connection
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    console.log('🔗 Database connection established');
    
    // Apply new schema
    applySchema(db);
    
    // Migrate existing data if we have any
    if (backupPath) {
      migrateExistingData(db);
    } else {
      console.log('📝 No existing data to migrate (new installation)');
    }
    
    // Verify migration
    const verified = verifyMigration(db);
    
    if (verified) {
      console.log('🎉 Migration completed successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('1. Run the development server: npm run dev');
      console.log('2. Test wallet connection functionality');
      console.log('3. Add your first contract via the UI');
      
      if (backupPath) {
        console.log('');
        console.log(`Backup location: ${backupPath}`);
        console.log('You can delete this backup after confirming everything works correctly.');
      }
    } else {
      throw new Error('Migration verification failed');
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    
    if (backupPath && fs.existsSync(backupPath)) {
      console.log('🔄 Restoring from backup...');
      try {
        fs.copyFileSync(backupPath, DB_PATH);
        console.log('✅ Database restored from backup');
      } catch (restoreError) {
        console.error('❌ Failed to restore backup:', restoreError.message);
      }
    }
    
    process.exit(1);
  } finally {
    if (db) {
      db.close();
    }
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };