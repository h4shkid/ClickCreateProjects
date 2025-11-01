/**
 * Test if quota limit blocks new collection registration
 */

import { checkNewSyncLimit } from '../lib/auth/new-sync-limit'

const testWallet = '0x4Ae8B436e50f762Fa8fad29Fd548b375fEe968AC'

async function main() {
  console.log('🧪 Testing Quota Limit Enforcement\n')

  console.log(`Testing wallet: ${testWallet}`)
  console.log(`Today's date: ${new Date().toISOString().split('T')[0]}`)

  const result = await checkNewSyncLimit(testWallet)

  console.log('\n📊 Current Quota Status:')
  console.log(`  Current Count: ${result.currentCount}`)
  console.log(`  Max Count: ${result.maxCount}`)
  console.log(`  Can Add New Sync: ${result.canAddNewSync}`)
  console.log(`  Active Syncs Today:`)

  result.activeNewSyncs.forEach((sync, index) => {
    console.log(`    ${index + 1}. ${sync.contractName || 'Unknown'} (${sync.contractAddress})`)
    console.log(`       Started: ${sync.syncStartedAt}`)
  })

  console.log('\n✅ Expected behavior:')
  console.log('  - Current Count should be 2')
  console.log('  - Can Add New Sync should be FALSE')
  console.log('  - API should reject with 429 status')
}

main().catch(console.error)
