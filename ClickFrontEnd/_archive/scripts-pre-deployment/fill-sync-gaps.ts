#!/usr/bin/env npx tsx

/**
 * Fill Sync Gaps Script
 *
 * This script identifies and fills gaps in blockchain event syncing.
 * It's specifically designed to catch missing events that cause token count discrepancies.
 *
 * Usage:
 * npx tsx scripts/fill-sync-gaps.ts --contract <address>
 *
 * Options:
 * --contract <address>  Contract address to fill gaps for
 * --dry-run            Show gaps without syncing
 * --max-gap <number>   Maximum gap size to fill (default: 100000)
 */

import { ethers } from 'ethers'
import Database from 'better-sqlite3'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

// ERC-1155 ABI
const ERC1155_ABI = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]

interface Gap {
  startBlock: number
  endBlock: number
  size: number
}

interface SyncStats {
  gapsFilled: number
  blocksSynced: number
  eventsFound: number
  startTime: number
}

class GapFiller {
  private provider: ethers.JsonRpcProvider
  private db: Database.Database
  private stats: SyncStats

  constructor() {
    console.log('🔌 Initializing gap filler...')

    // Initialize provider
    if (ALCHEMY_API_KEY && ALCHEMY_API_KEY !== 'your_alchemy_api_key_here') {
      const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
      this.provider = new ethers.JsonRpcProvider(alchemyUrl)
      console.log('✅ Using Alchemy provider')
    } else {
      console.error('❌ ALCHEMY_API_KEY not configured!')
      process.exit(1)
    }

    // Initialize database
    const dbPath = path.join(__dirname, '..', 'data', 'nft-snapshot.db')
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    console.log(`💾 Database: ${dbPath}\n`)

    this.stats = {
      gapsFilled: 0,
      blocksSynced: 0,
      eventsFound: 0,
      startTime: Date.now()
    }
  }

  /**
   * Find gaps in block coverage
   */
  findGaps(contractAddress: string, maxGapSize: number = 100000): Gap[] {
    console.log(`🔍 Analyzing block coverage for ${contractAddress}...`)

    const query = `
      WITH block_ranges AS (
        SELECT
          block_number,
          LEAD(block_number) OVER (ORDER BY block_number) as next_block
        FROM events
        WHERE contract_address = ? COLLATE NOCASE
        GROUP BY block_number
      )
      SELECT
        block_number + 1 as start_block,
        next_block - 1 as end_block,
        next_block - block_number - 1 as gap_size
      FROM block_ranges
      WHERE next_block - block_number > 1
      AND next_block - block_number - 1 <= ?
      ORDER BY block_number
    `

    const gaps = this.db.prepare(query).all(
      contractAddress.toLowerCase(),
      maxGapSize
    ) as any[]

    return gaps.map(g => ({
      startBlock: g.start_block,
      endBlock: g.end_block,
      size: g.gap_size
    }))
  }

