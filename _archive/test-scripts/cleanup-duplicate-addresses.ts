import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script to clean up duplicate addresses in the database
 * Merges addresses that differ only in case (e.g., 0xABC... and 0xabc...)
 */

async function cleanupDuplicateAddresses() {
  console.log('🧹 Starting database cleanup for duplicate addresses...\n');
  
  // Initialize database
  const dbPath = path.resolve('./data/nft-snapshot.db');
  if (!fs.existsSync(dbPath)) {
    console.error('❌ Database not found at:', dbPath);
    process.exit(1);
  }
  
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  
  try {
    // Start transaction for atomic operation
    db.exec('BEGIN TRANSACTION');
    
    // Step 1: Get statistics before cleanup
    console.log('📊 Current database statistics:');
    const beforeStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT address) as unique_addresses,
        COUNT(DISTINCT LOWER(address)) as normalized_addresses,
        COUNT(*) as total_records,
        SUM(CAST(balance AS INTEGER)) as total_supply
      FROM current_state
      WHERE balance > 0
    `).get() as any;
    
    console.log(`  - Unique addresses (case-sensitive): ${beforeStats.unique_addresses}`);
    console.log(`  - Unique addresses (normalized): ${beforeStats.normalized_addresses}`);
    console.log(`  - Total records: ${beforeStats.total_records}`);
    console.log(`  - Total supply: ${beforeStats.total_supply}`);
    console.log(`  - Duplicate addresses: ${beforeStats.unique_addresses - beforeStats.normalized_addresses}\n`);
    
    // Step 2: Find duplicate addresses (same address, different casing)
    console.log('🔍 Finding duplicate addresses...');
    const duplicates = db.prepare(`
      SELECT 
        LOWER(address) as normalized_address,
        GROUP_CONCAT(address) as variants,
        COUNT(*) as variant_count
      FROM (
        SELECT DISTINCT address, token_id FROM current_state WHERE balance > 0
      )
      GROUP BY LOWER(address)
      HAVING COUNT(DISTINCT address) > 1
    `).all() as any[];
    
    console.log(`  Found ${duplicates.length} addresses with case variations\n`);
    
    if (duplicates.length > 0) {
      console.log('📝 Sample duplicates:');
      duplicates.slice(0, 5).forEach(dup => {
        console.log(`  - ${dup.normalized_address}: ${dup.variant_count} variants`);
        console.log(`    Variants: ${dup.variants}`);
      });
      console.log();
    }
    
    // Step 3: Create temporary table with merged balances
    console.log('🔨 Creating temporary table with merged balances...');
    db.exec(`
      CREATE TEMPORARY TABLE merged_state AS
      SELECT 
        LOWER(address) as address,
        token_id,
        SUM(CAST(balance AS INTEGER)) as balance,
        MAX(last_updated_block) as last_updated_block,
        MAX(updated_at) as updated_at
      FROM current_state
      WHERE balance > 0
      GROUP BY LOWER(address), token_id
    `);
    
    // Step 4: Clear current_state table
    console.log('🗑️  Clearing current state table...');
    db.exec('DELETE FROM current_state');
    
    // Step 5: Repopulate with merged data
    console.log('✨ Repopulating with normalized addresses...');
    const insertResult = db.exec(`
      INSERT INTO current_state (address, token_id, balance, last_updated_block, updated_at)
      SELECT 
        address,
        token_id,
        CAST(balance AS TEXT),
        last_updated_block,
        updated_at
      FROM merged_state
      WHERE balance > 0
    `);
    
    // Step 6: Update events table to normalize addresses
    console.log('🔄 Normalizing addresses in events table...');
    db.exec(`
      UPDATE events 
      SET 
        from_address = LOWER(from_address),
        to_address = LOWER(to_address),
        operator = CASE WHEN operator IS NOT NULL THEN LOWER(operator) ELSE operator END
    `);
    
    // Step 7: Verify results
    console.log('\n✅ Cleanup complete! New statistics:');
    const afterStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT address) as unique_addresses,
        COUNT(DISTINCT LOWER(address)) as normalized_addresses,
        COUNT(*) as total_records,
        SUM(CAST(balance AS INTEGER)) as total_supply
      FROM current_state
      WHERE balance > 0
    `).get() as any;
    
    console.log(`  - Unique addresses: ${afterStats.unique_addresses}`);
    console.log(`  - Total records: ${afterStats.total_records}`);
    console.log(`  - Total supply: ${afterStats.total_supply}`);
    
    // Commit transaction
    db.exec('COMMIT');
    console.log('\n✅ Transaction committed successfully!');
    
    // Final verification
    console.log('\n📋 Summary:');
    console.log(`  - Addresses merged: ${beforeStats.unique_addresses - afterStats.unique_addresses}`);
    console.log(`  - Records reduced by: ${beforeStats.total_records - afterStats.total_records}`);
    console.log(`  - Supply difference: ${beforeStats.total_supply - afterStats.total_supply} (should be 0 or minimal)`);
    
    // Check specific token ID 1
    const token1Stats = db.prepare(`
      SELECT 
        COUNT(DISTINCT address) as holders,
        SUM(CAST(balance AS INTEGER)) as supply
      FROM current_state
      WHERE token_id = '1' AND balance > 0
    `).get() as any;
    
    console.log(`\n  Token ID 1: ${token1Stats.holders} holders, ${token1Stats.supply} supply`);
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    console.log('🔙 Rolling back transaction...');
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

// Run the cleanup
cleanupDuplicateAddresses().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});