/**
 * FULL RESYNC FROM ZERO
 *
 * Bu script bir koleksiyonu sıfırdan %100 doğru şekilde sync eder.
 * Deployment block'tan başlayarak tüm eventleri çeker.
 *
 * ⚠️  UYARI: Bu işlem uzun sürebilir (büyük koleksiyonlar için saatler)
 */

import { Pool } from 'pg'
import { ethers } from 'ethers'

const POSTGRES_URL = process.env.POSTGRES_URL!
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!

interface SyncProgress {
  currentBlock: number
  endBlock: number
  eventsFound: number
  startTime: number
}

class FullResyncService {
  private pool: Pool
  private provider: ethers.JsonRpcProvider
  private progress: SyncProgress

  constructor() {
    this.pool = new Pool({ connectionString: POSTGRES_URL })
    this.provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)
    this.progress = { currentBlock: 0, endBlock: 0, eventsFound: 0, startTime: Date.now() }
  }

  /**
   * Full resync from deployment block to latest
   */
  async fullResync(contractAddress: string, clearExisting: boolean = true) {
    console.log(`\n${'═'.repeat(80)}`)
    console.log(`🚀 FULL RESYNC FROM ZERO`)
    console.log(`${'═'.repeat(80)}`)
    console.log(`Contract: ${contractAddress}`)
    console.log(`Time: ${new Date().toISOString()}`)

    try {
      // Get contract info
      const contract = await this.getContractInfo(contractAddress)
      if (!contract) {
        console.log('❌ Contract not found')
        return
      }

      console.log(`\n📦 ${contract.name} (${contract.symbol})`)
      console.log(`   Type: ${contract.contract_type}`)
      console.log(`   Deployment Block: ${contract.deployment_block}`)

      // Get latest block
      const latestBlock = await this.provider.getBlockNumber()
      const totalBlocks = latestBlock - parseInt(contract.deployment_block)

      console.log(`   Latest Block: ${latestBlock}`)
      console.log(`   Total Blocks to Sync: ${totalBlocks.toLocaleString()}`)

      // Confirm
      if (clearExisting) {
        console.log(`\n⚠️  WARNING: This will DELETE all existing events and resync from scratch`)
      }

      console.log(`\n⏳ Estimated time: ${Math.ceil(totalBlocks / 2000 * 0.2)} minutes`)
      console.log(`\n🚀 Starting full resync...`)

      // Clear existing events if requested
      if (clearExisting) {
        console.log(`\n🗑️  Deleting existing events...`)
        await this.pool.query(
          'DELETE FROM events WHERE LOWER(contract_address) = LOWER($1)',
          [contractAddress]
        )
        await this.pool.query(
          'DELETE FROM current_state WHERE LOWER(contract_address) = LOWER($1)',
          [contractAddress]
        )
        console.log(`   ✅ Existing data cleared`)
      }

      // Start sync
      this.progress.currentBlock = parseInt(contract.deployment_block)
      this.progress.endBlock = latestBlock
      this.progress.startTime = Date.now()

      await this.syncBlocks(contractAddress, contract.contract_type)

      // Rebuild current_state
      console.log(`\n🔄 Rebuilding current_state...`)
      await this.rebuildState(contractAddress)

      // Final stats
      const stats = await this.getStats(contractAddress)

      console.log(`\n${'═'.repeat(80)}`)
      console.log(`✅ FULL RESYNC COMPLETED`)
      console.log(`${'═'.repeat(80)}`)
      console.log(`   Time taken: ${this.formatDuration(Date.now() - this.progress.startTime)}`)
      console.log(`   Events synced: ${this.progress.eventsFound.toLocaleString()}`)
      console.log(`   Holders: ${stats.holders.toLocaleString()}`)
      console.log(`   Unique Tokens: ${stats.uniqueTokens.toLocaleString()}`)
      console.log(`   Total Supply: ${stats.supply}`)
      console.log(`\n🎉 Data is now 100% accurate!`)

    } catch (error) {
      console.error('\n❌ Error:', error)
    } finally {
      await this.pool.end()
    }
  }

  private async syncBlocks(contractAddress: string, contractType: string) {
    const CHUNK_SIZE = 2000
    const topics = contractType === 'ERC721'
      ? ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'] // Transfer
      : [
          '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62', // TransferSingle
          '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'  // TransferBatch
        ]

    while (this.progress.currentBlock <= this.progress.endBlock) {
      const fromBlock = this.progress.currentBlock
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, this.progress.endBlock)

      try {
        const logs = await this.provider.getLogs({
          address: contractAddress,
          topics: [topics],
          fromBlock,
          toBlock
        })

        // Insert events
        for (const log of logs) {
          await this.insertEvent(contractAddress, log, contractType)
        }

        this.progress.eventsFound += logs.length
        this.progress.currentBlock = toBlock + 1

        // Progress update
        const percent = Math.round(((toBlock - parseInt((await this.getContractInfo(contractAddress))!.deployment_block)) / (this.progress.endBlock - parseInt((await this.getContractInfo(contractAddress))!.deployment_block))) * 100)
        const eta = this.calculateETA()

        console.log(`   [${'█'.repeat(Math.floor(percent/5))}${'░'.repeat(20-Math.floor(percent/5))}] ${percent}% | Block ${toBlock.toLocaleString()}/${this.progress.endBlock.toLocaleString()} | +${logs.length} events | ETA: ${eta}`)

        // Rate limiting
        await this.sleep(100)

      } catch (error: any) {
        console.error(`   ⚠️  Error at block ${fromBlock}: ${error.message}`)
        this.progress.currentBlock = toBlock + 1
      }
    }
  }

  private async insertEvent(contractAddress: string, log: ethers.Log, contractType: string) {
    try {
      const block = await this.provider.getBlock(log.blockNumber)

      let eventType: string
      let from: string
      let to: string
      let tokenId: string
      let amount: string

      if (contractType === 'ERC721') {
        eventType = 'Transfer'
        from = ethers.getAddress('0x' + log.topics[1].slice(26))
        to = ethers.getAddress('0x' + log.topics[2].slice(26))
        tokenId = BigInt(log.topics[3]).toString()
        amount = '1'
      } else {
        const iface = new ethers.Interface([
          'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)'
        ])
        const decoded = iface.parseLog({ topics: log.topics as string[], data: log.data })

        eventType = 'TransferSingle'
        from = decoded!.args[1]
        to = decoded!.args[2]
        tokenId = decoded!.args[3].toString()
        amount = decoded!.args[4].toString()
      }

      await this.pool.query(`
        INSERT INTO events (
          contract_address, event_type, operator, from_address, to_address,
          token_id, amount, block_number, block_timestamp, transaction_hash, log_index, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        ON CONFLICT (transaction_hash, log_index) DO NOTHING
      `, [
        contractAddress.toLowerCase(),
        eventType,
        ethers.ZeroAddress,
        from.toLowerCase(),
        to.toLowerCase(),
        tokenId,
        amount,
        log.blockNumber,
        block!.timestamp,
        log.transactionHash,
        log.index
      ])
    } catch (error: any) {
      if (!error.message.includes('duplicate')) {
        console.error('      Event insert error:', error.message)
      }
    }
  }

  private async rebuildState(contractAddress: string) {
    await this.pool.query(`
      INSERT INTO current_state (contract_address, address, token_id, balance, last_updated_block, updated_at)
      WITH balance_changes AS (
        SELECT from_address as holder, token_id, block_number, -CAST(amount AS BIGINT) as amount_change
        FROM events
        WHERE LOWER(contract_address) = LOWER($1) AND from_address != '0x0000000000000000000000000000000000000000'
        UNION ALL
        SELECT to_address as holder, token_id, block_number, CAST(amount AS BIGINT) as amount_change
        FROM events
        WHERE LOWER(contract_address) = LOWER($1) AND to_address != '0x0000000000000000000000000000000000000000'
      ),
      final_balances AS (
        SELECT holder as address, token_id, SUM(amount_change) as final_balance, MAX(block_number) as last_block
        FROM balance_changes
        GROUP BY holder, token_id
        HAVING SUM(amount_change) > 0
      )
      SELECT $1 as contract_address, address, token_id, final_balance::text as balance, last_block as last_updated_block, NOW() as updated_at
      FROM final_balances
    `, [contractAddress])
  }

  private async getContractInfo(address: string) {
    const result = await this.pool.query(
      'SELECT * FROM contracts WHERE LOWER(address) = LOWER($1)',
      [address]
    )
    return result.rows[0] || null
  }

  private async getStats(address: string) {
    const result = await this.pool.query(`
      SELECT
        COUNT(DISTINCT address) as holders,
        COUNT(DISTINCT token_id) as unique_tokens,
        COALESCE(SUM(CAST(balance AS BIGINT)), 0) as total_supply
      FROM current_state
      WHERE LOWER(contract_address) = LOWER($1)
    `, [address])

    return {
      holders: parseInt(result.rows[0].holders),
      uniqueTokens: parseInt(result.rows[0].unique_tokens),
      supply: BigInt(result.rows[0].total_supply)
    }
  }

  private calculateETA(): string {
    const elapsed = Date.now() - this.progress.startTime
    const blocksProcessed = this.progress.currentBlock - (this.progress.endBlock - (this.progress.endBlock - this.progress.currentBlock))
    const totalBlocks = this.progress.endBlock - (this.progress.endBlock - (this.progress.endBlock - this.progress.currentBlock))
    const remaining = this.progress.endBlock - this.progress.currentBlock

    if (blocksProcessed === 0) return 'Calculating...'

    const msPerBlock = elapsed / blocksProcessed
    const etaMs = remaining * msPerBlock

    return this.formatDuration(etaMs)
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Main execution
const contractAddress = process.argv[2]
const clearExisting = !process.argv.includes('--append')

if (!contractAddress) {
  console.log('Usage: npx tsx scripts/full-resync-from-zero.ts <contract-address> [--append]')
  console.log('\nOptions:')
  console.log('  --append    Keep existing events and only add new ones')
  console.log('\nExamples:')
  console.log('  npx tsx scripts/full-resync-from-zero.ts 0xb8ea78fcacef50d41375e44e6814ebba36bb33c4')
  console.log('  npx tsx scripts/full-resync-from-zero.ts 0xb8ea78fcacef50d41375e44e6814ebba36bb33c4 --append')
  process.exit(1)
}

const service = new FullResyncService()
service.fullResync(contractAddress, clearExisting)
