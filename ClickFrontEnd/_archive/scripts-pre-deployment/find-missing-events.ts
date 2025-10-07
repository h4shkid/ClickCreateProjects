#!/usr/bin/env npx tsx

/**
 * Find Missing Events Script
 *
 * This script uses a smart strategy to find ONLY the blocks with missing events,
 * instead of checking every single block gap.
 *
 * Strategy:
 * 1. Query blockchain for total event count in chunks
 * 2. Compare with database event count for same range
 * 3. Only sync chunks where counts don't match
 *
 * This is MUCH faster than checking every gap!
 */

import { ethers } from 'ethers'
import Database from 'better-sqlite3'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

const ERC1155_ABI = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]

interface ChunkComparison {
  startBlock: number
  endBlock: number
  onChainCount: number
  dbCount: number
  missing: number
}

class MissingEventFinder {
  private provider: ethers.JsonRpcProvider
  private db: Database.Database

  constructor() {
    console.log('🔌 Initializing missing event finder...\n')

    if (ALCHEMY_API_KEY && ALCHEMY_API_KEY !== 'your_alchemy_api_key_here') {
      const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      this.provider = new ethers.JsonRpcProvider(alchemyUrl)
      console.log('✅ Using Alchemy provider')
    } else {
      console.error('❌ ALCHEMY_API_KEY not configured!')
      process.exit(1)
    }

    const dbPath = path.join(__dirname, '..', 'data', 'nft-snapshot.db')
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    console.log(`💾 Database: ${dbPath}\n`)
  }

