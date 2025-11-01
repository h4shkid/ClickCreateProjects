/**
 * Test script to verify sync quota API
 */

import { checkNewSyncLimit } from '../lib/auth/new-sync-limit'

async function testQuotaAPI() {
  const testWallet = '0x4ae8b436e50f762fa8fad29fd548b375fee968ac'

  console.log('🧪 Testing Sync Quota API\n')
  console.log('Wallet:', testWallet)
  console.log('Current UTC Date:', new Date().toISOString().split('T')[0])
  console.log('Current UTC Time:', new Date().toISOString())
  console.log('\n' + '='.repeat(50) + '\n')

  try {
    const result = await checkNewSyncLimit(testWallet)

    console.log('📊 Quota Result:')
    console.log('  Can Add New Sync:', result.canAddNewSync)
    console.log('  Current Count:', result.currentCount)
    console.log('  Max Count:', result.maxCount)
    console.log('\n')

    console.log('📝 Active Syncs Today:')
    if (result.activeNewSyncs.length === 0) {
      console.log('  (none)')
    } else {
      result.activeNewSyncs.forEach((sync, index) => {
        console.log(`  ${index + 1}. ${sync.contractName || 'Unknown'}`)
        console.log(`     Address: ${sync.contractAddress}`)
        console.log(`     Started: ${sync.syncStartedAt}`)
      })
    }

    console.log('\n' + '='.repeat(50) + '\n')
    console.log('✅ Expected: dailySyncsToday = 1, availableToday = 1')
    console.log(`📊 Actual:   dailySyncsToday = ${result.currentCount}, availableToday = ${result.maxCount - result.currentCount}`)

    if (result.currentCount === 1) {
      console.log('\n✅ API WORKING CORRECTLY!')
    } else {
      console.log('\n❌ API RETURNING WRONG COUNT!')
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

testQuotaAPI()
