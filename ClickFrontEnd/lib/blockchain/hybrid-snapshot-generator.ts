/**
 * Hybrid Snapshot Generator
 * Optimized snapshot generation using different strategies based on contract type and query
 *
 * Strategy Selection:
 * - ERC-721: Always use RPC real-time (balanceOf calls)
 * - ERC-1155 single token: Use RPC real-time (balanceOfBatch)
 * - ERC-1155 multiple tokens: Use Database + quick sync
 */

import { ethers } from 'ethers'
import Database from 'better-sqlite3'
import { getDatabase } from '../database/init'
import { getProvider } from './provider'
import ERC1155_ABI from './contracts/erc1155-abi.json'

export interface HybridSnapshotOptions {
  contractAddress: string
  contractType: 'ERC721' | 'ERC1155'
  tokenIds?: string[]
  blockNumber?: number  // For historical snapshots
  quickSyncBlocks?: number  // Default: 100 blocks (~20 min)
}

export interface SnapshotHolder {
  address: string
  tokenId?: string
  balance: string
  balances?: Record<string, string>  // For multiple tokens
  percentage?: number
  rank?: number
}

export interface SnapshotResult {
  holders: SnapshotHolder[]
  metadata: {
    contractAddress: string
    contractType: string
    tokenIds: string[]
    blockNumber: number
    timestamp: string
    totalHolders: number
    totalSupply: string
    dataSource: 'rpc-realtime' | 'database-synced' | 'database-historical'
    lastSyncedBlock?: number
    syncGapBlocks?: number
  }
}

export class HybridSnapshotGenerator {
  private db: Database.Database
  private provider: ethers.JsonRpcProvider | null = null

  constructor() {
    const dbManager = getDatabase()
    this.db = dbManager.getDb()
  }

  /**
   * Main entry point - chooses optimal strategy
   */
  async generateSnapshot(options: HybridSnapshotOptions): Promise<SnapshotResult> {
    console.log('🎯 Hybrid Snapshot Strategy Selection...')
    console.log(`Contract: ${options.contractAddress}`)
    console.log(`Type: ${options.contractType}`)
    console.log(`Tokens: ${options.tokenIds?.length || 'all'}`)

    // Get provider
    this.provider = await getProvider()

    // Historical snapshots always use database
    if (options.blockNumber) {
      console.log('📚 Historical snapshot - using database')
      return this.getDatabaseSnapshot(options)
    }

    // Strategy selection for current snapshots
    if (options.contractType === 'ERC721') {
      console.log('✨ ERC-721 detected - using RPC real-time strategy')
      return this.getERC721RealtimeSnapshot(options)
    }

    if (options.contractType === 'ERC1155') {
      const tokenCount = options.tokenIds?.length || 0

      if (tokenCount === 1) {
        console.log('✨ ERC-1155 single token - using RPC real-time strategy')
        return this.getERC1155SingleTokenRealtime(options)
      } else {
        console.log('📊 ERC-1155 multiple tokens - using database + quick sync')
        return this.getERC1155DatabaseWithQuickSync(options)
      }
    }

    throw new Error(`Unsupported contract type: ${options.contractType}`)
  }

  /**
   * ERC-721 Real-time snapshot using RPC calls
   */
  private async getERC721RealtimeSnapshot(options: HybridSnapshotOptions): Promise<SnapshotResult> {
    console.log('🔍 Fetching ERC-721 holders via RPC...')

    // Get unique holders from Transfer events
    const holders = await this.getUniqueHoldersFromEvents(
      options.contractAddress,
      options.tokenIds?.[0]
    )

    console.log(`📊 Found ${holders.length} unique holders`)

    // Get current balances via RPC
    const contract = new ethers.Contract(
      options.contractAddress,
      ['function balanceOf(address) view returns (uint256)'],
      this.provider!
    )

    const currentBlock = await this.provider!.getBlockNumber()
    const holderData: SnapshotHolder[] = []
    let totalSupply = BigInt(0)

    // Batch requests for performance
    const batchSize = 100
    for (let i = 0; i < holders.length; i += batchSize) {
      const batch = holders.slice(i, i + batchSize)
      const balancePromises = batch.map(holder =>
        contract.balanceOf(holder).catch(() => BigInt(0))
      )

      const balances = await Promise.all(balancePromises)

      for (let j = 0; j < batch.length; j++) {
        const balance = balances[j]
        if (balance > BigInt(0)) {
          holderData.push({
            address: batch[j],
            balance: balance.toString()
          })
          totalSupply += balance
        }
      }

      console.log(`📡 Processed ${Math.min(i + batchSize, holders.length)}/${holders.length} holders`)
    }

    // Sort by balance
    holderData.sort((a, b) => {
      const diff = BigInt(b.balance) - BigInt(a.balance)
      return diff > 0 ? 1 : diff < 0 ? -1 : 0
    })

    // Add rankings and percentages
    holderData.forEach((holder, index) => {
      holder.rank = index + 1
      holder.percentage = totalSupply > 0
        ? (Number(BigInt(holder.balance) * BigInt(10000) / totalSupply) / 100)
        : 0
    })

    return {
      holders: holderData,
      metadata: {
        contractAddress: options.contractAddress,
        contractType: 'ERC721',
        tokenIds: options.tokenIds || [],
        blockNumber: currentBlock,
        timestamp: new Date().toISOString(),
        totalHolders: holderData.length,
        totalSupply: totalSupply.toString(),
        dataSource: 'rpc-realtime'
      }
    }
  }

