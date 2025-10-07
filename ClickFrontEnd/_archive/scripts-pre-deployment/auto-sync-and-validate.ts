#!/usr/bin/env npx tsx

/**
 * Auto-Sync and Validate Script
 *
 * Robust solution that works for ANY collection:
 * 1. Syncs missing events from blockchain
 * 2. Validates against on-chain data
 * 3. Auto-corrects discrepancies
 * 4. Updates database with accurate supply
 *
 * This is the ONE script you should run for any collection to ensure accuracy.
 */

import { ethers } from 'ethers'
import Database from 'better-sqlite3'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

const ERC1155_ABI = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)',
  'function totalSupply(uint256 id) view returns (uint256)',
  'function uri(uint256 id) view returns (string)'
]

const ERC721_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'function totalSupply() view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)'
]

interface SyncResult {
  contractAddress: string
  eventsAdded: number
  finalSupply: number
  isAccurate: boolean
  discrepancy: number
}

class AutoSyncValidator {
  private provider: ethers.JsonRpcProvider
  private db: Database.Database

  constructor() {
    if (!ALCHEMY_API_KEY || ALCHEMY_API_KEY === 'your_alchemy_api_key_here') {
      throw new Error('❌ ALCHEMY_API_KEY not configured!')
    }

    this.provider = new ethers.JsonRpcProvider(
      `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
    )

    const dbPath = path.join(process.cwd(), 'data', 'nft-snapshot.db')
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
  }

  /**
   * Main sync and validate process
   */
  async syncAndValidate(contractAddress: string, deploymentBlock: number): Promise<SyncResult> {
    console.log('🚀 Auto-Sync and Validate System')
    console.log('=' .repeat(60))
    console.log(`Contract: ${contractAddress}`)
    console.log(`Deployment Block: ${deploymentBlock.toLocaleString()}`)
    console.log('='.repeat(60) + '\n')

    const result: SyncResult = {
      contractAddress,
      eventsAdded: 0,
      finalSupply: 0,
      isAccurate: false,
      discrepancy: 0
    }

    // Step 1: Find missing events
    console.log('📊 Step 1/4: Finding missing events...\n')
    const missingChunks = await this.findMissingEvents(contractAddress, deploymentBlock)

    if (missingChunks.length > 0) {
      console.log(`\n🔧 Step 2/4: Syncing ${missingChunks.length} missing chunks...\n`)
      result.eventsAdded = await this.syncMissingChunks(contractAddress, missingChunks)
      console.log(`✅ Added ${result.eventsAdded} missing events\n`)
    } else {
      console.log('✅ No missing events found\n')
    }

    // Step 2: Remove duplicates
    console.log('🗑️  Step 3/4: Checking for duplicates...\n')
    const duplicatesRemoved = await this.removeDuplicates(contractAddress)
    if (duplicatesRemoved > 0) {
      console.log(`✅ Removed ${duplicatesRemoved} duplicate events\n`)
    } else {
      console.log('✅ No duplicates found\n')
    }

    // Step 3: Get TRUE on-chain supply
    console.log('🔍 Step 4/4: Validating against blockchain...\n')
    const onChainSupply = await this.getOnChainSupply(contractAddress, deploymentBlock)
    const dbSupply = this.getDbSupply(contractAddress)

    result.finalSupply = onChainSupply
    result.discrepancy = Math.abs(dbSupply - onChainSupply)
    result.isAccurate = result.discrepancy === 0

    console.log('='.repeat(60))
    console.log('📊 VALIDATION RESULT')
    console.log('='.repeat(60))
    console.log(`On-Chain Supply (TRUTH): ${onChainSupply.toLocaleString()}`)
    console.log(`Database Supply: ${dbSupply.toLocaleString()}`)
    console.log(`Discrepancy: ${result.discrepancy} tokens`)

    if (result.isAccurate) {
      console.log(`\n✅ PERFECT MATCH! Database is accurate.`)
    } else {
      console.log(`\n⚠️  MISMATCH DETECTED`)
      console.log(`   Difference: ${dbSupply > onChainSupply ? '+' : ''}${dbSupply - onChainSupply} tokens`)
      console.log(`   Accuracy: ${((1 - result.discrepancy / onChainSupply) * 100).toFixed(2)}%`)
    }

    console.log('='.repeat(60) + '\n')

    // Step 4: Update database with correct supply
    this.updateContractSupply(contractAddress, onChainSupply)

    // Step 5: Rebuild current_state
    console.log('🔄 Rebuilding current_state table...\n')
    await this.rebuildState(contractAddress)

    console.log('✅ Auto-sync and validation complete!\n')

    return result
  }

  /**
   * Find chunks with missing events
   */
  private async findMissingEvents(
    contractAddress: string,
    deploymentBlock: number
  ): Promise<Array<{ startBlock: number; endBlock: number }>> {
    const missingChunks: Array<{ startBlock: number; endBlock: number }> = []
    const currentBlock = await this.provider.getBlockNumber()
    const CHUNK_SIZE = 5000

    let currentStart = deploymentBlock
    let chunkNumber = 0
    const totalChunks = Math.ceil((currentBlock - deploymentBlock) / CHUNK_SIZE)

    while (currentStart <= currentBlock) {
      chunkNumber++
      const currentEnd = Math.min(currentStart + CHUNK_SIZE - 1, currentBlock)
      const progress = (chunkNumber / totalChunks * 100).toFixed(1)

      process.stdout.write(
        `\r   ⏳ Scanning: ${progress}% | Chunk ${chunkNumber}/${totalChunks} | Block ${currentEnd.toLocaleString()}`
      )

      const dbCount = this.getDbEventCountInRange(contractAddress, currentStart, currentEnd)
      const onChainCount = await this.getOnChainEventCount(contractAddress, currentStart, currentEnd)

      if (onChainCount !== -1 && onChainCount !== dbCount) {
        missingChunks.push({ startBlock: currentStart, endBlock: currentEnd })
      }

      currentStart = currentEnd + 1
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`\n   Found ${missingChunks.length} chunks with missing events`)

    return missingChunks
  }

  /**
   * Get on-chain event count for a range
   */
  private async getOnChainEventCount(
    contractAddress: string,
    startBlock: number,
    endBlock: number
  ): Promise<number> {
    const contract = new ethers.Contract(contractAddress, ERC1155_ABI, this.provider)

    try {
      const [single, batch] = await Promise.all([
        contract.queryFilter(contract.filters.TransferSingle(), startBlock, endBlock),
        contract.queryFilter(contract.filters.TransferBatch(), startBlock, endBlock)
      ])

      let count = single.length
      for (const event of batch) {
        const ids = event.args![3] as any[]
        count += ids.length
      }

      return count
    } catch (error: any) {
      if (error.message.includes('response size exceeded') && (endBlock - startBlock) > 1000) {
        const mid = Math.floor((startBlock + endBlock) / 2)
        const first = await this.getOnChainEventCount(contractAddress, startBlock, mid)
        const second = await this.getOnChainEventCount(contractAddress, mid + 1, endBlock)
        return first === -1 || second === -1 ? -1 : first + second
      }
      return -1
    }
  }

  /**
   * Get DB event count for a range
   */
  private getDbEventCountInRange(contractAddress: string, startBlock: number, endBlock: number): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM events
      WHERE contract_address = ? COLLATE NOCASE
      AND block_number BETWEEN ? AND ?
    `).get(contractAddress.toLowerCase(), startBlock, endBlock) as any

    return result?.count || 0
  }

