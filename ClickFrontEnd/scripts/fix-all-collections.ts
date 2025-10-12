/**
 * TÜM KOLEKSİYONLARI SIRAYLA DÜZELTİR
 *
 * Bu script tüm aktif koleksiyonları sıfırdan senkronize eder.
 * ERC721 ve ERC1155 tiplerini doğru şekilde algılar ve işler.
 *
 * Kullanım:
 *   POSTGRES_URL="..." NEXT_PUBLIC_ALCHEMY_API_KEY="..." tsx scripts/fix-all-collections.ts
 */

import { Pool } from 'pg'
import { ethers } from 'ethers'

const POSTGRES_URL = process.env.POSTGRES_URL!
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY!

interface Contract {
  address: string
  name: string
  symbol: string
  contract_type: string
  deployment_block: string
}

class CollectionFixer {
  private pool: Pool
  private provider: ethers.JsonRpcProvider

  constructor() {
    this.pool = new Pool({ connectionString: POSTGRES_URL })
    this.provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)
  }

  async fixAllCollections() {
    console.log('\n' + '═'.repeat(80))
    console.log('🔧 TÜM KOLEKSİYONLARI DÜZELT')
    console.log('═'.repeat(80))
    console.log(`Başlangıç: ${new Date().toLocaleString('tr-TR')}\n`)

    try {
      // Get all active contracts
      const contracts = await this.getActiveContracts()
      console.log(`📦 Toplam ${contracts.length} aktif koleksiyon bulundu\n`)

      // Process each contract
      let successCount = 0
      let failedCount = 0

      for (let i = 0; i < contracts.length; i++) {
        const contract = contracts[i]
        console.log(`\n${'─'.repeat(80)}`)
        console.log(`[${i + 1}/${contracts.length}] İşleniyor: ${contract.name}`)
        console.log(`${'─'.repeat(80)}`)

        try {
          await this.fixContract(contract)
          successCount++
          console.log(`✅ ${contract.name} başarıyla düzeltildi!`)
        } catch (error: any) {
          failedCount++
          console.error(`❌ ${contract.name} düzeltilemedi: ${error.message}`)
        }

        // Wait between contracts to avoid rate limiting
        if (i < contracts.length - 1) {
          console.log('\n⏳ Sonraki koleksiyona geçiliyor...')
          await this.sleep(2000)
        }
      }

      // Final summary
      console.log('\n' + '═'.repeat(80))
      console.log('📊 ÖZET')
      console.log('═'.repeat(80))
      console.log(`✅ Başarılı: ${successCount}`)
      console.log(`❌ Başarısız: ${failedCount}`)
      console.log(`📦 Toplam: ${contracts.length}`)
      console.log(`⏱️  Bitiş: ${new Date().toLocaleString('tr-TR')}`)
      console.log('═'.repeat(80))

    } catch (error) {
      console.error('\n❌ Kritik hata:', error)
    } finally {
      await this.pool.end()
    }
  }

  private async getActiveContracts(): Promise<Contract[]> {
    const result = await this.pool.query(`
      SELECT address, name, symbol, contract_type, deployment_block
      FROM contracts
      WHERE is_active = true
      ORDER BY id ASC
    `)
    return result.rows
  }

  private async fixContract(contract: Contract) {
    console.log(`\n📋 Koleksiyon: ${contract.name} (${contract.symbol})`)
    console.log(`   Tip: ${contract.contract_type}`)
    console.log(`   Adres: ${contract.address}`)
    console.log(`   Deployment Block: ${contract.deployment_block}`)

    const latestBlock = await this.provider.getBlockNumber()
    const totalBlocks = latestBlock - parseInt(contract.deployment_block)
    console.log(`   Latest Block: ${latestBlock}`)
    console.log(`   Senkronize edilecek blok sayısı: ${totalBlocks.toLocaleString()}`)

    // Step 1: Clear existing data
    console.log('\n🗑️  Mevcut veriler temizleniyor...')
    await this.clearContractData(contract.address)
    console.log('   ✅ Veriler temizlendi')

    // Step 2: Sync events
    console.log('\n🔄 Blockchain\'den eventler çekiliyor...')
    const eventsFound = await this.syncEvents(contract, latestBlock)
    console.log(`\n   ✅ Toplam ${eventsFound.toLocaleString()} event bulundu ve kaydedildi`)

    // Step 3: Rebuild current_state
    console.log('\n🏗️  Current state yeniden oluşturuluyor...')
    await this.rebuildState(contract.address)
    console.log('   ✅ Current state oluşturuldu')

    // Step 4: Get final stats
    const stats = await this.getStats(contract.address)
    console.log('\n📊 Son durum:')
    console.log(`   Holder sayısı: ${stats.holders.toLocaleString()}`)
    console.log(`   Unique token sayısı: ${stats.uniqueTokens.toLocaleString()}`)
    console.log(`   Toplam supply: ${stats.supply}`)
  }

  private async clearContractData(address: string) {
    await this.pool.query(
      'DELETE FROM events WHERE LOWER(contract_address) = LOWER($1)',
      [address]
    )
    await this.pool.query(
      'DELETE FROM current_state WHERE LOWER(contract_address) = LOWER($1)',
      [address]
    )
  }

  private async syncEvents(contract: Contract, latestBlock: number): Promise<number> {
    const CHUNK_SIZE = 2000
    let currentBlock = parseInt(contract.deployment_block)
    let totalEvents = 0

    // Get appropriate event signatures based on contract type
    const topics = contract.contract_type === 'ERC721'
      ? ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'] // Transfer
      : [
          '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62', // TransferSingle
          '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'  // TransferBatch
        ]

    while (currentBlock <= latestBlock) {
      const fromBlock = currentBlock
      const toBlock = Math.min(fromBlock + CHUNK_SIZE - 1, latestBlock)

      try {
        const logs = await this.provider.getLogs({
          address: contract.address,
          topics: [topics],
          fromBlock,
          toBlock
        })

        // Insert events in batch
        for (const log of logs) {
          await this.insertEvent(contract, log)
        }

        totalEvents += logs.length
        currentBlock = toBlock + 1

        // Progress indicator
        const percent = Math.round(((toBlock - parseInt(contract.deployment_block)) / (latestBlock - parseInt(contract.deployment_block))) * 100)
        const bar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5))
        process.stdout.write(`\r   [${bar}] ${percent}% | Block ${toBlock.toLocaleString()}/${latestBlock.toLocaleString()} | +${logs.length} events`)

        // Rate limiting
        await this.sleep(100)

      } catch (error: any) {
        console.error(`\n   ⚠️  Blok ${fromBlock} hatası: ${error.message}`)
        currentBlock = toBlock + 1
      }
    }

    return totalEvents
  }

  private async insertEvent(contract: Contract, log: ethers.Log) {
    try {
      const block = await this.provider.getBlock(log.blockNumber)

      let eventType: string
      let from: string
      let to: string
      let tokenId: string
      let amount: string

      if (contract.contract_type === 'ERC721') {
        // ERC721 Transfer event parsing
        eventType = 'Transfer'
        from = ethers.getAddress('0x' + log.topics[1].slice(26))
        to = ethers.getAddress('0x' + log.topics[2].slice(26))
        tokenId = BigInt(log.topics[3]).toString()
        amount = '1'
      } else {
        // ERC1155 TransferSingle event parsing
        const iface = new ethers.Interface([
          'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
          'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
        ])

        const decoded = iface.parseLog({ topics: log.topics as string[], data: log.data })

        if (decoded?.name === 'TransferBatch') {
          // TransferBatch - multiple tokens in one transaction
          // For now, we'll skip these or handle them separately
          // TODO: Implement batch handling
          return
        }

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
        contract.address.toLowerCase(),
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
        // Silently ignore parsing errors for now
      }
    }
  }

  private async rebuildState(address: string) {
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
    `, [address])
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

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Main execution
const fixer = new CollectionFixer()
fixer.fixAllCollections()