  /**
   * ERC-1155 single token real-time snapshot using balanceOfBatch
   */
  private async getERC1155SingleTokenRealtime(options: HybridSnapshotOptions): Promise<SnapshotResult> {
    const tokenId = options.tokenIds![0]
    console.log(`🔍 Fetching ERC-1155 token ${tokenId} holders via RPC...`)

    // Get unique holders from Transfer events
    const holders = await this.getUniqueHoldersFromEvents(
      options.contractAddress,
      tokenId
    )

    console.log(`📊 Found ${holders.length} unique holders for token ${tokenId}`)

    // Use balanceOfBatch for efficient bulk query
    const contract = new ethers.Contract(
      options.contractAddress,
      ERC1155_ABI,
      this.provider!
    )

    const currentBlock = await this.provider!.getBlockNumber()
    const holderData: SnapshotHolder[] = []
    let totalSupply = BigInt(0)

    // balanceOfBatch supports up to ~1000 addresses per call
    const batchSize = 1000
    for (let i = 0; i < holders.length; i += batchSize) {
      const batch = holders.slice(i, i + batchSize)
      const tokenIds = Array(batch.length).fill(tokenId)

      try {
        const balances = await contract.balanceOfBatch(batch, tokenIds)

        for (let j = 0; j < batch.length; j++) {
          const balance = balances[j]
          if (balance > BigInt(0)) {
            holderData.push({
              address: batch[j],
              tokenId,
              balance: balance.toString()
            })
            totalSupply += balance
          }
        }

        console.log(`📡 Processed ${Math.min(i + batchSize, holders.length)}/${holders.length} holders`)
      } catch (error) {
        console.error(`❌ Error fetching batch ${i}-${i + batchSize}:`, error)
      }
    }

    // Sort by balance
    holderData.sort((a, b) => {
      const diff = BigInt(b.balance) - BigInt(a.balance)
      return diff > 0 ? 1 : diff < 0 ? -1 : 0
    })

    // Add rankings and percentages
    holderData.forEach((holder, index) => {
      holder.rank = index + 1
      holder.percentage = totalSupply > 0
        ? (Number(BigInt(holder.balance) * BigInt(10000) / totalSupply) / 100)
        : 0
    })

    return {
      holders: holderData,
      metadata: {
        contractAddress: options.contractAddress,
        contractType: 'ERC1155',
        tokenIds: [tokenId],
        blockNumber: currentBlock,
        timestamp: new Date().toISOString(),
        totalHolders: holderData.length,
        totalSupply: totalSupply.toString(),
        dataSource: 'rpc-realtime'
      }
    }
  }

  /**
   * ERC-1155 multiple tokens with database + quick sync
   */
  private async getERC1155DatabaseWithQuickSync(options: HybridSnapshotOptions): Promise<SnapshotResult> {
    console.log('📊 ERC-1155 multiple tokens - using database strategy')

    // Quick sync recent blocks if needed
    const quickSyncBlocks = options.quickSyncBlocks || 100
    await this.quickSyncRecentBlocks(options.contractAddress, quickSyncBlocks)

    // Get snapshot from database
    return this.getDatabaseSnapshot(options)
  }

  /**
   * Quick sync: Only sync last N blocks for recent updates
   */
  private async quickSyncRecentBlocks(contractAddress: string, blocks: number): Promise<void> {
    console.log(`⚡ Quick sync: last ${blocks} blocks...`)

    try {
      const currentBlock = await this.provider!.getBlockNumber()
      const lastSyncedBlock = this.getLastSyncedBlock(contractAddress)

      const syncGap = currentBlock - lastSyncedBlock
      console.log(`📊 Sync gap: ${syncGap} blocks`)

      if (syncGap <= 0) {
        console.log('✅ Already up to date')
        return
      }

      if (syncGap > blocks) {
        console.log(`⚠️  Warning: Sync gap (${syncGap}) > quick sync limit (${blocks})`)
        console.log('📚 Consider running full sync: npx tsx scripts/sync-blockchain.ts')
      }

      // Sync the gap or the limit, whichever is smaller
      const startBlock = Math.max(lastSyncedBlock + 1, currentBlock - blocks)

      // Import and use existing sync logic
      const { SyncManager } = await import('./sync-manager')
      // TODO: Implement quick sync for recent blocks
      // const syncManager = new SyncManager()
      // console.log(`🔄 Syncing blocks ${startBlock} to ${currentBlock}...`)
      // await syncManager.syncBlockRange(contractAddress, startBlock, currentBlock)

      console.log('⚠️  Quick sync not yet implemented, using existing database data')
    } catch (error) {
      console.error('❌ Quick sync failed:', error)
      console.log('⚠️  Using existing database data')
    }
  }

  /**
   * Get snapshot from database
   */
  private async getDatabaseSnapshot(options: HybridSnapshotOptions): Promise<SnapshotResult> {
    console.log('📚 Fetching snapshot from database...')

    const contractAddress = options.contractAddress.toLowerCase()
    const currentBlock = await this.provider!.getBlockNumber()
    const lastSyncedBlock = this.getLastSyncedBlock(contractAddress)

    // Build token filter
    let tokenFilter = ''
    let tokenParams: string[] = []

    if (options.tokenIds && options.tokenIds.length > 0) {
      const placeholders = options.tokenIds.map(() => '?').join(',')
      tokenFilter = `AND token_id IN (${placeholders})`
      tokenParams = options.tokenIds
    }

    // Query database
    const query = `
      SELECT
        address,
        token_id,
        balance
      FROM current_state
      WHERE contract_address = ? COLLATE NOCASE
      ${tokenFilter}
      AND CAST(balance AS INTEGER) > 0
      ORDER BY CAST(balance AS INTEGER) DESC
    `

    const results = this.db.prepare(query).all(contractAddress, ...tokenParams) as any[]

    // Group by holder if multiple tokens
    const holderMap = new Map<string, SnapshotHolder>()
    let totalSupply = BigInt(0)

    for (const row of results) {
      const address = row.address
      const tokenId = row.token_id
      const balance = BigInt(row.balance)

      if (!holderMap.has(address)) {
        holderMap.set(address, {
          address,
          balance: '0',
          balances: {}
        })
      }

      const holder = holderMap.get(address)!
      holder.balances![tokenId] = balance.toString()
      holder.balance = (BigInt(holder.balance) + balance).toString()
      totalSupply += balance
    }

    const holders = Array.from(holderMap.values())

    // Sort by total balance
    holders.sort((a, b) => {
      const diff = BigInt(b.balance) - BigInt(a.balance)
      return diff > 0 ? 1 : diff < 0 ? -1 : 0
    })

    // Add rankings and percentages
    holders.forEach((holder, index) => {
      holder.rank = index + 1
      holder.percentage = totalSupply > 0
        ? (Number(BigInt(holder.balance) * BigInt(10000) / totalSupply) / 100)
        : 0
    })

    return {
      holders,
      metadata: {
        contractAddress: options.contractAddress,
        contractType: options.contractType,
        tokenIds: options.tokenIds || [],
        blockNumber: options.blockNumber || lastSyncedBlock,
        timestamp: new Date().toISOString(),
        totalHolders: holders.length,
        totalSupply: totalSupply.toString(),
        dataSource: options.blockNumber ? 'database-historical' : 'database-synced',
        lastSyncedBlock,
        syncGapBlocks: currentBlock - lastSyncedBlock
      }
    }
  }

  /**
   * Get unique holders from Transfer events
   */
  private async getUniqueHoldersFromEvents(
    contractAddress: string,
    tokenId?: string
  ): Promise<string[]> {
    let query: string
    let params: string[]

    if (tokenId) {
      // For specific token
      query = `
        SELECT DISTINCT
          CASE
            WHEN to_address != '0x0000000000000000000000000000000000000000' THEN to_address
            ELSE NULL
          END as holder
        FROM events
        WHERE contract_address = ? COLLATE NOCASE
        AND token_id = ?
        AND to_address != '0x0000000000000000000000000000000000000000'
        UNION
        SELECT DISTINCT from_address
        FROM events
        WHERE contract_address = ? COLLATE NOCASE
        AND token_id = ?
        AND from_address != '0x0000000000000000000000000000000000000000'
      `
      params = [contractAddress.toLowerCase(), tokenId, contractAddress.toLowerCase(), tokenId]
    } else {
      // For all tokens
      query = `
        SELECT DISTINCT
          CASE
            WHEN to_address != '0x0000000000000000000000000000000000000000' THEN to_address
            ELSE NULL
          END as holder
        FROM events
        WHERE contract_address = ? COLLATE NOCASE
        AND to_address != '0x0000000000000000000000000000000000000000'
        UNION
        SELECT DISTINCT from_address
        FROM events
        WHERE contract_address = ? COLLATE NOCASE
        AND from_address != '0x0000000000000000000000000000000000000000'
      `
      params = [contractAddress.toLowerCase(), contractAddress.toLowerCase()]
    }

    const results = this.db.prepare(query).all(...params) as any[]
    return results.map(r => r.holder).filter(Boolean)
  }

  /**
   * Get last synced block for contract
   */
  private getLastSyncedBlock(contractAddress: string): number {
    const result = this.db.prepare(`
      SELECT MAX(block_number) as last_block
      FROM events
      WHERE contract_address = ? COLLATE NOCASE
    `).get(contractAddress.toLowerCase()) as any

    return result?.last_block || 0
  }
}