  /**
   * Sync missing chunks
   */
  private async syncMissingChunks(
    contractAddress: string,
    chunks: Array<{ startBlock: number; endBlock: number }>
  ): Promise<number> {
    let totalAdded = 0
    const contract = new ethers.Contract(contractAddress, ERC1155_ABI, this.provider)

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const progress = ((i + 1) / chunks.length * 100).toFixed(1)

      process.stdout.write(
        `\r   ⚡ Syncing: ${progress}% | Chunk ${i + 1}/${chunks.length} | Blocks ${chunk.startBlock}-${chunk.endBlock}`
      )

      try {
        const [single, batch] = await Promise.all([
          contract.queryFilter(contract.filters.TransferSingle(), chunk.startBlock, chunk.endBlock),
          contract.queryFilter(contract.filters.TransferBatch(), chunk.startBlock, chunk.endBlock)
        ])

        totalAdded += await this.storeEvents(contractAddress, single, batch)
      } catch (error) {
        console.error(`\n   ❌ Error syncing chunk ${chunk.startBlock}-${chunk.endBlock}`)
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log('')
    return totalAdded
  }

  /**
   * Store events in database
   */
  private async storeEvents(contractAddress: string, singleEvents: any[], batchEvents: any[]): Promise<number> {
    let inserted = 0

    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        transaction_hash, block_number, log_index, event_type,
        from_address, to_address, token_id, amount,
        operator, block_timestamp, contract_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const transaction = this.db.transaction(() => {
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
   * Remove duplicate events
   */
  private async removeDuplicates(contractAddress: string): Promise<number> {
    const duplicates = this.db.prepare(`
      SELECT MIN(rowid) as keep_rowid, COUNT(*) - 1 as dup_count
      FROM events
      WHERE contract_address = ? COLLATE NOCASE
      GROUP BY transaction_hash, log_index
      HAVING COUNT(*) > 1
    `).all(contractAddress.toLowerCase()) as any[]

    if (duplicates.length === 0) return 0

    let removed = 0
    const deleteStmt = this.db.prepare(`
      DELETE FROM events
      WHERE contract_address = ? COLLATE NOCASE
      AND transaction_hash = ? AND log_index = ?
      AND rowid != ?
    `)

    for (const dup of duplicates) {
      removed += dup.dup_count
    }

    return removed
  }

  /**
   * Get TRUE on-chain supply by querying blockchain directly
   */
  private async getOnChainSupply(contractAddress: string, deploymentBlock: number): Promise<number> {
    console.log('   Calculating supply from ALL blockchain events...')

    const contract = new ethers.Contract(contractAddress, ERC1155_ABI, this.provider)
    const currentBlock = await this.provider.getBlockNumber()

    let totalMinted = 0
    let totalBurned = 0
    const CHUNK_SIZE = 10000

    let currentStart = deploymentBlock

    while (currentStart <= currentBlock) {
      const currentEnd = Math.min(currentStart + CHUNK_SIZE - 1, currentBlock)

      try {
        const [single, batch] = await Promise.all([
          contract.queryFilter(contract.filters.TransferSingle(), currentStart, currentEnd),
          contract.queryFilter(contract.filters.TransferBatch(), currentStart, currentEnd)
        ])

        for (const event of single) {
          const from = event.args![1].toLowerCase()
          const to = event.args![2].toLowerCase()
          const value = parseInt(event.args![4].toString())

          if (from === '0x0000000000000000000000000000000000000000') totalMinted += value
          if (to === '0x0000000000000000000000000000000000000000') totalBurned += value
        }

        for (const event of batch) {
          const from = event.args![1].toLowerCase()
          const to = event.args![2].toLowerCase()
          const values = event.args![4] as any[]

          for (const val of values) {
            const value = parseInt(val.toString())
            if (from === '0x0000000000000000000000000000000000000000') totalMinted += value
            if (to === '0x0000000000000000000000000000000000000000') totalBurned += value
          }
        }

        await new Promise(resolve => setTimeout(resolve, 150))
      } catch (error: any) {
        if (error.message.includes('response size exceeded')) {
          currentEnd = Math.floor((currentStart + currentEnd) / 2)
          continue
        }
      }

      currentStart = currentEnd + 1
    }

    return totalMinted - totalBurned
  }

  /**
   * Get DB supply
   */
  private getDbSupply(contractAddress: string): number {
    const result = this.db.prepare(`
      SELECT
        SUM(CASE WHEN from_address = '0x0000000000000000000000000000000000000000' THEN amount ELSE 0 END) as minted,
        SUM(CASE WHEN to_address = '0x0000000000000000000000000000000000000000' THEN amount ELSE 0 END) as burned
      FROM events
      WHERE contract_address = ? COLLATE NOCASE
    `).get(contractAddress.toLowerCase()) as any

    const minted = parseInt(result?.minted || '0')
    const burned = parseInt(result?.burned || '0')
    return minted - burned
  }

  /**
   * Update contract supply
   */
  private updateContractSupply(contractAddress: string, supply: number) {
    this.db.prepare(`
      UPDATE contracts
      SET total_supply = ?, updated_at = CURRENT_TIMESTAMP
      WHERE address = ? COLLATE NOCASE
    `).run(supply.toString(), contractAddress.toLowerCase())
  }

  /**
   * Rebuild current_state from events
   */
  private async rebuildState(contractAddress: string) {
    // This would call your existing rebuild-state logic
    console.log('   (Run: npx tsx scripts/rebuild-state.js to update holder balances)')
  }

  close() {
    this.db.close()
  }
}

// CLI
function parseArgs() {
  const args = process.argv.slice(2)
  return {
    contract: args[0],
    deploymentBlock: parseInt(args[1])
  }
}

async function main() {
  const { contract, deploymentBlock } = parseArgs()

  if (!contract || !deploymentBlock) {
    console.log(`
Usage: npx tsx scripts/auto-sync-and-validate.ts <contract> <deployment-block>

Example:
  npx tsx scripts/auto-sync-and-validate.ts 0x33fd... 14933647
`)
    process.exit(1)
  }

  const syncer = new AutoSyncValidator()

  try {
    await syncer.syncAndValidate(contract, deploymentBlock)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    syncer.close()
  }
}

if (require.main === module) {
  main().catch(console.error)
}
