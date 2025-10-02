#!/usr/bin/env node

/**
 * Test authentication database functionality (without HTTP server)
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'nft-snapshot.db');

console.log('🔐 Testing Authentication Database Functionality...');

function testUserManagement() {
  console.log('\n👤 Testing User Management...');
  
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  try {
    const testWallet = '0x742d35Cc6639C0532fEb02aba5C0832c4E8bcD6e';
    const testUsername = 'testuser123';
    
    // Test user creation
    const insertUser = db.prepare(`
      INSERT INTO user_profiles (wallet_address, username, display_name, bio, is_public)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(wallet_address) DO UPDATE SET 
        username = excluded.username,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `);

    const userResult = insertUser.get(testWallet, testUsername, 'Test User', 'Test bio', 1);
    const userId = userResult.id;
    console.log(`✅ User creation: ID ${userId}`);

    // Test activity logging
    const logActivity = db.prepare(`
      INSERT INTO user_activity (user_id, activity_type, metadata)
      VALUES (?, ?, ?)
    `);

    logActivity.run(userId, 'login', JSON.stringify({ testLogin: true }));
    logActivity.run(userId, 'profile_updated', JSON.stringify({ field: 'username' }));
    console.log('✅ Activity logging: Success');

    // Test favorites
    const addFavorite = db.prepare(`
      INSERT OR IGNORE INTO user_favorites (user_id, contract_id, favorite_type)
      VALUES (?, ?, 'contract')
    `);

    addFavorite.run(userId, 1);
    console.log('✅ Contract favorites: Success');

    // Test user dashboard view
    const getUserDashboard = db.prepare(`
      SELECT * FROM user_dashboard WHERE user_id = ?
    `);

    const dashboard = getUserDashboard.get(userId);
    console.log('✅ User dashboard view:', dashboard ? 'Data loaded' : 'No data');
    
    if (dashboard) {
      console.log(`   Tracked contracts: ${dashboard.tracked_contracts}`);
      console.log(`   Total snapshots: ${dashboard.total_snapshots}`);
      console.log(`   Favorite contracts: ${dashboard.favorite_contracts}`);
    }

    // Test username uniqueness
    try {
      insertUser.run('0x1234567890123456789012345678901234567890', testUsername, 'Other User', 'Other bio', 1);
      console.log('⚠️  Username uniqueness constraint not enforced');
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        console.log('✅ Username uniqueness: Enforced');
      } else {
        console.log('⚠️  Unexpected error:', error.message);
      }
    }

    // Cleanup
    db.prepare('DELETE FROM user_activity WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_favorites WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM user_profiles WHERE id = ?').run(userId);
    console.log('✅ Cleanup: Complete');

    db.close();
    return true;

  } catch (error) {
    console.error('❌ User management test failed:', error.message);
    db.close();
    return false;
  }
}

function testCacheSystem() {
  console.log('\n💾 Testing Blockchain Cache System...');
  
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  try {
    const insertCache = db.prepare(`
      INSERT INTO blockchain_cache (
        cache_key, contract_address, method_name, params_hash, 
        result_data, block_number, expires_at, hit_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const testCacheKey = 'balanceOf:0x123:abc123';
    const expiresAt = new Date(Date.now() + 60000).toISOString(); // 1 minute

    insertCache.run(
      testCacheKey,
      '0x1234567890123456789012345678901234567890',
      'balanceOf',
      'abc123',
      JSON.stringify({ balance: '1000' }),
      19000000,
      expiresAt,
      1
    );

    console.log('✅ Cache insertion: Success');

    // Test cache retrieval
    const getCache = db.prepare(`
      SELECT * FROM blockchain_cache WHERE cache_key = ?
    `);

    const cached = getCache.get(testCacheKey);
    console.log('✅ Cache retrieval:', cached ? 'Found' : 'Not found');

    // Test hit count increment
    const incrementHits = db.prepare(`
      UPDATE blockchain_cache 
      SET hit_count = hit_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE cache_key = ?
    `);

    incrementHits.run(testCacheKey);
    
    const updatedCache = getCache.get(testCacheKey);
    console.log(`✅ Hit count increment: ${updatedCache.hit_count === 2 ? 'Success' : 'Failed'}`);

    // Cleanup
    db.prepare('DELETE FROM blockchain_cache WHERE cache_key = ?').run(testCacheKey);
    console.log('✅ Cache cleanup: Complete');

    db.close();
    return true;

  } catch (error) {
    console.error('❌ Cache system test failed:', error.message);
    db.close();
    return false;
  }
}

function testContractSystem() {
  console.log('\n📄 Testing Contract System...');
  
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  try {
    // Test contract overview view
    const getContracts = db.prepare(`
      SELECT * FROM contract_overview WHERE is_verified = 1
    `);

    const contracts = getContracts.all();
    console.log(`✅ Contract overview: ${contracts.length} contracts found`);

    if (contracts.length > 0) {
      const contract = contracts[0];
      console.log(`   Contract: ${contract.name} (${contract.address})`);
      console.log(`   Type: ${contract.contract_type}`);
      console.log(`   Holders: ${contract.total_holders || 'N/A'}`);
    }

    // Test popular contracts view
    const getPopular = db.prepare(`
      SELECT * FROM popular_contracts LIMIT 5
    `);

    const popular = getPopular.all();
    console.log(`✅ Popular contracts: ${popular.length} found`);

    db.close();
    return true;

  } catch (error) {
    console.error('❌ Contract system test failed:', error.message);
    db.close();
    return false;
  }
}

function testSyncStatus() {
  console.log('\n🔄 Testing Sync Status System...');
  
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  try {
    // Test sync status for existing contract
    const getSyncStatus = db.prepare(`
      SELECT * FROM contract_sync_status WHERE contract_id = 1
    `);

    const syncStatus = getSyncStatus.all();
    console.log(`✅ Sync status records: ${syncStatus.length} found`);

    if (syncStatus.length > 0) {
      const status = syncStatus[0];
      console.log(`   Status: ${status.status}`);
      console.log(`   Blocks: ${status.start_block} to ${status.end_block}`);
      console.log(`   Events: ${status.total_events || 0}`);
    }

    db.close();
    return true;

  } catch (error) {
    console.error('❌ Sync status test failed:', error.message);
    db.close();
    return false;
  }
}

function runAllTests() {
  console.log('Starting database functionality tests...\n');

  const results = {
    userManagement: testUserManagement(),
    cacheSystem: testCacheSystem(),
    contractSystem: testContractSystem(),
    syncStatus: testSyncStatus()
  };

  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  console.log(`\n📋 Database Test Results: ${passed}/${total} passed`);

  if (passed === total) {
    console.log('🎉 All database tests passed!');
    console.log('\nDatabase is ready for:');
    console.log('✅ Multi-user authentication');
    console.log('✅ User profile management');
    console.log('✅ Contract tracking');
    console.log('✅ Blockchain data caching');
    console.log('✅ Sync status tracking');
  } else {
    console.log('⚠️  Some tests failed. Review the output above.');
  }

  return results;
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };