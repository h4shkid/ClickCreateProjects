#!/usr/bin/env node

/**
 * Test script for wallet integration and authentication system
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'nft-snapshot.db');

console.log('🧪 Testing Wallet Integration & Authentication System...');

function testDatabaseTables() {
  console.log('\n📊 Testing Database Tables...');
  
  const db = new Database(DB_PATH, { readonly: true });
  
  try {
    // Test user_profiles table
    const userCount = db.prepare('SELECT COUNT(*) as count FROM user_profiles').get().count;
    console.log(`✅ user_profiles table: ${userCount} records`);
    
    // Test user_snapshots table
    const snapshotCount = db.prepare('SELECT COUNT(*) as count FROM user_snapshots').get().count;
    console.log(`✅ user_snapshots table: ${snapshotCount} records`);
    
    // Test blockchain_cache table
    const cacheCount = db.prepare('SELECT COUNT(*) as count FROM blockchain_cache').get().count;
    console.log(`✅ blockchain_cache table: ${cacheCount} records`);
    
    // Test contracts table
    const contractCount = db.prepare('SELECT COUNT(*) as count FROM contracts').get().count;
    console.log(`✅ contracts table: ${contractCount} records`);
    
    // Test user_activity table
    const activityCount = db.prepare('SELECT COUNT(*) as count FROM user_activity').get().count;
    console.log(`✅ user_activity table: ${activityCount} records`);
    
    // Test views
    try {
      const contractOverview = db.prepare('SELECT COUNT(*) as count FROM contract_overview').get().count;
      console.log(`✅ contract_overview view: ${contractOverview} records`);
    } catch (error) {
      console.log('⚠️  contract_overview view: not accessible (expected)');
    }
    
    console.log('✅ All database tables are properly created');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    db.close();
  }
}

function testFileStructure() {
  console.log('\n📁 Testing File Structure...');
  
  const filesToCheck = [
    'lib/wallet/config.ts',
    'lib/auth/middleware.ts',
    'lib/hooks/useAuth.ts',
    'lib/providers/AppProviders.tsx',
    'components/wallet/WalletConnection.tsx',
    'app/api/auth/verify-signature/route.ts',
    'app/api/auth/session/route.ts',
    'app/api/auth/logout/route.ts'
  ];
  
  filesToCheck.forEach(file => {
    const fullPath = path.join(__dirname, '..', file);
    if (fs.existsSync(fullPath)) {
      console.log(`✅ ${file}`);
    } else {
      console.log(`❌ ${file} - MISSING`);
    }
  });
}

function testPackageJson() {
  console.log('\n📦 Testing Package Dependencies...');
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  const requiredDeps = [
    '@reown/appkit',
    '@reown/appkit-adapter-wagmi',
    '@reown/appkit-siwe',
    'wagmi',
    'viem',
    '@tanstack/react-query',
    'zustand',
    'jose'
  ];
  
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies[dep]) {
      console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
    } else {
      console.log(`❌ ${dep} - MISSING`);
    }
  });
}

function testEnvironmentVariables() {
  console.log('\n🔧 Testing Environment Variables...');
  
  const envPath = path.join(__dirname, '..', '.env.local');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const requiredVars = [
      'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
      'NEXT_PUBLIC_ALCHEMY_API_KEY',
      'JWT_SECRET'
    ];
    
    requiredVars.forEach(varName => {
      if (envContent.includes(varName)) {
        console.log(`✅ ${varName}: configured`);
      } else {
        console.log(`⚠️  ${varName}: not found (may need configuration)`);
      }
    });
  } else {
    console.log('⚠️  .env.local file not found');
    console.log('📝 Create .env.local with required variables:');
    console.log('   - NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID');
    console.log('   - NEXT_PUBLIC_ALCHEMY_API_KEY');
    console.log('   - JWT_SECRET');
  }
}

function runAllTests() {
  testDatabaseTables();
  testFileStructure();
  testPackageJson();
  testEnvironmentVariables();
  
  console.log('\n🎉 Wallet Integration Test Complete!');
  console.log('\nNext steps:');
  console.log('1. Configure environment variables in .env.local');
  console.log('2. Get a WalletConnect Project ID from https://cloud.walletconnect.com/');
  console.log('3. Update the app layout to include AppProviders');
  console.log('4. Add WalletConnection component to navigation');
  console.log('5. Test wallet connection in development: npm run dev');
}

if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };