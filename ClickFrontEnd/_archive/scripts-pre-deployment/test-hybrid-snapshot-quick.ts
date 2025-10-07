/**
 * Quick Hybrid Snapshot Test
 * Tests database-based strategies without RPC calls
 */

import { AdvancedQueryBuilder } from '../lib/processing/advanced-query-builder'
import { getPreset, buildQueryFromPreset, SNAPSHOT_PRESETS, getPresetCategories } from '../lib/processing/snapshot-presets'
import { getDatabase } from '../lib/database/init'

const CLICKCREATE_CONTRACT = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'

async function testAdvancedQueryBuilder() {
  console.log('\n🧪 Testing Advanced Query Builder\n')
  console.log('='.repeat(80))

  const queryBuilder = new AdvancedQueryBuilder()

  // Test 1: All holders
  console.log('\n📊 Test 1: All Holders (Any Token)')
  console.log('-'.repeat(80))
  try {
    const result1 = await queryBuilder.executeQuery({
      contractAddress: CLICKCREATE_CONTRACT,
      tokenSelection: {
        mode: 'all'
      },
      sortBy: 'balance',
      sortOrder: 'desc',
      limit: 10
    })

    console.log('✅ Success!')
    console.log(`   Total Holders: ${result1.metadata.totalHolders}`)
    console.log(`   Total Supply: ${result1.metadata.totalSupply}`)
    console.log(`   Unique Tokens: ${result1.metadata.uniqueTokens}`)
    console.log(`   Top 5 Holders:`)
    result1.holders.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - Balance: ${h.totalBalance} (${h.percentage?.toFixed(2)}%)`)
    })
  } catch (error: any) {
    console.error('❌ Test 1 Failed:', error.message)
  }

  // Test 2: Specific tokens (any match)
  console.log('\n📊 Test 2: Specific Tokens (Token 1 OR 5 OR 10)')
  console.log('-'.repeat(80))
  try {
    const result2 = await queryBuilder.executeQuery({
      contractAddress: CLICKCREATE_CONTRACT,
      tokenSelection: {
        mode: 'any',
        tokenIds: ['1', '5', '10']
      },
      sortBy: 'balance',
      sortOrder: 'desc',
      limit: 10
    })

    console.log('✅ Success!')
    console.log(`   Holders with token 1 OR 5 OR 10: ${result2.metadata.totalHolders}`)
    console.log(`   Top 5 Holders:`)
    result2.holders.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - ${h.tokenCount} different tokens, Balance: ${h.totalBalance}`)
    })
  } catch (error: any) {
    console.error('❌ Test 2 Failed:', error.message)
  }

  // Test 3: Exact match
  console.log('\n📊 Test 3: Exact Match (ONLY Tokens 1 AND 5)')
  console.log('-'.repeat(80))
  try {
    const result3 = await queryBuilder.executeQuery({
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
    console.log(`   Holders with ONLY tokens 1 AND 5: ${result3.metadata.totalHolders}`)
    result3.holders.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - ${h.tokenCount} tokens, Sets: ${h.completeSets || 0}`)
    })
  } catch (error: any) {
    console.error('❌ Test 3 Failed:', error.message)
  }

  // Test 4: Token range
  console.log('\n📊 Test 4: Token Range (Tokens 1-10)')
  console.log('-'.repeat(80))
  try {
    const result4 = await queryBuilder.executeQuery({
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
    console.log(`   Holders with 3+ tokens from range 1-10: ${result4.metadata.totalHolders}`)
    console.log(`   Top holders by diversity:`)
    result4.holders.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - ${h.tokenCount} different tokens`)
    })
  } catch (error: any) {
    console.error('❌ Test 4 Failed:', error.message)
  }

  // Test 5: Whale holders
  console.log('\n📊 Test 5: Whale Holders (Balance >= 10)')
  console.log('-'.repeat(80))
  try {
    const result5 = await queryBuilder.executeQuery({
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
    console.log(`   Total Whale Holders (10+ tokens): ${result5.metadata.totalHolders}`)
    console.log(`   Top 5 whales:`)
    result5.holders.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - Balance: ${h.totalBalance} (${h.percentage?.toFixed(2)}%)`)
    })
  } catch (error: any) {
    console.error('❌ Test 5 Failed:', error.message)
  }

  console.log('\n' + '='.repeat(80))
}

async function testSnapshotPresets() {
  console.log('\n🧪 Testing Snapshot Presets\n')
  console.log('='.repeat(80))

  // List categories
  console.log('\n📋 Preset Categories:')
  console.log('-'.repeat(80))
  const categories = getPresetCategories()
  categories.forEach(cat => {
    console.log(`${cat.category.toUpperCase().padEnd(12)} - ${cat.count} presets - ${cat.description}`)
  })

  // List all presets
  console.log('\n📋 Available Presets (Total: ' + SNAPSHOT_PRESETS.length + '):')
  console.log('-'.repeat(80))
  SNAPSHOT_PRESETS.forEach(preset => {
    const icon = preset.recommended ? '⭐' : '  '
    const reqInput = preset.requiresTokenInput ? ' [REQUIRES TOKEN INPUT]' : ''
    console.log(`${icon} [${preset.category.toUpperCase()}] ${preset.name}${reqInput}`)
    console.log(`   ${preset.description}`)
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
    console.log(`   Description: ${preset.description}`)
    console.log(`   Total Holders: ${result.metadata.totalHolders}`)
    console.log(`   Total Supply: ${result.metadata.totalSupply}`)
    console.log(`   First 5 holders:`)
    result.holders.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - Balance: ${h.totalBalance}`)
    })
  } catch (error: any) {
    console.error('❌ Preset test failed:', error.message)
  }

  // Test another preset
  console.log('\n📊 Test: Execute "Whale Holders" Preset')
  console.log('-'.repeat(80))
  try {
    const preset = getPreset('airdrop-whales')!
    const query = buildQueryFromPreset(preset, CLICKCREATE_CONTRACT)

    const queryBuilder = new AdvancedQueryBuilder()
    const result = await queryBuilder.executeQuery(query)

    console.log('✅ Success!')
    console.log(`   Preset: ${preset.name}`)
    console.log(`   Total Whale Holders: ${result.metadata.totalHolders}`)
    console.log(`   Top 5 whales:`)
    result.holders.slice(0, 5).forEach((h, i) => {
      console.log(`     ${i + 1}. ${h.address.slice(0, 10)}... - Balance: ${h.totalBalance} (${h.percentage?.toFixed(2)}%)`)
    })
  } catch (error: any) {
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

  console.log('\n📊 Getting statistics for query:')
  console.log(`   Token Selection: All tokens`)
  console.log(`   Min Balance: 5`)
  console.log('-'.repeat(80))

  try {
    const stats = await queryBuilder.getQueryStatistics(query)

    console.log('✅ Statistics:')
    console.log(`   Estimated Holders: ${stats.estimatedHolders}`)
    console.log(`   Estimated Tokens: ${stats.estimatedTokens}`)
    console.log(`   Total Supply: ${stats.totalSupply}`)
  } catch (error: any) {
    console.error('❌ Statistics test failed:', error.message)
  }

  console.log('\n' + '='.repeat(80))
}

async function testQueryValidation() {
  console.log('\n🧪 Testing Query Validation\n')
  console.log('='.repeat(80))

  const queryBuilder = new AdvancedQueryBuilder()

  // Test 1: Valid query
  console.log('\n📊 Test 1: Valid Query')
  console.log('-'.repeat(80))
  const validQuery = {
    contractAddress: CLICKCREATE_CONTRACT,
    tokenSelection: {
      mode: 'exact' as const,
      tokenIds: ['1', '5']
    }
  }

  const validation1 = queryBuilder.validateQuery(validQuery)
  console.log(`Valid: ${validation1.valid}`)
  if (!validation1.valid) {
    console.log(`Errors:`, validation1.errors)
  } else {
    console.log('✅ No errors')
  }

  // Test 2: Invalid query - exact mode without tokens
  console.log('\n📊 Test 2: Invalid Query (Exact mode without tokens)')
  console.log('-'.repeat(80))
  const invalidQuery1 = {
    contractAddress: CLICKCREATE_CONTRACT,
    tokenSelection: {
      mode: 'exact' as const
    }
  }

  const validation2 = queryBuilder.validateQuery(invalidQuery1)
  console.log(`Valid: ${validation2.valid}`)
  if (!validation2.valid) {
    console.log(`✅ Errors detected:`, validation2.errors)
  }

  // Test 3: Invalid query - bad contract address
  console.log('\n📊 Test 3: Invalid Query (Bad contract address)')
  console.log('-'.repeat(80))
  const invalidQuery2 = {
    contractAddress: 'invalid',
    tokenSelection: {
      mode: 'all' as const
    }
  }

  const validation3 = queryBuilder.validateQuery(invalidQuery2)
  console.log(`Valid: ${validation3.valid}`)
  if (!validation3.valid) {
    console.log(`✅ Errors detected:`, validation3.errors)
  }

  console.log('\n' + '='.repeat(80))
}

// Run all tests
async function runAllTests() {
  console.log('\n🚀 Hybrid Snapshot System - Quick Test Suite')
  console.log('='.repeat(80))
  console.log('Testing database-based strategies (no RPC required)\n')

  try {
    // Initialize database
    const dbManager = getDatabase()
    await dbManager.initialize()
    console.log('✅ Database initialized\n')

    await testAdvancedQueryBuilder()
    await testSnapshotPresets()
    await testQueryStatistics()
    await testQueryValidation()

    console.log('\n✅ All tests completed!')
    console.log('='.repeat(80))
    console.log('\n📚 Next Steps:')
    console.log('  1. Run full test suite: npx tsx scripts/test-hybrid-snapshot.ts')
    console.log('  2. Test API endpoints: npm run dev (then test /api/snapshot/presets)')
    console.log('  3. Read documentation: HYBRID_SNAPSHOT_GUIDE.md')
    console.log('\n')
  } catch (error: any) {
    console.error('\n❌ Test suite failed:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
  }

  process.exit(0)
}

// Run tests
runAllTests()
