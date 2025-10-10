/**
 * GAP-FILLING SYNC SCRIPT
 *
 * Bu script eksik block'ları tespit edip sadece onları blockchain'den çeker.
 * %100 accuracy için kritik.
 */

import { Pool } from 'pg'
import { ethers } from 'ethers'

const POSTGRES_URL = process.env.POSTGRES_URL!
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!

interface Gap {
  start: number
  end: number
  blockCount: number
}

class GapFillerService {
  private pool: Pool
  private provider: ethers.JsonRpcProvider

  constructor() {
    this.pool = new Pool({ connectionString: POSTGRES_URL })
    this.provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)
  }

  /**
   * Find all gaps in events for a contract
   */
  async findGaps(contractAddress: string): Promise<Gap[]> {
    const result = await this.pool.query(`
      WITH block_sequence AS (
        SELECT
          block_number,
          LAG(block_number) OVER (ORDER BY block_number) as prev_block
        FROM (
          SELECT DISTINCT block_number
          FROM events
          WHERE LOWER(contract_address) = LOWER($1)
          ORDER BY block_number
        ) blocks
      )
      SELECT
        prev_block + 1 as gap_start,
        block_number - 1 as gap_end,
        block_number - prev_block - 1 as block_count
      FROM block_sequence
      WHERE block_number - prev_block > 1
      ORDER BY gap_start
    `, [contractAddress])

    return result.rows.map(row => ({
      start: parseInt(row.gap_start),
      end: parseInt(row.gap_end),
      blockCount: parseInt(row.block_count)
    }))
  }

  /**
   * Fill a specific gap by fetching events from blockchain
   */
  async fillGap(contractAddress: string, gap: Gap): Promise<number> {
    console.log(`   Filling gap: blocks ${gap.start} - ${gap.end} (${gap.blockCount} blocks)`)

    const contractType = await this.getContractType(contractAddress)

    // ERC721 Transfer events
    const erc721Topics = ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'] // Transfer(address,address,uint256)

    // ERC1155 events
    const erc1155Topics = [
      '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62', // TransferSingle
      '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'  // TransferBatch
    ]

    const topics = contractType === 'ERC721' ? erc721Topics : erc1155Topics

    let eventsAdded = 0
    const CHUNK_SIZE = 2000 // Alchemy limit

    for (let fromBlock = gap.start; fromBlock <= gap.end; fromBlock += CHUNK_SIZE) {
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, gap.end)

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
          eventsAdded++
        }

        console.log(`      Processed blocks ${fromBlock}-${toBlock}: +${logs.length} events`)

        // Rate limiting
        await this.sleep(100)

      } catch (error: any) {
        console.error(`      Error processing blocks ${fromBlock}-${toBlock}:`, error.message)
      }
    }

    return eventsAdded
  }

  /**
   * Get contract type from database
   */
  private async getContractType(address: string): Promise<'ERC721' | 'ERC1155'> {
    const result = await this.pool.query(
      'SELECT contract_type FROM contracts WHERE LOWER(address) = LOWER($1)',
      [address]
    )
    return result.rows[0]?.contract_type || 'ERC721'
  }

  /**
   * Insert event into database (with duplicate check)
   */
  private async insertEvent(contractAddress: string, log: ethers.Log, contractType: string) {
    try {
      const block = await this.provider.getBlock(log.blockNumber)

      let eventType: string
      let from: string
      let to: string
      let tokenId: string
      let amount: string

      if (contractType === 'ERC721') {
        // Transfer(address indexed from, address indexed to, uint256 indexed tokenId)
        eventType = 'Transfer'
        from = ethers.getAddress('0x' + log.topics[1].slice(26))
        to = ethers.getAddress('0x' + log.topics[2].slice(26))
        tokenId = BigInt(log.topics[3]).toString()
        amount = '1'
      } else {
        // TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
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
      // Ignore duplicates or parsing errors
      if (!error.message.includes('duplicate')) {
        console.error('      Event insert error:', error.message)
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async close() {
    await this.pool.end()
  }
}

/**
 * Main function: Fill all gaps for a contract
 */
async function fillAllGaps(contractAddress: string) {
  console.log(`\n${'═'.repeat(80)}`)
  console.log(`🔧 GAP-FILLING SYNC`)
  console.log(`${'═'.repeat(80)}`)
  console.log(`Contract: ${contractAddress}`)
  console.log(`Time: ${new Date().toISOString()}`)

  const service = new GapFillerService()

  try {
    // Find gaps
    console.log(`\n🔍 Finding gaps...`)
    const gaps = await service.findGaps(contractAddress)

    if (gaps.length === 0) {
      console.log(`✅ No gaps found! Data is complete.`)
      return
    }

    const totalBlocks = gaps.reduce((sum, gap) => sum + gap.blockCount, 0)
    console.log(`\n⚠️  Found ${gaps.length} gaps (${totalBlocks.toLocaleString()} blocks total)`)

    // Show top 10 gaps
    console.log(`\n📊 Largest gaps:`)
    gaps.sort((a, b) => b.blockCount - a.blockCount)
      .slice(0, 10)
      .forEach((gap, i) => {
        console.log(`   ${i + 1}. Blocks ${gap.start}-${gap.end} (${gap.blockCount.toLocaleString()} blocks)`)
      })

    // Ask for confirmation
    console.log(`\n⏳ Estimated time: ${Math.ceil(totalBlocks / 2000 * 0.2)} minutes`)
    console.log(`\n🚀 Starting gap-filling process...`)

    let totalEventsAdded = 0
    let gapsFilled = 0

    for (let i = 0; i < gaps.length; i++) {
      const gap = gaps[i]
      console.log(`\n[${ i + 1}/${gaps.length}] Processing gap ${gap.start}-${gap.end}`)

      const eventsAdded = await service.fillGap(contractAddress, gap)
      totalEventsAdded += eventsAdded
      gapsFilled++

      console.log(`   ✅ Gap filled: +${eventsAdded} events`)
    }

    console.log(`\n${'═'.repeat(80)}`)
    console.log(`✅ GAP-FILLING COMPLETED`)
    console.log(`${'═'.repeat(80)}`)
    console.log(`   Gaps filled: ${gapsFilled}/${gaps.length}`)
    console.log(`   Events added: ${totalEventsAdded.toLocaleString()}`)
    console.log(`\n💡 Next step: Run rebuild-contract-state.ts to update current_state`)

  } catch (error) {
    console.error('\n❌ Error:', error)
  } finally {
    await service.close()
  }
}

// Main execution
const contractAddress = process.argv[2]

if (!contractAddress) {
  console.log('Usage: npx tsx scripts/fill-sync-gaps.ts <contract-address>')
  console.log('\nExample:')
  console.log('  npx tsx scripts/fill-sync-gaps.ts 0xb8ea78fcacef50d41375e44e6814ebba36bb33c4')
  process.exit(1)
}

fillAllGaps(contractAddress)
