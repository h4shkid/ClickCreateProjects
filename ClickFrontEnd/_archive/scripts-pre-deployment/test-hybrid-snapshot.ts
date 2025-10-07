/**
 * Test Hybrid Snapshot System
 * Validates the new hybrid snapshot generation strategy
 */

import { HybridSnapshotGenerator } from '../lib/blockchain/hybrid-snapshot-generator'
import { AdvancedQueryBuilder } from '../lib/processing/advanced-query-builder'
import { getPreset, buildQueryFromPreset, SNAPSHOT_PRESETS } from '../lib/processing/snapshot-presets'
import { getDatabase } from '../lib/database/init'

const CLICKCREATE_CONTRACT = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'
const TEST_ERC721_CONTRACT = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d' // BAYC
const TEST_ERC1155_CONTRACT = CLICKCREATE_CONTRACT

async function testHybridSnapshot() {
  console.log('🧪 Testing Hybrid Snapshot System\n')
  console.log('=' .repeat(80))

  // Initialize database
  const dbManager = getDatabase()
  await dbManager.initialize()
  console.log('✅ Database initialized\n')

  const generator = new HybridSnapshotGenerator()

  // Test 1: ERC-1155 single token (real-time)
  console.log('\n📊 Test 1: ERC-1155 Single Token (Real-time Strategy)')
  console.log('-'.repeat(80))
  try {
    const result1 = await generator.generateSnapshot({
      contractAddress: TEST_ERC1155_CONTRACT,
      contractType: 'ERC1155',
      tokenIds: ['1']
    })

    console.log('✅ Success!')
    console.log(`   Data Source: ${result1.metadata.dataSource}`)
    console.log(`   Total Holders: ${result1.metadata.totalHolders}`)
    console.log(`   Total Supply: ${result1.metadata.totalSupply}`)
    console.log(`   Block Number: ${result1.metadata.blockNumber}`)
    console.log(`   Top 3 Holders:`)
    result1.holders.slice(0, 3).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - Balance: ${h.balance}`)
    })
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message)
  }

  // Test 2: ERC-1155 multiple tokens (database + quick sync)
  console.log('\n📊 Test 2: ERC-1155 Multiple Tokens (Database + Quick Sync)')
  console.log('-'.repeat(80))
  try {
    const result2 = await generator.generateSnapshot({
      contractAddress: TEST_ERC1155_CONTRACT,
      contractType: 'ERC1155',
      tokenIds: ['1', '5', '10'],
      quickSyncBlocks: 50
    })

    console.log('✅ Success!')
    console.log(`   Data Source: ${result2.metadata.dataSource}`)
    console.log(`   Total Holders: ${result2.metadata.totalHolders}`)
    console.log(`   Sync Gap: ${result2.metadata.syncGapBlocks} blocks`)
    console.log(`   Last Synced Block: ${result2.metadata.lastSyncedBlock}`)
    console.log(`   Top 3 Holders:`)
    result2.holders.slice(0, 3).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - Balance: ${h.balance}`)
      if (h.balances) {
        console.log(`        Token Balances:`, h.balances)
      }
    })
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message)
  }

  // Test 3: All tokens (database)
  console.log('\n📊 Test 3: All Tokens (Database Strategy)')
  console.log('-'.repeat(80))
  try {
    const result3 = await generator.generateSnapshot({
      contractAddress: TEST_ERC1155_CONTRACT,
      contractType: 'ERC1155'
    })

    console.log('✅ Success!')
    console.log(`   Data Source: ${result3.metadata.dataSource}`)
    console.log(`   Total Holders: ${result3.metadata.totalHolders}`)
    console.log(`   Total Supply: ${result3.metadata.totalSupply}`)
    console.log(`   Top 5 Holders:`)
    result3.holders.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - Balance: ${h.balance} (${h.percentage?.toFixed(2)}%)`)
    })
  } catch (error) {
    console.error('❌ Test 3 Failed:', error.message)
  }

  console.log('\n' + '='.repeat(80))
}

async function testAdvancedQueryBuilder() {
  console.log('\n🧪 Testing Advanced Query Builder\n')
  console.log('='.repeat(80))

  const queryBuilder = new AdvancedQueryBuilder()

  // Test 1: Exact match query
  console.log('\n📊 Test 1: Exact Match Query (Tokens 1 AND 5)')
  console.log('-'.repeat(80))
  try {
    const result1 = await queryBuilder.executeQuery({
      contractAddress: CLICKCREATE_CONTRACT,
      tokenSelection: {
        mode: 'exact',
        tokenIds: ['1', '5']
      },
      holderFilters: {
        hasCompleteSets: true
      },
      sortBy: 'balance',
      sortOrder: 'desc',
      limit: 10
    })

    console.log('✅ Success!')
    console.log(`   Total Holders: ${result1.metadata.totalHolders}`)
    console.log(`   Unique Tokens: ${result1.metadata.uniqueTokens}`)
    console.log(`   Holders with both tokens:`)
    result1.holders.forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - ${h.tokenCount} tokens, Balance: ${h.totalBalance}`)
      console.log(`        Complete Sets: ${h.completeSets || 0}`)
    })
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message)
  }

  // Test 2: Token range query
  console.log('\n📊 Test 2: Token Range Query (Tokens 1-10)')
  console.log('-'.repeat(80))
  try {
    const result2 = await queryBuilder.executeQuery({
      contractAddress: CLICKCREATE_CONTRACT,
      tokenSelection: {
        mode: 'range',
        range: { start: 1, end: 10 }
      },
      holderFilters: {
        minTokenCount: 3
      },
      sortBy: 'tokenCount',
      sortOrder: 'desc',
      limit: 10
    })

    console.log('✅ Success!')
    console.log(`   Total Holders: ${result2.metadata.totalHolders}`)
    console.log(`   Top holders by token diversity:`)
    result2.holders.forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - ${h.tokenCount} different tokens`)
    })
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message)
  }

  // Test 3: Whale holders (high balance)
  console.log('\n📊 Test 3: Whale Holders (Balance >= 10)')
  console.log('-'.repeat(80))
  try {
    const result3 = await queryBuilder.executeQuery({
      contractAddress: CLICKCREATE_CONTRACT,
      tokenSelection: {
        mode: 'all'
      },
      holderFilters: {
        minBalance: 10
      },
      sortBy: 'balance',
      sortOrder: 'desc',
      limit: 10
    })

    console.log('✅ Success!')
    console.log(`   Total Whale Holders: ${result3.metadata.totalHolders}`)
    console.log(`   Top 10 whales:`)
    result3.holders.forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - Balance: ${h.totalBalance} (${h.percentage?.toFixed(2)}%)`)
    })
  } catch (error) {
    console.error('❌ Test 3 Failed:', error.message)
  }

  console.log('\n' + '='.repeat(80))
}