  /**
   * Fill a single gap
   */
  async fillGap(contractAddress: string, gap: Gap): Promise<number> {
    const contract = new ethers.Contract(contractAddress, ERC1155_ABI, this.provider)
    let eventsFound = 0

    try {
      // Use smaller chunks for large gaps
      const CHUNK_SIZE = Math.min(2000, gap.size)
      let currentStart = gap.startBlock

      while (currentStart <= gap.endBlock) {
        const currentEnd = Math.min(currentStart + CHUNK_SIZE - 1, gap.endBlock)

        // Fetch events
        const [singleEvents, batchEvents] = await Promise.all([
          contract.queryFilter(contract.filters.TransferSingle(), currentStart, currentEnd),
          contract.queryFilter(contract.filters.TransferBatch(), currentStart, currentEnd)
        ])

        // Process events
        if (singleEvents.length > 0 || batchEvents.length > 0) {
          eventsFound += await this.storeEvents(
            contractAddress,
            [...singleEvents, ...batchEvents]
          )
        }

        currentStart = currentEnd + 1

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      return eventsFound
    } catch (error: any) {
      console.error(`   ❌ Error filling gap ${gap.startBlock}-${gap.endBlock}:`, error.message)
      return 0
    }
  }

  /**
   * Store events in database
   */
  private async storeEvents(contractAddress: string, events: any[]): Promise<number> {
    if (events.length === 0) return 0

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        transaction_hash, block_number, log_index, event_type,
        from_address, to_address, token_id, amount,
        operator, block_timestamp, contract_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let inserted = 0

    const transaction = this.db.transaction(() => {
      for (const event of events) {
        const eventName = event.fragment?.name || event.eventName

        if (eventName === 'TransferSingle') {
          const result = insertStmt.run(
            event.transactionHash,
            event.blockNumber,
            event.index,
            'Transfer',
            event.args[1].toLowerCase(), // from
            event.args[2].toLowerCase(), // to
            event.args[3].toString(), // id
            event.args[4].toString(), // value
            event.args[0].toLowerCase(), // operator
            0, // timestamp (will be updated later if needed)
            contractAddress.toLowerCase()
          )
          if (result.changes > 0) inserted++

        } else if (eventName === 'TransferBatch') {
          const ids = event.args[3]
          const values = event.args[4]

          for (let i = 0; i < ids.length; i++) {
            const result = insertStmt.run(
              event.transactionHash,
              event.blockNumber,
              event.index + i * 0.001, // Pseudo log index for batch items
              'Transfer',
              event.args[1].toLowerCase(),
              event.args[2].toLowerCase(),
              ids[i].toString(),
              values[i].toString(),
              event.args[0].toLowerCase(),
              0,
              contractAddress.toLowerCase()
            )
            if (result.changes > 0) inserted++
          }
        }
      }
    })

    transaction()
    return inserted
  }

  /**
   * Run gap filling process
   */
  async run(contractAddress: string, dryRun: boolean = false, maxGapSize: number = 100000) {
    console.log(`🎯 Target contract: ${contractAddress}`)
    console.log(`📏 Maximum gap size: ${maxGapSize.toLocaleString()} blocks`)
    console.log(`${dryRun ? '🔍 DRY RUN MODE' : '🚀 LIVE MODE'}\n`)

    // Find gaps
    const gaps = this.findGaps(contractAddress, maxGapSize)

    if (gaps.length === 0) {
      console.log('✅ No gaps found! Your blockchain data is complete.')
      return
    }

    // Show gap summary
    const totalBlocks = gaps.reduce((sum, gap) => sum + gap.size, 0)
    console.log(`\n📊 GAP ANALYSIS:`)
    console.log(`   Total gaps found: ${gaps.length.toLocaleString()}`)
    console.log(`   Total missing blocks: ${totalBlocks.toLocaleString()}`)
    console.log(`   Smallest gap: ${Math.min(...gaps.map(g => g.size)).toLocaleString()} blocks`)
    console.log(`   Largest gap: ${Math.max(...gaps.map(g => g.size)).toLocaleString()} blocks`)

    // Show first 10 gaps
    console.log(`\n📋 First 10 gaps:`)
    gaps.slice(0, 10).forEach((gap, i) => {
      console.log(`   ${i + 1}. Blocks ${gap.startBlock.toLocaleString()}-${gap.endBlock.toLocaleString()} (${gap.size.toLocaleString()} blocks)`)
    })

    if (dryRun) {
      console.log(`\n✅ Dry run complete. Run without --dry-run to fill these gaps.`)
      return
    }

    // Fill gaps
    console.log(`\n🔧 Filling gaps...\n`)

    for (let i = 0; i < gaps.length; i++) {
      const gap = gaps[i]
      const progress = ((i + 1) / gaps.length * 100).toFixed(1)

      console.log(`⚡ [${progress}%] Gap ${i + 1}/${gaps.length}: Blocks ${gap.startBlock.toLocaleString()}-${gap.endBlock.toLocaleString()}...`)

      const eventsFound = await this.fillGap(contractAddress, gap)

      if (eventsFound > 0) {
        console.log(`   ✅ Found ${eventsFound} missing events!`)
        this.stats.eventsFound += eventsFound
      } else {
        console.log(`   ℹ️  No events in this gap (expected for blocks without activity)`)
      }

      this.stats.gapsFilled++
      this.stats.blocksSynced += gap.size
    }

    // Show final stats
    const elapsed = ((Date.now() - this.stats.startTime) / 1000).toFixed(0)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`✅ GAP FILLING COMPLETE!`)
    console.log(`${'='.repeat(60)}`)
    console.log(`   Gaps filled: ${this.stats.gapsFilled.toLocaleString()}`)
    console.log(`   Blocks synced: ${this.stats.blocksSynced.toLocaleString()}`)
    console.log(`   Events found: ${this.stats.eventsFound.toLocaleString()}`)
    console.log(`   Time elapsed: ${elapsed}s`)
    console.log(`${'='.repeat(60)}\n`)

    // Recalculate token supply
    await this.recalculateSupply(contractAddress)
  }

