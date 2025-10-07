import Database from 'better-sqlite3';
import { getDatabase } from '../database/init';
import crypto from 'crypto';
import { SyncManager } from '../blockchain/sync-manager';

export interface SnapshotHolder {
  holderAddress: string;
  balance: string;
  percentage: number;
  rank: number;
}

export interface Snapshot {
  tokenId: string;
  blockNumber: number;
  timestamp: number;
  totalSupply: string;
  holderCount: number;
  holders: SnapshotHolder[];
  metadata?: {
    topHolders: SnapshotHolder[];
    distribution: {
      top10Percentage: number;
      top50Percentage: number;
      top100Percentage: number;
    };
    averageBalance: string;
    medianBalance: string;
  };
}

export interface SnapshotOptions {
  tokenIds?: string[];
  tokenId?: string;
  blockNumber?: number; // If not provided, uses current state
  includeZeroBalances?: boolean;
  includeMetadata?: boolean;
  limit?: number; // Limit number of holders returned
  minBalance?: string | bigint; // Minimum balance threshold
  offset?: number; // Offset for pagination
}

export class SnapshotGenerator {
  private db: Database.Database;
  private syncManager: SyncManager;

  constructor() {
    const dbManager = getDatabase();
    this.db = dbManager.getDb();
    this.syncManager = new SyncManager();
  }

  /**
   * Generate a current snapshot for specified tokens
   */
  async generateCurrentSnapshot(options: SnapshotOptions = {}): Promise<Snapshot[]> {
    console.log('📸 Generating current snapshot...');
    
    // Check and sync missing blocks before generating snapshot (with timeout)
    try {
      const syncTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sync timeout')), 5000) // 5 second timeout
      );
      
      const needsSyncPromise = this.syncManager.needsSync();
      const needsSync = await Promise.race([needsSyncPromise, syncTimeout]).catch(() => false);
      
      if (needsSync) {
        console.log('🔄 Syncing missing blocks before snapshot...');
        const syncPromise = this.syncManager.syncMissingBlocks();
        const syncResult = await Promise.race([syncPromise, syncTimeout]).catch(() => null) as any;
        
        if (syncResult) {
          console.log(`✅ Synced ${syncResult.eventsFound} new events from ${syncResult.blocksScanned} blocks`);
        }
      }
    } catch (error) {
      console.error('⚠️ Warning: Could not sync missing blocks (timeout or error):', error);
      // Continue with snapshot generation even if sync fails
    }
    
    const snapshots: Snapshot[] = [];
    const tokenIds = options.tokenIds || (options.tokenId ? [options.tokenId] : ['all']);
    
    for (const tokenId of tokenIds) {
      // Get current holders from state table (with pagination)
      const holders = this.getCurrentHolders(tokenId, options);
      
      // Get the actual total holder count (without limits)
      const actualHolderCount = this.getTotalHolderCount(tokenId, options);
      
      // Get the actual total supply (without limits)
      const totalSupply = this.getTotalSupply(tokenId, options);
      
      // Add percentage and rank (using actual total supply)
      const rankedHolders = this.calculateRankings(holders, totalSupply);
      
      // Get current block number
      const currentBlock = this.getCurrentBlockNumber();
      
      const snapshot: Snapshot = {
        tokenId,
        blockNumber: currentBlock,
        timestamp: Date.now(),
        totalSupply,
        holderCount: actualHolderCount,
        holders: rankedHolders
      };
      
      // Add metadata if requested
      if (options.includeMetadata) {
        snapshot.metadata = this.calculateMetadata(rankedHolders, totalSupply);
      }
      
      snapshots.push(snapshot);
    }
    