async function testSnapshotPresets() {
  console.log('\n🧪 Testing Snapshot Presets\n')
  console.log('='.repeat(80))

  console.log('\n📋 Available Presets:')
  console.log('-'.repeat(80))
  SNAPSHOT_PRESETS.forEach(preset => {
    const icon = preset.recommended ? '⭐' : '  '
    console.log(`${icon} [${preset.category.toUpperCase()}] ${preset.name}`)
    console.log(`   ${preset.description}`)
    if (preset.requiresTokenInput) {
      console.log(`   ⚠️  Requires token input`)
    }
  })

  // Test preset execution
  console.log('\n📊 Test: Execute "Airdrop All Holders" Preset')
  console.log('-'.repeat(80))
  try {
    const preset = getPreset('airdrop-all-holders')!
    const query = buildQueryFromPreset(preset, CLICKCREATE_CONTRACT)

    const queryBuilder = new AdvancedQueryBuilder()
    const result = await queryBuilder.executeQuery(query)

    console.log('✅ Success!')
    console.log(`   Preset: ${preset.name}`)
    console.log(`   Total Holders: ${result.metadata.totalHolders}`)
    console.log(`   Total Supply: ${result.metadata.totalSupply}`)
    console.log(`   First 5 holders:`)
    result.holders.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - Balance: ${h.totalBalance}`)
    })
  } catch (error) {
    console.error('❌ Preset test failed:', error.message)
  }

  console.log('\n' + '='.repeat(80))
}

async function testQueryStatistics() {
  console.log('\n🧪 Testing Query Statistics\n')
  console.log('='.repeat(80))

  const queryBuilder = new AdvancedQueryBuilder()

  const query = {
    contractAddress: CLICKCREATE_CONTRACT,
    tokenSelection: {
      mode: 'all' as const
    },
    holderFilters: {
      minBalance: 5
    }
  }

  console.log('📊 Getting statistics for query:', JSON.stringify(query, null, 2))
  console.log('-'.repeat(80))

  try {
    const stats = await queryBuilder.getQueryStatistics(query)

    console.log('✅ Statistics:')
    console.log(`   Estimated Holders: ${stats.estimatedHolders}`)
    console.log(`   Estimated Tokens: ${stats.estimatedTokens}`)
    console.log(`   Total Supply: ${stats.totalSupply}`)
  } catch (error) {
    console.error('❌ Statistics test failed:', error.message)
  }

  console.log('\n' + '='.repeat(80))
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Hybrid Snapshot System Test Suite')
  console.log('=' .repeat(80))

  try {
    await testHybridSnapshot()
    await testAdvancedQueryBuilder()
    await testSnapshotPresets()
    await testQueryStatistics()

    console.log('\n✅ All tests completed!')
    console.log('=' .repeat(80))
  } catch (error) {
    console.error('\n❌ Test suite failed:', error)
  }
}

// Run tests
runAllTests()
