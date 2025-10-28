/**
 * Test script for historical snapshot with token ranges
 */

import { createDatabaseAdapter } from '../lib/database/adapter'

async function testHistoricalSnapshot() {
  const db = createDatabaseAdapter()
  const address = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'
  const targetBlock = 20000000
  const tokenIds = '1-100' // Test range expansion
  const exactMatch = false

  console.log('🧪 Testing Historical Snapshot API Logic\n')
  console.log(`Contract: ${address}`)
  console.log(`Block: ${targetBlock}`)
  console.log(`Token IDs: ${tokenIds}`)
  console.log(`Exact Match: ${exactMatch}\n`)

  // Parse token IDs with range expansion (copied from API)
  const tokenIdList: string[] = []
  const parts = tokenIds.split(',').map(id => id.trim()).filter(id => id)

  for (const part of parts) {
    if (part.includes('-')) {
      // Parse range (e.g., "1-100")
      const [start, end] = part.split('-').map(n => parseInt(n.trim()))
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          tokenIdList.push(i.toString())
        }
        console.log(`📊 Expanded range ${start}-${end} to ${end - start + 1} tokens`)
      } else {
        console.warn(`⚠️ Invalid range: ${part}`)
      }
    } else {
      tokenIdList.push(part)
    }
  }

  console.log(`\n🎯 Token filtering: ${tokenIdList.length} tokens, exactMatch=${exactMatch}`)
  console.log(`Tokens: [${tokenIdList.slice(0, 5).join(', ')}${tokenIdList.length > 5 ? '...' : ''}]`)

  // Build query
  const placeholders = tokenIdList.map(() => '?').join(', ')

  let balanceQuery: string
  let balanceParams: any[]

  if (exactMatch) {
    // Exact match: holder must own ALL requested tokens and ONLY those tokens
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
    // Any match: holder can own ANY of the requested tokens
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
    targetBlock,
    ...tokenIdList,
    address.toLowerCase(),
    targetBlock,
    ...tokenIdList
  ]

  console.log(`\n📋 Query params: ${balanceParams.length} parameters`)
  console.log(`   Contract: ${balanceParams[0]}`)
  console.log(`   Block: ${balanceParams[1]}`)
  console.log(`   Tokens: ${balanceParams.slice(2, tokenIdList.length + 2).length} token IDs`)

  try {
    console.log('\n⏳ Executing query...')
    const startTime = Date.now()

    const holderBalances = await db.prepare(balanceQuery).all(...balanceParams) as any

    const elapsed = Date.now() - startTime
    console.log(`\n✅ Query completed in ${elapsed}ms`)
    console.log(`📊 Result type: ${typeof holderBalances}`)
    console.log(`📊 Is array: ${Array.isArray(holderBalances)}`)
    console.log(`📊 Found ${holderBalances?.length ?? 'undefined'} holders`)

    if (holderBalances.length > 0) {
      console.log('\n🎯 Top 10 Holders:')
      holderBalances.slice(0, 10).forEach((holder: any, index: number) => {
        console.log(`   ${index + 1}. ${holder.holder_address} - ${holder.balance} tokens`)
      })

      const totalSupply = holderBalances.reduce((sum: number, h: any) => sum + parseInt(h.balance), 0)
      console.log(`\n📈 Total Supply: ${totalSupply}`)
    } else {
      console.log('\n⚠️ No holders found')
    }

  } catch (error) {
    console.error('\n❌ Query failed:', error)
    throw error
  }

  console.log('\n✨ Test completed successfully!')
}

// Run test
testHistoricalSnapshot().catch(console.error)