    console.log(`✅ Generated ${snapshots.length} snapshot(s)`);
    return snapshots;
  }

  /**
   * Generate a historical snapshot at a specific block
   */
  async generateHistoricalSnapshot(options: SnapshotOptions & { blockNumber: number }): Promise<Snapshot[]> {
    console.log(`📸 Generating historical snapshot at block ${options.blockNumber}...`);
    
    const snapshots: Snapshot[] = [];
    const tokenIds = options.tokenIds || (options.tokenId ? [options.tokenId] : ['all']);
    
    for (const tokenId of tokenIds) {
      // Replay events up to target block
      const holders = this.calculateHistoricalBalances(tokenId, options.blockNumber, options);
      
      // Calculate total supply
      const totalSupply = this.calculateTotalSupply(holders);
      
      // Add percentage and rank
      const rankedHolders = this.calculateRankings(holders, totalSupply);
      
      // Get block timestamp
      const blockTimestamp = this.getBlockTimestamp(options.blockNumber);
      
      const snapshot: Snapshot = {
        tokenId,
        blockNumber: options.blockNumber,
        timestamp: blockTimestamp,
        totalSupply,
        holderCount: rankedHolders.length,
        holders: rankedHolders
      };
      
      // Add metadata if requested
      if (options.includeMetadata) {
        snapshot.metadata = this.calculateMetadata(rankedHolders, totalSupply);
      }
      
      snapshots.push(snapshot);
    }
    
    console.log(`✅ Generated ${snapshots.length} historical snapshot(s)`);
    return snapshots;
  }

  /**
   * Get current holders for a token
   */
  private getCurrentHolders(tokenId: string, options: SnapshotOptions): SnapshotHolder[] {
    let query: string;
    const params: any[] = [];
    
    if (tokenId === 'all') {
      // For 'all', aggregate balances across all token IDs per address
      query = `
        SELECT 
          address, 
          SUM(CAST(balance AS INTEGER)) as balance
        FROM current_state
        WHERE 1=1
      `;
    } else if (tokenId) {
      // For specific token ID, get balances for that token only
      query = `
        SELECT address, balance
        FROM current_state
        WHERE token_id = ?
      `;
      params.push(tokenId);
    } else {
      // If no tokenId specified, aggregate all
      query = `
        SELECT 
          address, 
          SUM(CAST(balance AS INTEGER)) as balance
        FROM current_state
        WHERE 1=1
      `;
    }
    
    // Apply filters
    if (!options.includeZeroBalances) {
      query += ' AND balance > 0';
    }
    
    if (options.minBalance) {
      const minBalanceStr = typeof options.minBalance === 'bigint' 
        ? options.minBalance.toString() 
        : options.minBalance;
      query += ' AND CAST(balance AS INTEGER) >= CAST(? AS INTEGER)';
      params.push(minBalanceStr);
    }
    
    // Add GROUP BY for aggregation queries
    if (tokenId === 'all' || !tokenId) {
      query += ' GROUP BY address';
      // For aggregated queries, we need to use HAVING instead of WHERE for the aggregated balance
      if (options.minBalance) {
        query += ' HAVING SUM(CAST(balance AS INTEGER)) >= CAST(? AS INTEGER)';
        params.push(typeof options.minBalance === 'bigint' ? options.minBalance.toString() : options.minBalance);
      }
    }
    
    query += ' ORDER BY CAST(balance AS INTEGER) DESC';
    
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    if (options.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as { address: string; balance: string }[];
    
    return rows.map(row => ({
      holderAddress: row.address,
      balance: row.balance,
      percentage: 0,
      rank: 0
    }));
  }

  /**
   * Calculate historical balances by replaying events
   */
  private calculateHistoricalBalances(
    tokenId: string,
    targetBlock: number,
    options: SnapshotOptions
  ): SnapshotHolder[] {
    console.log(`  Replaying events up to block ${targetBlock}...`);
    
    // Get all events up to target block
    const events = this.db.prepare(`
      SELECT from_address, to_address, amount, block_number
      FROM events
      WHERE token_id = ? AND block_number <= ?
      ORDER BY block_number, log_index
    `).all(tokenId, targetBlock) as any[];
    
    // Build balance map
    const balances = new Map<string, bigint>();
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    
    for (const event of events) {
      const amount = BigInt(event.amount);
      
      // Process from address (decrease balance)
      if (event.from_address.toLowerCase() !== zeroAddress) {
        const fromBalance = balances.get(event.from_address) || BigInt(0);
        balances.set(event.from_address, fromBalance - amount);
      }

      // Process to address (increase balance)
      if (event.to_address.toLowerCase() !== zeroAddress) {
        const toBalance = balances.get(event.to_address) || BigInt(0);
        balances.set(event.to_address, toBalance + amount);
      }
    }
    
    // Convert to holder array
    const holders: SnapshotHolder[] = [];
    
    for (const [address, balance] of balances) {
      if (options.includeZeroBalances || balance > BigInt(0)) {
        if (!options.minBalance || balance >= BigInt(options.minBalance)) {
          holders.push({
            holderAddress: address,
            balance: balance.toString(),
            percentage: 0,
            rank: 0
          });
        }
      }
    }
    
    // Sort by balance
    holders.sort((a, b) => {
      const balanceA = BigInt(a.balance);
      const balanceB = BigInt(b.balance);
      if (balanceB > balanceA) return 1;
      if (balanceB < balanceA) return -1;
      return 0;
    });
    
    // Apply limit
    if (options.limit) {
      return holders.slice(0, options.limit);
    }
    
    return holders;
  }

  /**
   * Calculate total supply from holders
   */
  private calculateTotalSupply(holders: SnapshotHolder[]): string {
    let total = BigInt(0);
    for (const holder of holders) {
      total += BigInt(holder.balance);
    }
    return total.toString();
  }

  /**
   * Calculate rankings and percentages
   */
  private calculateRankings(holders: SnapshotHolder[], totalSupply: string): SnapshotHolder[] {
    const total = BigInt(totalSupply);
    
    return holders.map((holder, index) => ({
      ...holder,
      rank: index + 1,
      percentage: total > BigInt(0)
        ? Number((BigInt(holder.balance) * BigInt(10000)) / total) / 100
        : 0
    }));
  }

  /**
   * Calculate snapshot metadata
   */
  private calculateMetadata(holders: SnapshotHolder[], totalSupply: string): Snapshot['metadata'] {
    if (holders.length === 0) {
      return {
        topHolders: [],
        distribution: {
          top10Percentage: 0,
          top50Percentage: 0,
          top100Percentage: 0
        },
        averageBalance: '0',
        medianBalance: '0'
      };
    }
    
    // Top holders
    const topHolders = holders.slice(0, 10);
    
    // Distribution calculations
    const calculateTopPercentage = (count: number): number => {
      let sum = 0;
      for (let i = 0; i < Math.min(count, holders.length); i++) {
        sum += holders[i].percentage;
      }
      return Math.round(sum * 100) / 100;
    };
    
    // Average and median
    const total = BigInt(totalSupply);
    const averageBalance = holders.length > 0 
      ? (total / BigInt(holders.length)).toString()
      : '0';
    
    const medianIndex = Math.floor(holders.length / 2);
    const medianBalance = holders[medianIndex]?.balance || '0';
    
    return {
      topHolders,
      distribution: {
        top10Percentage: calculateTopPercentage(10),
        top50Percentage: calculateTopPercentage(50),
        top100Percentage: calculateTopPercentage(100)
      },
      averageBalance,
      medianBalance
    };
  }

  /**
   * Get total holder count without pagination limits
   */
  private getTotalHolderCount(tokenId: string, options: SnapshotOptions): number {
    let query: string;
    const params: any[] = [];
    
    if (tokenId === 'all') {
      // For 'all', count unique addresses across all tokens
      query = `
        SELECT COUNT(DISTINCT address) as count
        FROM (
          SELECT address, SUM(CAST(balance AS INTEGER)) as total_balance
          FROM current_state
          GROUP BY address
          HAVING total_balance > 0
        )
      `;
    } else if (tokenId) {
      // For specific token ID
      query = `
        SELECT COUNT(DISTINCT address) as count
        FROM current_state
        WHERE token_id = ? AND balance > 0
      `;
      params.push(tokenId);
    } else {
      // If no tokenId, same as 'all'
      query = `
        SELECT COUNT(DISTINCT address) as count
        FROM (
          SELECT address, SUM(CAST(balance AS INTEGER)) as total_balance
          FROM current_state
          GROUP BY address
          HAVING total_balance > 0
        )
      `;
    }
    
    // Apply min balance filter if specified
    if (options.minBalance && (tokenId !== 'all' && tokenId)) {
      const minBalanceStr = typeof options.minBalance === 'bigint' 
        ? options.minBalance.toString() 
        : options.minBalance;
      query = query.replace('balance > 0', `balance > 0 AND CAST(balance AS INTEGER) >= CAST(${minBalanceStr} AS INTEGER)`);
    }
    
    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };
    return result.count || 0;
  }

  /**
   * Get total supply without pagination limits
   */
  private getTotalSupply(tokenId: string, options: SnapshotOptions): string {
    let query: string;
    const params: any[] = [];
    
    if (tokenId === 'all') {
      // For 'all', sum all balances across all tokens
      query = `
        SELECT SUM(CAST(balance AS INTEGER)) as total_supply
        FROM current_state
        WHERE balance > 0
      `;
    } else if (tokenId) {
      // For specific token ID
      query = `
        SELECT SUM(CAST(balance AS INTEGER)) as total_supply
        FROM current_state
        WHERE token_id = ? AND balance > 0
      `;
      params.push(tokenId);
    } else {
      // If no tokenId, same as 'all'
      query = `
        SELECT SUM(CAST(balance AS INTEGER)) as total_supply
        FROM current_state
        WHERE balance > 0
      `;
    }
    
    // Apply min balance filter if specified
    if (options.minBalance) {
      const minBalanceStr = typeof options.minBalance === 'bigint' 
        ? options.minBalance.toString() 
        : options.minBalance;
      if (tokenId === 'all' || !tokenId) {
        // For aggregated queries, need to check per-address totals
        query = `
          SELECT SUM(total_balance) as total_supply
          FROM (
            SELECT address, SUM(CAST(balance AS INTEGER)) as total_balance
            FROM current_state
            WHERE balance > 0
            GROUP BY address
            HAVING total_balance >= CAST(${minBalanceStr} AS INTEGER)
          )
        `;
      } else {
        // For specific token, add to WHERE clause
        query = query.replace('balance > 0', `balance > 0 AND CAST(balance AS INTEGER) >= CAST(${minBalanceStr} AS INTEGER)`);
      }
    }
    
    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { total_supply: number | null };
    return result.total_supply ? result.total_supply.toString() : '0';
  }

  /**
   * Get current block number from database
   */
  private getCurrentBlockNumber(): number {
    const result = this.db.prepare(
      'SELECT MAX(block_number) as block FROM events'
    ).get() as { block: number };
    return result.block || 0;
  }

  /**
   * Get block timestamp
   */
  private getBlockTimestamp(blockNumber: number): number {
    const result = this.db.prepare(
      'SELECT block_timestamp FROM events WHERE block_number = ? LIMIT 1'
    ).get(blockNumber) as { block_timestamp: number } | undefined;
    
    return result?.block_timestamp || Math.floor(Date.now() / 1000);
  }

  /**
   * Generate cache key for snapshot
   */
  private generateCacheKey(options: SnapshotOptions): string {
    const data = JSON.stringify({
      tokenIds: options.tokenIds?.sort() || [],
      blockNumber: options.blockNumber,
      includeZeroBalances: options.includeZeroBalances,
      minBalance: options.minBalance,
      limit: options.limit
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Cache snapshot
   */
  async cacheSnapshot(snapshot: Snapshot[], options: SnapshotOptions): Promise<void> {
    const cacheKey = this.generateCacheKey(options);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO snapshot_cache (
        cache_key, block_number, token_ids, holder_count, 
        total_supply, snapshot_data, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `);
    
    for (const snap of snapshot) {
      stmt.run(
        cacheKey,
        snap.blockNumber,
        JSON.stringify([snap.tokenId]),
        snap.holderCount,
        snap.totalSupply,
        JSON.stringify(snap),
        expiresAt.toISOString()
      );
    }
    
    console.log('💾 Snapshot cached');
  }

  /**
   * Get cached snapshot
   */
  getCachedSnapshot(options: SnapshotOptions): Snapshot[] | null {
    const cacheKey = this.generateCacheKey(options);
    
    const rows = this.db.prepare(`
      SELECT snapshot_data 
      FROM snapshot_cache
      WHERE cache_key = ? AND expires_at > datetime('now')
    `).all(cacheKey) as { snapshot_data: string }[];
    
    if (rows.length > 0) {
      console.log('📦 Using cached snapshot');
      return rows.map(row => JSON.parse(row.snapshot_data));
    }
    
    return null;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const result = this.db.prepare(
      `DELETE FROM snapshot_cache WHERE expires_at <= datetime('now')`
    ).run();
    
    if (result.changes > 0) {
      console.log(`🧹 Cleared ${result.changes} expired cache entries`);
    }
  }

  /**
   * Compare two snapshots
   */
  compareSnapshots(snapshot1: Snapshot, snapshot2: Snapshot): {
    holdersAdded: string[];
    holdersRemoved: string[];
    balanceChanges: Array<{
      address: string;
      oldBalance: string;
      newBalance: string;
      change: string;
    }>;
  } {
    const holders1 = new Map(snapshot1.holders.map(h => [h.holderAddress, h.balance]));
    const holders2 = new Map(snapshot2.holders.map(h => [h.holderAddress, h.balance]));

    const holdersAdded = snapshot2.holders
      .filter(h => !holders1.has(h.holderAddress))
      .map(h => h.holderAddress);

    const holdersRemoved = snapshot1.holders
      .filter(h => !holders2.has(h.holderAddress))
      .map(h => h.holderAddress);
    
    const balanceChanges: any[] = [];
    
    for (const holder of snapshot2.holders) {
      const oldBalance = holders1.get(holder.holderAddress);
      if (oldBalance && oldBalance !== holder.balance) {
        const change = (BigInt(holder.balance) - BigInt(oldBalance)).toString();
        balanceChanges.push({
          address: holder.holderAddress,
          oldBalance,
          newBalance: holder.balance,
          change
        });
      }
    }
    
    return { holdersAdded, holdersRemoved, balanceChanges };
  }
}