/**
 * Test Opepen Historical Snapshots
 * This script generates snapshots to compare with UI results
 */

import { createDatabaseAdapter } from '../lib/database/adapter'
import { createDateToBlockConverter } from '../lib/utils/date-to-block'

const OPEPEN_ADDRESS = '0x6339e5e072086621540d0362c4e3cea0d643e114'

async function testOpepenSnapshots() {
  console.log('🎨 Testing Opepen Edition Historical Snapshots\n')

  const db = createDatabaseAdapter()
  const converter = createDateToBlockConverter()

  // Test 1: Popular tokens (1-10) at a specific date
  console.log('=' .repeat(60))
  console.log('📅 TEST 1: Tokens 1-10 on January 1, 2024')
  console.log('=' .repeat(60))

  const date1 = new Date('2024-01-01T00:00:00Z')
  const block1 = await converter.dateToBlock(date1)
  const actualDate1 = await converter.blockToDate(block1)

  console.log(`\nRequested Date: 2024-01-01`)
  console.log(`Block Number: ${block1}`)
  console.log(`Actual Date: ${actualDate1.toISOString()}`)
  console.log(`\n📋 Settings for UI:`)
  console.log(`   Snapshot Type: Historical`)
  console.log(`   Date Mode: Single Date`)
  console.log(`   Date: 2024-01-01`)
  console.log(`   Token IDs: 1-10`)
  console.log(`   Exact Match: NO`)

  const holders1 = await getHistoricalSnapshot(db, OPEPEN_ADDRESS, block1, '1-10', false)
  console.log(`\n✅ Expected Result: ${holders1.length} holders with ${holders1.totalSupply} total tokens`)
  console.log(`   Top 3 holders:`)
  holders1.holders.slice(0, 3).forEach((h: any, i: number) => {
    console.log(`   ${i + 1}. ${h.holderAddress.slice(0, 10)}... - ${h.balance} tokens`)
  })

  // Test 2: Rare tokens (10000-10010) at recent date
  console.log('\n\n' + '='.repeat(60))
  console.log('📅 TEST 2: Tokens 10000-10010 on March 1, 2024')
  console.log('=' .repeat(60))

  const date2 = new Date('2024-03-01T00:00:00Z')
  const block2 = await converter.dateToBlock(date2)
  const actualDate2 = await converter.blockToDate(block2)

  console.log(`\nRequested Date: 2024-03-01`)
  console.log(`Block Number: ${block2}`)
  console.log(`Actual Date: ${actualDate2.toISOString()}`)
  console.log(`\n📋 Settings for UI:`)
  console.log(`   Snapshot Type: Historical`)
  console.log(`   Date Mode: Single Date`)
  console.log(`   Date: 2024-03-01`)
  console.log(`   Token IDs: 10000-10010`)
  console.log(`   Exact Match: YES`)

  const holders2 = await getHistoricalSnapshot(db, OPEPEN_ADDRESS, block2, '10000-10010', true)
  console.log(`\n✅ Expected Result: ${holders2.length} holders with ${holders2.totalSupply} total tokens`)
  if (holders2.length > 0) {
    console.log(`   Top 3 holders:`)
    holders2.holders.slice(0, 3).forEach((h: any, i: number) => {
      console.log(`   ${i + 1}. ${h.holderAddress.slice(0, 10)}... - ${h.balance} tokens`)
    })
  } else {
    console.log(`   (No holders with ALL 11 tokens)`)
  }

  // Test 3: Date range comparison (Feb 2024 - Apr 2024)
  console.log('\n\n' + '='.repeat(60))
  console.log('📅 TEST 3: Tokens 1-50 - Date Range (Feb 1 to Apr 1, 2024)')
  console.log('=' .repeat(60))

  const startDate = new Date('2024-02-01T00:00:00Z')
  const endDate = new Date('2024-04-01T00:00:00Z')
  const startBlock = await converter.dateToBlock(startDate)
  const endBlock = await converter.dateToBlock(endDate)
  const actualStartDate = await converter.blockToDate(startBlock)
  const actualEndDate = await converter.blockToDate(endBlock)

  console.log(`\nRequested Range: 2024-02-01 to 2024-04-01`)
  console.log(`Block Range: ${startBlock} to ${endBlock}`)
  console.log(`Actual Start: ${actualStartDate.toISOString()}`)
  console.log(`Actual End: ${actualEndDate.toISOString()}`)
  console.log(`\n📋 Settings for UI:`)
  console.log(`   Snapshot Type: Historical`)
  console.log(`   Date Mode: Date Range`)
  console.log(`   Start Date: 2024-02-01`)
  console.log(`   End Date: 2024-04-01`)
  console.log(`   Token IDs: 1-50`)
  console.log(`   Exact Match: NO`)

  const startHolders = await getHistoricalSnapshot(db, OPEPEN_ADDRESS, startBlock, '1-50', false)
  const endHolders = await getHistoricalSnapshot(db, OPEPEN_ADDRESS, endBlock, '1-50', false)

  console.log(`\n✅ Expected Result:`)
  console.log(`   Start (Feb 1): ${startHolders.length} holders, ${startHolders.totalSupply} tokens`)
  console.log(`   End (Apr 1): ${endHolders.length} holders, ${endHolders.totalSupply} tokens`)
  console.log(`   Change: ${endHolders.length - startHolders.length} holders, ${endHolders.totalSupply - startHolders.totalSupply} tokens`)

  // Test 4: Mixed token selection
  console.log('\n\n' + '='.repeat(60))
  console.log('📅 TEST 4: Mixed Tokens (1, 5, 10, 100-110) on June 1, 2024')
  console.log('=' .repeat(60))

  const date4 = new Date('2024-06-01T00:00:00Z')
  const block4 = await converter.dateToBlock(date4)
  const actualDate4 = await converter.blockToDate(block4)

  console.log(`\nRequested Date: 2024-06-01`)
  console.log(`Block Number: ${block4}`)
  console.log(`Actual Date: ${actualDate4.toISOString()}`)
  console.log(`\n📋 Settings for UI:`)
  console.log(`   Snapshot Type: Historical`)
  console.log(`   Date Mode: Single Date`)
  console.log(`   Date: 2024-06-01`)
  console.log(`   Token IDs: 1, 5, 10, 100-110`)
  console.log(`   Exact Match: NO`)

  const holders4 = await getHistoricalSnapshot(db, OPEPEN_ADDRESS, block4, '1, 5, 10, 100-110', false)
  console.log(`\n✅ Expected Result: ${holders4.length} holders with ${holders4.totalSupply} total tokens`)
  console.log(`   Top 3 holders:`)
  holders4.holders.slice(0, 3).forEach((h: any, i: number) => {
    console.log(`   ${i + 1}. ${h.holderAddress.slice(0, 10)}... - ${h.balance} tokens`)
  })

  console.log('\n\n' + '='.repeat(60))
  console.log('✨ All tests completed!')
  console.log('=' .repeat(60))
  console.log('\n💡 Now test these same settings in the UI and compare results!')
}

