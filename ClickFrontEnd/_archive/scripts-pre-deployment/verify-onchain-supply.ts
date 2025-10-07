#!/usr/bin/env npx tsx

/**
 * Verify On-Chain Supply
 *
 * Queries the blockchain directly to get the actual token supply
 * and compares with database.
 */

import { ethers } from 'ethers'
import Database from 'better-sqlite3'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const CONTRACT_ADDRESS = '0x33fd426905f149f8376e227d0c9d3340aad17af1'
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

const ERC1155_ABI = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]

async function main() {
  console.log('🔍 Verifying on-chain supply...\n')

  // Initialize provider
  if (!ALCHEMY_API_KEY || ALCHEMY_API_KEY === 'your_alchemy_api_key_here') {
    console.error('❌ ALCHEMY_API_KEY not configured!')
    process.exit(1)
  }

  const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_ABI, provider)

  // Get latest block
  const latestBlock = await provider.getBlockNumber()
  console.log(`📊 Latest block: ${latestBlock.toLocaleString()}\n`)

  // Query ALL events from deployment
  const deploymentBlock = 14933647

  console.log(`📡 Querying blockchain for ALL events...`)
  console.log(`   From block: ${deploymentBlock.toLocaleString()}`)
  console.log(`   To block: ${latestBlock.toLocaleString()}`)
  console.log(`   Range: ${(latestBlock - deploymentBlock).toLocaleString()} blocks`)
  console.log(`\n⏳ This will take 5-10 minutes...\n`)

  let totalMinted = 0
  let totalBurned = 0
  let eventCount = 0

  const CHUNK_SIZE = 5000
  let currentStart = deploymentBlock

  while (currentStart <= latestBlock) {
    const currentEnd = Math.min(currentStart + CHUNK_SIZE - 1, latestBlock)
    const progress = ((currentEnd - deploymentBlock) / (latestBlock - deploymentBlock) * 100).toFixed(1)

    process.stdout.write(`\r⏳ Progress: ${progress}% | Block ${currentEnd.toLocaleString()} | Events: ${eventCount.toLocaleString()} | Minted: ${totalMinted.toLocaleString()}`)

    try {
      const [singleEvents, batchEvents] = await Promise.all([
        contract.queryFilter(contract.filters.TransferSingle(), currentStart, currentEnd),
        contract.queryFilter(contract.filters.TransferBatch(), currentStart, currentEnd)
      ])

      // Process TransferSingle
      for (const event of singleEvents) {
        const from = event.args![1].toLowerCase()
        const to = event.args![2].toLowerCase()
        const value = parseInt(event.args![4].toString())

        if (from === '0x0000000000000000000000000000000000000000') {
          totalMinted += value
        }
        if (to === '0x0000000000000000000000000000000000000000') {
          totalBurned += value
        }

        eventCount++
      }

      // Process TransferBatch
      for (const event of batchEvents) {
        const from = event.args![1].toLowerCase()
        const to = event.args![2].toLowerCase()
        const values = event.args![4] as any[]

        for (const val of values) {
          const value = parseInt(val.toString())

          if (from === '0x0000000000000000000000000000000000000000') {
            totalMinted += value
          }
          if (to === '0x0000000000000000000000000000000000000000') {
            totalBurned += value
          }

          eventCount++
        }
      }

      await new Promise(resolve => setTimeout(resolve, 150))
    } catch (error: any) {
      if (error.message.includes('response size exceeded')) {
        // Split in half and retry
        const mid = Math.floor((currentStart + currentEnd) / 2)
        currentEnd = mid
        continue
      }
      console.error(`\n❌ Error at blocks ${currentStart}-${currentEnd}:`, error.message)
    }

    currentStart = currentEnd + 1
  }

  const onChainSupply = totalMinted - totalBurned

  console.log('\n\n' + '='.repeat(60))
  console.log('📊 ON-CHAIN SUPPLY (BLOCKCHAIN TRUTH)')
  console.log('='.repeat(60))
  console.log(`Total events: ${eventCount.toLocaleString()}`)
  console.log(`Minted: ${totalMinted.toLocaleString()}`)
  console.log(`Burned: ${totalBurned.toLocaleString()}`)
  console.log(`Net Supply: ${onChainSupply.toLocaleString()}`)
  console.log('='.repeat(60))

  // Compare with database
  const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
  db.pragma('journal_mode = WAL')

  const dbResult = db.prepare(`
    SELECT
      COUNT(*) as event_count,
      SUM(CASE WHEN from_address = '0x0000000000000000000000000000000000000000' THEN amount ELSE 0 END) as minted,
      SUM(CASE WHEN to_address = '0x0000000000000000000000000000000000000000' THEN amount ELSE 0 END) as burned
    FROM events
    WHERE contract_address = ? COLLATE NOCASE
  `).get(CONTRACT_ADDRESS.toLowerCase()) as any

  const dbMinted = parseInt(dbResult.minted || '0')
  const dbBurned = parseInt(dbResult.burned || '0')
  const dbSupply = dbMinted - dbBurned

  console.log('\n📊 DATABASE SUPPLY')
  console.log('='.repeat(60))
  console.log(`Total events: ${dbResult.event_count.toLocaleString()}`)
  console.log(`Minted: ${dbMinted.toLocaleString()}`)
  console.log(`Burned: ${dbBurned.toLocaleString()}`)
  console.log(`Net Supply: ${dbSupply.toLocaleString()}`)
  console.log('='.repeat(60))

  console.log('\n📊 COMPARISON')
  console.log('='.repeat(60))
  console.log(`Event count difference: ${Math.abs(eventCount - dbResult.event_count)} events`)
  console.log(`Minted difference: ${Math.abs(totalMinted - dbMinted)} tokens`)
  console.log(`Burned difference: ${Math.abs(totalBurned - dbBurned)} tokens`)
  console.log(`Supply difference: ${Math.abs(onChainSupply - dbSupply)} tokens`)

  if (onChainSupply === dbSupply) {
    console.log('\n✅ DATABASE MATCHES BLOCKCHAIN! Supply is correct: ' + onChainSupply.toLocaleString())
  } else {
    console.log(`\n⚠️  MISMATCH: Expected ${onChainSupply.toLocaleString()}, Got ${dbSupply.toLocaleString()}`)
    console.log(`   Difference: ${dbSupply - onChainSupply} tokens (${dbSupply > onChainSupply ? 'too many' : 'too few'})`)
  }

  console.log('='.repeat(60) + '\n')

  db.close()
}

main().catch(console.error)