  /**
   * Get event count from database for a block range
   */
  getDbEventCount(contractAddress: string, startBlock: number, endBlock: number): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE contract_address = ? COLLATE NOCASE
      AND block_number BETWEEN ? AND ?
    `).get(contractAddress.toLowerCase(), startBlock, endBlock) as any

    return result.count || 0
  }

  /**
   * Get event count from blockchain for a block range
   */
  async getOnChainEventCount(contractAddress: string, startBlock: number, endBlock: number, retryWithHalfRange: boolean = true): Promise<number> {
    const contract = new ethers.Contract(contractAddress, ERC1155_ABI, this.provider)

    try {
      const [single, batch] = await Promise.all([
        contract.queryFilter(contract.filters.TransferSingle(), startBlock, endBlock),
        contract.queryFilter(contract.filters.TransferBatch(), startBlock, endBlock)
      ])

      // Count individual transfers from batch events
      let batchTransferCount = 0
      for (const event of batch) {
        const ids = event.args![3] as any[]
        batchTransferCount += ids.length
      }

      return single.length + batchTransferCount
    } catch (error: any) {
      // If response size exceeded and we can retry with smaller range
      if (error.message.includes('response size exceeded') && retryWithHalfRange && (endBlock - startBlock) > 1000) {
        console.error(`   ⚠️  Range too large (${startBlock}-${endBlock}), splitting in half...`)

        const midBlock = Math.floor((startBlock + endBlock) / 2)
        const firstHalf = await this.getOnChainEventCount(contractAddress, startBlock, midBlock, true)
        const secondHalf = await this.getOnChainEventCount(contractAddress, midBlock + 1, endBlock, true)

        if (firstHalf === -1 || secondHalf === -1) return -1
        return firstHalf + secondHalf
      }

      console.error(`   ❌ Error querying blocks ${startBlock}-${endBlock}:`, error.message.substring(0, 150))
      return -1
    }
  }

  /**
   * Find chunks with missing events
   */
  async findMissingChunks(
    contractAddress: string,
    deploymentBlock: number,
    chunkSize: number = 5000
  ): Promise<ChunkComparison[]> {
    console.log(`🔍 Comparing blockchain vs database event counts...\n`)
    console.log(`📦 Chunk size: ${chunkSize.toLocaleString()} blocks (safe for Alchemy 10k limit)`)
    console.log(`🎯 Contract: ${contractAddress}\n`)

    const currentBlock = await this.provider.getBlockNumber()
    const missingChunks: ChunkComparison[] = []

    let currentStart = deploymentBlock
    let chunkNumber = 0
    const totalChunks = Math.ceil((currentBlock - deploymentBlock) / chunkSize)

    while (currentStart <= currentBlock) {
      chunkNumber++
      const currentEnd = Math.min(currentStart + chunkSize - 1, currentBlock)
      const progress = (chunkNumber / totalChunks * 100).toFixed(1)

      process.stdout.write(`\r⏳ Progress: ${progress}% | Chunk ${chunkNumber}/${totalChunks} | Blocks ${currentStart.toLocaleString()}-${currentEnd.toLocaleString()}`)

      // Compare counts
      const dbCount = this.getDbEventCount(contractAddress, currentStart, currentEnd)
      const onChainCount = await this.getOnChainEventCount(contractAddress, currentStart, currentEnd)

      if (onChainCount !== -1 && onChainCount !== dbCount) {
        missingChunks.push({
          startBlock: currentStart,
          endBlock: currentEnd,
          onChainCount,
          dbCount,
          missing: onChainCount - dbCount
        })

        process.stdout.write(` ⚠️  MISMATCH FOUND!\n`)
      }

      currentStart = currentEnd + 1

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 150))
    }

    console.log('\n')
    return missingChunks
  }

  /**
   * Sync events from a specific block range
   */
  async syncRange(contractAddress: string, startBlock: number, endBlock: number): Promise<number> {
    const contract = new ethers.Contract(contractAddress, ERC1155_ABI, this.provider)

    const [singleEvents, batchEvents] = await Promise.all([
      contract.queryFilter(contract.filters.TransferSingle(), startBlock, endBlock),
      contract.queryFilter(contract.filters.TransferBatch(), startBlock, endBlock)
    ])

    let inserted = 0

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        transaction_hash, block_number, log_index, event_type,
        from_address, to_address, token_id, amount,
        operator, block_timestamp, contract_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const transaction = this.db.transaction(() => {
      // Process TransferSingle
      for (const event of singleEvents) {
        const result = insertStmt.run(
          event.transactionHash,
          event.blockNumber,
          event.index,
          'Transfer',
          event.args![1].toLowerCase(),
          event.args![2].toLowerCase(),
          event.args![3].toString(),
          event.args![4].toString(),
          event.args![0].toLowerCase(),
          0,
          contractAddress.toLowerCase()
        )
        if (result.changes > 0) inserted++
      }

      // Process TransferBatch
      for (const event of batchEvents) {
        const ids = event.args![3] as any[]
        const values = event.args![4] as any[]

        for (let i = 0; i < ids.length; i++) {
          const result = insertStmt.run(
            event.transactionHash,
            event.blockNumber,
            event.index + i * 0.001,
            'Transfer',
            event.args![1].toLowerCase(),
            event.args![2].toLowerCase(),
            ids[i].toString(),
            values[i].toString(),
            event.args![0].toLowerCase(),
            0,
            contractAddress.toLowerCase()
          )
          if (result.changes > 0) inserted++
        }
      }
    })

    transaction()
    return inserted
  }

  /**
   * Run the finding and syncing process
   */
  async run(contractAddress: string, deploymentBlock: number, fix: boolean = false, chunkSize: number = 5000) {
    const startTime = Date.now()

    // Find missing chunks
    const missingChunks = await this.findMissingChunks(contractAddress, deploymentBlock, chunkSize)

    if (missingChunks.length === 0) {
      console.log('✅ No missing events detected! Your database is complete.')
      return
    }

    // Show summary
    const totalMissing = missingChunks.reduce((sum, chunk) => sum + chunk.missing, 0)

    console.log(`${'='.repeat(60)}`)
    console.log(`📊 MISSING EVENTS DETECTED`)
    console.log(`${'='.repeat(60)}`)
    console.log(`Chunks with missing events: ${missingChunks.length}`)
    console.log(`Total missing events: ${totalMissing.toLocaleString()}\n`)

    console.log(`📋 Chunks with discrepancies:\n`)
    missingChunks.forEach((chunk, i) => {
      console.log(`${i + 1}. Blocks ${chunk.startBlock.toLocaleString()}-${chunk.endBlock.toLocaleString()}`)
      console.log(`   On-chain: ${chunk.onChainCount} | Database: ${chunk.dbCount} | Missing: ${chunk.missing}`)
    })

    if (!fix) {
      console.log(`\n💡 Run with --fix flag to sync missing events`)
      return
    }

    // Sync missing events
    console.log(`\n🔧 Syncing missing events...\n`)

    let totalSynced = 0

    for (let i = 0; i < missingChunks.length; i++) {
      const chunk = missingChunks[i]
      const progress = ((i + 1) / missingChunks.length * 100).toFixed(1)

      console.log(`⚡ [${progress}%] Syncing chunk ${i + 1}/${missingChunks.length}: Blocks ${chunk.startBlock.toLocaleString()}-${chunk.endBlock.toLocaleString()}...`)

      const synced = await this.syncRange(contractAddress, chunk.startBlock, chunk.endBlock)
      totalSynced += synced

      console.log(`   ✅ Synced ${synced} events`)

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Final stats
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`✅ SYNC COMPLETE!`)
    console.log(`${'='.repeat(60)}`)
    console.log(`Events synced: ${totalSynced.toLocaleString()}`)
    console.log(`Time elapsed: ${elapsed}s`)
    console.log(`${'='.repeat(60)}\n`)

    // Recalculate supply
    this.recalculateSupply(contractAddress)
  }

  /**
   * Recalculate token supply
   */
  recalculateSupply(contractAddress: string) {
    console.log(`📊 Recalculating token supply...`)

    const result = this.db.prepare(`
      SELECT
        SUM(CASE WHEN from_address = '0x0000000000000000000000000000000000000000' THEN amount ELSE 0 END) as minted,
        SUM(CASE WHEN to_address = '0x0000000000000000000000000000000000000000' THEN amount ELSE 0 END) as burned
      FROM events
      WHERE contract_address = ? COLLATE NOCASE
    `).get(contractAddress.toLowerCase()) as any

    const minted = parseInt(result.minted || '0')
    const burned = parseInt(result.burned || '0')
    const netSupply = minted - burned

    console.log(`\n📈 TOKEN SUPPLY:`)
    console.log(`   Minted: ${minted.toLocaleString()}`)
    console.log(`   Burned: ${burned.toLocaleString()}`)
    console.log(`   Net Supply: ${netSupply.toLocaleString()}`)

    this.db.prepare(`
      UPDATE contracts
      SET total_supply = ?, updated_at = CURRENT_TIMESTAMP
      WHERE address = ? COLLATE NOCASE
    `).run(netSupply.toString(), contractAddress.toLowerCase())

    console.log(`✅ Database updated!\n`)
  }

  close() {
    this.db.close()
  }
}

// CLI
function parseArgs() {
  const args = process.argv.slice(2)
  const options: any = {
    contract: null,
    deploymentBlock: null,
    fix: false,
    chunkSize: 5000
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--contract':
        options.contract = args[++i]
        break
      case '--deployment-block':
        options.deploymentBlock = parseInt(args[++i])
        break
      case '--chunk-size':
        options.chunkSize = parseInt(args[++i])
        break
      case '--fix':
        options.fix = true
        break
      case '--help':
        console.log(`
Find Missing Events Script

Usage: npx tsx scripts/find-missing-events.ts --contract <address> --deployment-block <block> [options]

Options:
  --contract <address>           Contract address (required)
  --deployment-block <number>    Deployment block number (required)
  --chunk-size <number>          Blocks per chunk (default: 5000, max: 10000 for Alchemy)
  --fix                          Sync missing events (without this, just shows report)
  --help                         Show this help

Examples:
  # Find missing events (read-only)
  npx tsx scripts/find-missing-events.ts --contract 0x33fd... --deployment-block 14933647

  # Use smaller chunks if hitting rate limits (2000 blocks per chunk)
  npx tsx scripts/find-missing-events.ts --contract 0x33fd... --deployment-block 14933647 --chunk-size 2000

  # Find and fix missing events
  npx tsx scripts/find-missing-events.ts --contract 0x33fd... --deployment-block 14933647 --fix
`)
        process.exit(0)
    }
  }

  if (!options.contract || !options.deploymentBlock) {
    console.error('❌ Error: --contract and --deployment-block are required\n')
    console.log('Run with --help for usage information')
    process.exit(1)
  }

  return options
}

async function main() {
  const options = parseArgs()
  const finder = new MissingEventFinder()

  try {
    await finder.run(options.contract, options.deploymentBlock, options.fix, options.chunkSize)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    finder.close()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export default main
