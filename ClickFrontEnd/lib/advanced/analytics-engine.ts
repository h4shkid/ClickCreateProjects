import { getDatabase } from '../database/init';
import Database from 'better-sqlite3';

export interface HolderMetrics {
  address: string;
  totalHoldings: string;
  uniqueTokens: number;
  firstSeen: Date;
  lastActive: Date;
  transactionCount: number;
  receivedCount: number;
  sentCount: number;
  holdingDuration: number; // in days
  profitLoss?: string; // if price data available
}

export interface TokenMetrics {
  tokenId: string;
  uniqueHolders: number;
  totalSupply: string;
  velocity: number; // transfers per day
  concentration: number; // Gini coefficient
  topHolderPercentage: number;
  averageHoldingPeriod: number; // in days
  transferVolume24h: string;
  transferVolume7d: string;
  transferVolume30d: string;
}

export interface NetworkMetrics {
  totalTransfers: number;
  activeAddresses24h: number;
  activeAddresses7d: number;
  activeAddresses30d: number;
  newAddresses24h: number;
  newAddresses7d: number;
  gasUsed: string;
  averageTransferSize: string;
  peakActivityHour: number;
  peakActivityDay: string;
}

export class AnalyticsEngine {
  private db: Database.Database;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    const dbManager = getDatabase();
    this.db = dbManager.getDb();
  }

  /**
   * Get comprehensive holder metrics
   */
  async getHolderMetrics(address: string): Promise<HolderMetrics> {
    const cacheKey = `holder:${address}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Get holder's current state
    const holdings = this.db.prepare(`
      SELECT 
        SUM(CAST(balance AS INTEGER)) as total_holdings,
        COUNT(DISTINCT token_id) as unique_tokens
      FROM current_state
      WHERE address = ? AND balance > 0
    `).get(address) as any;

    // Get transaction history
    const transactions = this.db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN to_address = ? THEN 1 END) as received_count,
        COUNT(CASE WHEN from_address = ? THEN 1 END) as sent_count,
        MIN(block_timestamp) as first_seen,
        MAX(block_timestamp) as last_active
      FROM events
      WHERE from_address = ? OR to_address = ?
    `).get(address, address, address, address) as any;

    // Calculate holding duration
    const holdingDuration = transactions.first_seen
      ? Math.floor((Date.now() / 1000 - transactions.first_seen) / 86400)
      : 0;

    const metrics: HolderMetrics = {
      address,
      totalHoldings: holdings?.total_holdings?.toString() || '0',
      uniqueTokens: holdings?.unique_tokens || 0,
      firstSeen: new Date(transactions.first_seen * 1000),
      lastActive: new Date(transactions.last_active * 1000),
      transactionCount: transactions.total_count,
      receivedCount: transactions.received_count,
      sentCount: transactions.sent_count,
      holdingDuration
    };

    this.setCache(cacheKey, metrics);
    return metrics;
  }

  /**
   * Get comprehensive token metrics
   */
  async getTokenMetrics(tokenId: string): Promise<TokenMetrics> {
    const cacheKey = `token:${tokenId}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Get basic token stats
    const basicStats = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT address) as unique_holders,
        SUM(CAST(balance AS INTEGER)) as total_supply
      FROM current_state
      WHERE token_id = ? AND balance > 0
    `).get(tokenId) as any;

    // Get transfer volumes
    const now = Math.floor(Date.now() / 1000);
    const day = 86400;

    const volumes = this.db.prepare(`
      SELECT 
        SUM(CASE WHEN block_timestamp >= ? THEN CAST(amount AS INTEGER) ELSE 0 END) as volume_24h,
        SUM(CASE WHEN block_timestamp >= ? THEN CAST(amount AS INTEGER) ELSE 0 END) as volume_7d,
        SUM(CASE WHEN block_timestamp >= ? THEN CAST(amount AS INTEGER) ELSE 0 END) as volume_30d,
        COUNT(CASE WHEN block_timestamp >= ? THEN 1 END) as transfers_24h
      FROM events
      WHERE token_id = ?
    `).get(now - day, now - (7 * day), now - (30 * day), now - day, tokenId) as any;

    // Calculate velocity (transfers per day)
    const velocity = volumes.transfers_24h || 0;

    // Calculate concentration (Gini coefficient)
    const balances = this.db.prepare(`
      SELECT CAST(balance AS INTEGER) as balance
      FROM current_state
      WHERE token_id = ? AND balance > 0
      ORDER BY balance DESC
    `).all(tokenId) as any[];

    const concentration = this.calculateGiniCoefficient(balances.map(b => b.balance));

    // Get top holder percentage
    const topHolder = balances[0]?.balance || 0;
    const topHolderPercentage = basicStats.total_supply > 0
      ? (topHolder * 100) / basicStats.total_supply
      : 0;

    // Calculate average holding period
    const holdingPeriod = this.db.prepare(`
      SELECT AVG(
        CASE 
          WHEN last_updated_block IS NOT NULL 
          THEN (? - block_timestamp) / 86400
          ELSE 0
        END
      ) as avg_holding_period
      FROM (
        SELECT 
          address,
          MIN(block_timestamp) as block_timestamp,
          MAX(block_number) as last_updated_block
        FROM events
        WHERE token_id = ? AND to_address != '0x0000000000000000000000000000000000000000'
        GROUP BY address
      )
    `).get(now, tokenId) as any;

    const metrics: TokenMetrics = {
      tokenId,
      uniqueHolders: basicStats.unique_holders || 0,
      totalSupply: basicStats.total_supply?.toString() || '0',
      velocity,
      concentration,
      topHolderPercentage,
      averageHoldingPeriod: Math.round(holdingPeriod?.avg_holding_period || 0),
      transferVolume24h: volumes.volume_24h?.toString() || '0',
      transferVolume7d: volumes.volume_7d?.toString() || '0',
      transferVolume30d: volumes.volume_30d?.toString() || '0'
    };

    this.setCache(cacheKey, metrics);
    return metrics;
  }

  /**
   * Get network-wide metrics
   */
  async getNetworkMetrics(): Promise<NetworkMetrics> {
    const cacheKey = 'network:metrics';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const now = Math.floor(Date.now() / 1000);
    const day = 86400;

    // Get transfer and address stats
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_transfers,
        COUNT(DISTINCT CASE WHEN block_timestamp >= ? THEN from_address END) +
        COUNT(DISTINCT CASE WHEN block_timestamp >= ? THEN to_address END) as active_24h,
        COUNT(DISTINCT CASE WHEN block_timestamp >= ? THEN from_address END) +
        COUNT(DISTINCT CASE WHEN block_timestamp >= ? THEN to_address END) as active_7d,
        COUNT(DISTINCT CASE WHEN block_timestamp >= ? THEN from_address END) +
        COUNT(DISTINCT CASE WHEN block_timestamp >= ? THEN to_address END) as active_30d,
        AVG(CAST(amount AS INTEGER)) as avg_transfer_size
      FROM events
    `).get(
      now - day, now - day,
      now - (7 * day), now - (7 * day),
      now - (30 * day), now - (30 * day)
    ) as any;

    // Get new addresses
    const newAddresses = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT CASE WHEN first_seen >= ? THEN address END) as new_24h,
        COUNT(DISTINCT CASE WHEN first_seen >= ? THEN address END) as new_7d
      FROM (
        SELECT 
          to_address as address,
          MIN(block_timestamp) as first_seen
        FROM events
        WHERE to_address != '0x0000000000000000000000000000000000000000'
        GROUP BY to_address
      )
    `).get(now - day, now - (7 * day)) as any;

    // Get peak activity patterns
    const hourlyActivity = this.db.prepare(`
      SELECT 
        CAST(strftime('%H', block_timestamp, 'unixepoch') AS INTEGER) as hour,
        COUNT(*) as count
      FROM events
      WHERE block_timestamp >= ?
      GROUP BY hour
      ORDER BY count DESC
      LIMIT 1
    `).get(now - (7 * day)) as any;

    const dailyActivity = this.db.prepare(`
      SELECT 
        strftime('%w', block_timestamp, 'unixepoch') as day_of_week,
        COUNT(*) as count
      FROM events
      WHERE block_timestamp >= ?
      GROUP BY day_of_week
      ORDER BY count DESC
      LIMIT 1
    `).get(now - (30 * day)) as any;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const metrics: NetworkMetrics = {
      totalTransfers: stats.total_transfers || 0,
      activeAddresses24h: stats.active_24h || 0,
      activeAddresses7d: stats.active_7d || 0,
      activeAddresses30d: stats.active_30d || 0,
      newAddresses24h: newAddresses.new_24h || 0,
      newAddresses7d: newAddresses.new_7d || 0,
      gasUsed: '0', // Would need gas data from events
      averageTransferSize: stats.avg_transfer_size?.toString() || '0',
      peakActivityHour: hourlyActivity?.hour || 0,
      peakActivityDay: dayNames[parseInt(dailyActivity?.day_of_week || '0')]
    };

    this.setCache(cacheKey, metrics);
    return metrics;
  }

  /**
   * Calculate Gini coefficient for distribution analysis
   */
  private calculateGiniCoefficient(values: number[]): number {
    if (values.length === 0) return 0;
    
    // Sort values in ascending order
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const total = sorted.reduce((sum, val) => sum + val, 0);
    
    if (total === 0) return 0;
    
    let cumulativeSum = 0;
    let giniSum = 0;
    
    for (let i = 0; i < n; i++) {
      cumulativeSum += sorted[i];
      giniSum += (n - i) * sorted[i];
    }
    
    const gini = (n + 1 - 2 * giniSum / total) / n;
    return Math.max(0, Math.min(1, gini)); // Ensure between 0 and 1
  }

  /**
   * Get whale activity metrics
   */
  async getWhaleActivity(threshold: string): Promise<{
    whaleCount: number;
    whaleSupply: string;
    whalePercentage: number;
    recentWhaleTransfers: any[];
  }> {
    const whales = this.db.prepare(`
      SELECT 
        address,
        SUM(CAST(balance AS INTEGER)) as total_balance
      FROM current_state
      WHERE balance > 0
      GROUP BY address
      HAVING total_balance >= ?
    `).all(threshold) as any[];

    const totalSupply = this.db.prepare(`
      SELECT SUM(CAST(balance AS INTEGER)) as total
      FROM current_state
      WHERE balance > 0
    `).get() as any;

    const whaleSupply = whales.reduce((sum, w) => sum + BigInt(w.total_balance), BigInt(0));
    const whalePercentage = totalSupply.total > 0
      ? Number((whaleSupply * BigInt(100)) / BigInt(totalSupply.total))
      : 0;

    // Get recent whale transfers
    const whaleAddresses = whales.map(w => w.address);
    const recentTransfers = this.db.prepare(`
      SELECT *
      FROM events
      WHERE (from_address IN (${whaleAddresses.map(() => '?').join(',')}) 
         OR to_address IN (${whaleAddresses.map(() => '?').join(',')}))
        AND block_timestamp >= ?
      ORDER BY block_number DESC
      LIMIT 10
    `).all(...whaleAddresses, ...whaleAddresses, Math.floor(Date.now() / 1000) - 86400) as any[];

    return {
      whaleCount: whales.length,
      whaleSupply: whaleSupply.toString(),
      whalePercentage,
      recentWhaleTransfers: recentTransfers
    };
  }

  /**
   * Get liquidity metrics
   */
  async getLiquidityMetrics(): Promise<{
    liquidityScore: number;
    volumeToSupplyRatio: number;
    uniqueTradersRatio: number;
    averageTradeSize: string;
  }> {
    const metrics = this.db.prepare(`
      SELECT 
        COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) as unique_traders,
        COUNT(*) as total_trades,
        SUM(CAST(amount AS INTEGER)) as total_volume,
        AVG(CAST(amount AS INTEGER)) as avg_trade_size
      FROM events
      WHERE block_timestamp >= ?
    `).get(Math.floor(Date.now() / 1000) - (30 * 86400)) as any;

    const totalHolders = this.db.prepare(`
      SELECT COUNT(DISTINCT address) as count
      FROM current_state
      WHERE balance > 0
    `).get() as any;

    const totalSupply = this.db.prepare(`
      SELECT SUM(CAST(balance AS INTEGER)) as total
      FROM current_state
      WHERE balance > 0
    `).get() as any;

    const volumeToSupplyRatio = totalSupply.total > 0
      ? metrics.total_volume / totalSupply.total
      : 0;

    const uniqueTradersRatio = totalHolders.count > 0
      ? metrics.unique_traders / totalHolders.count
      : 0;

    // Calculate liquidity score (0-100)
    const liquidityScore = Math.min(100, Math.round(
      (volumeToSupplyRatio * 30) +
      (uniqueTradersRatio * 50) +
      (Math.min(metrics.total_trades / 100, 1) * 20)
    ));

    return {
      liquidityScore,
      volumeToSupplyRatio,
      uniqueTradersRatio,
      averageTradeSize: metrics.avg_trade_size?.toString() || '0'
    };
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
  }
}