  /**
   * Recalculate token supply after filling gaps
   */
  private async recalculateSupply(contractAddress: string) {
    console.log(`📊 Recalculating token supply...`)

    const query = `
      SELECT
        SUM(CASE WHEN from_address = '0x0000000000000000000000000000000000000000' THEN amount ELSE 0 END) as minted,
        SUM(CASE WHEN to_address = '0x0000000000000000000000000000000000000000' THEN amount ELSE 0 END) as burned
      FROM events
      WHERE contract_address = ? COLLATE NOCASE
    `

    const result = this.db.prepare(query).get(contractAddress.toLowerCase()) as any

    const minted = parseInt(result.minted || '0')
    const burned = parseInt(result.burned || '0')
    const netSupply = minted - burned

    console.log(`\n📈 TOKEN SUPPLY:`)
    console.log(`   Minted: ${minted.toLocaleString()}`)
    console.log(`   Burned: ${burned.toLocaleString()}`)
    console.log(`   Net Supply: ${netSupply.toLocaleString()}`)

    // Update contract total supply
    this.db.prepare(`
      UPDATE contracts
      SET total_supply = ?, updated_at = CURRENT_TIMESTAMP
      WHERE address = ? COLLATE NOCASE
    `).run(netSupply.toString(), contractAddress.toLowerCase())

    console.log(`✅ Contract total_supply updated in database\n`)
  }

  close() {
    this.db.close()
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2)
  const options: any = {
    contract: null,
    dryRun: false,
    maxGap: 100000
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--contract':
        options.contract = args[++i]
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--max-gap':
        options.maxGap = parseInt(args[++i])
        break
      case '--help':
        console.log(`
Fill Sync Gaps Script

Usage: npx tsx scripts/fill-sync-gaps.ts --contract <address> [options]

Options:
  --contract <address>   Contract address to fill gaps for (required)
  --dry-run             Show gaps without syncing
  --max-gap <number>    Maximum gap size to fill (default: 100000)
  --help                Show this help message

Examples:
  # Analyze gaps (dry run)
  npx tsx scripts/fill-sync-gaps.ts --contract 0x33fd... --dry-run

  # Fill all gaps up to 100k blocks
  npx tsx scripts/fill-sync-gaps.ts --contract 0x33fd...

  # Fill smaller gaps only (up to 10k blocks)
  npx tsx scripts/fill-sync-gaps.ts --contract 0x33fd... --max-gap 10000
`)
        process.exit(0)
    }
  }

  if (!options.contract) {
    console.error('❌ Error: --contract parameter is required\n')
    console.log('Run with --help for usage information')
    process.exit(1)
  }

  return options
}

// Main execution
async function main() {
  const options = parseArgs()
  const filler = new GapFiller()

  try {
    await filler.run(options.contract, options.dryRun, options.maxGap)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    filler.close()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export default main