async function getHistoricalSnapshot(
  db: any,
  address: string,
  blockNumber: number,
  tokenIds: string,
  exactMatch: boolean
) {
  // Parse token IDs with range expansion
  const tokenIdList: string[] = []
  const parts = tokenIds.split(',').map(id => id.trim()).filter(id => id)

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim()))
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          tokenIdList.push(i.toString())
        }
      }
    } else {
      tokenIdList.push(part)
    }
  }

  // Build query
  const placeholders = tokenIdList.map(() => '?').join(', ')

  let balanceQuery: string
  let balanceParams: any[]

  if (exactMatch) {
    balanceQuery = `
      SELECT
        holder_address,
        SUM(balance) as balance,
        COUNT(DISTINCT token_id) as owned_tokens
      FROM (
        SELECT
          to_address as holder_address,
          token_id,
          COUNT(*) as balance
        FROM events
        WHERE contract_address = ? COLLATE NOCASE
        AND block_number <= ?
        AND token_id IN (${placeholders})
        AND to_address != '0x0000000000000000000000000000000000000000'
        GROUP BY to_address, token_id

        UNION ALL

        SELECT
          from_address as holder_address,
          token_id,
          -COUNT(*) as balance
        FROM events
        WHERE contract_address = ? COLLATE NOCASE
        AND block_number <= ?
        AND token_id IN (${placeholders})
        AND from_address != '0x0000000000000000000000000000000000000000'
        GROUP BY from_address, token_id
      )
      GROUP BY holder_address
      HAVING SUM(balance) > 0 AND COUNT(DISTINCT token_id) = ${tokenIdList.length}
      ORDER BY SUM(balance) DESC
    `
  } else {
    balanceQuery = `
      SELECT
        holder_address,
        SUM(balance) as balance
      FROM (
        SELECT
          to_address as holder_address,
          COUNT(*) as balance
        FROM events
        WHERE contract_address = ? COLLATE NOCASE
        AND block_number <= ?
        AND token_id IN (${placeholders})
        AND to_address != '0x0000000000000000000000000000000000000000'
        GROUP BY to_address

        UNION ALL

        SELECT
          from_address as holder_address,
          -COUNT(*) as balance
        FROM events
        WHERE contract_address = ? COLLATE NOCASE
        AND block_number <= ?
        AND token_id IN (${placeholders})
        AND from_address != '0x0000000000000000000000000000000000000000'
        GROUP BY from_address
      )
      GROUP BY holder_address
      HAVING SUM(balance) > 0
      ORDER BY SUM(balance) DESC
    `
  }

  balanceParams = [
    address.toLowerCase(),
    blockNumber,
    ...tokenIdList,
    address.toLowerCase(),
    blockNumber,
    ...tokenIdList
  ]

  const holderBalances = await db.prepare(balanceQuery).all(...balanceParams) as any

  const holders = holderBalances.map((row: any) => ({
    holderAddress: row.holder_address,
    balance: row.balance.toString(),
  }))

  const totalSupply = holders.reduce((sum: number, h: any) => sum + parseInt(h.balance), 0)

  return {
    holders,
    length: holders.length,
    totalSupply
  }
}

// Run tests
testOpepenSnapshots().catch(console.error)
