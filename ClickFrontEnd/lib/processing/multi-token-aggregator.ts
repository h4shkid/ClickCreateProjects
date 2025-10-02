import { SnapshotGenerator, Snapshot, SnapshotOptions } from './snapshot-generator';

export interface AggregatedHolder {
  address: string;
  tokens: Array<{
    tokenId: string;
    balance: string;
  }>;
  totalTokens: number;
  aggregatedBalance?: string; // For fungible tokens
}

export interface AggregatedSnapshot {
  blockNumber: number;
  timestamp: number;
  tokenIds: string[];
  uniqueHolders: number;
  totalHolders: number; // Sum of holders across all tokens
  aggregatedHolders: AggregatedHolder[];
  tokenSnapshots: Snapshot[];
  statistics: {
    averageTokensPerHolder: number;
    maxTokensHeld: number;
    topHoldersByTokenCount: AggregatedHolder[];
    crossTokenHolders: number; // Holders with multiple tokens
  };
}

export class MultiTokenAggregator {
  private snapshotGenerator: SnapshotGenerator;

  constructor() {
    this.snapshotGenerator = new SnapshotGenerator();
  }

  /**
   * Generate aggregated snapshot for multiple tokens
   */
  async generateAggregatedSnapshot(
    tokenIds: string[],
    blockNumber?: number
  ): Promise<AggregatedSnapshot> {
    console.log(`🔄 Generating aggregated snapshot for ${tokenIds.length} tokens...`);
    
    // Generate individual snapshots
    const options: SnapshotOptions = {
      tokenIds,
      blockNumber,
      includeMetadata: true,
      includeZeroBalances: false
    };
    
    const snapshots = blockNumber
      ? await this.snapshotGenerator.generateHistoricalSnapshot({ ...options, blockNumber })
      : await this.snapshotGenerator.generateCurrentSnapshot(options);
    
    // Aggregate holders across tokens
    const holderMap = new Map<string, AggregatedHolder>();
    
    for (const snapshot of snapshots) {
      for (const holder of snapshot.holders) {
        if (!holderMap.has(holder.address)) {
          holderMap.set(holder.address, {
            address: holder.address,
            tokens: [],
            totalTokens: 0
          });
        }
        
        const aggregatedHolder = holderMap.get(holder.address)!;
        aggregatedHolder.tokens.push({
          tokenId: snapshot.tokenId,
          balance: holder.balance
        });
        aggregatedHolder.totalTokens++;
      }
    }
    
    const aggregatedHolders = Array.from(holderMap.values());
    
    // Sort by number of tokens held
    aggregatedHolders.sort((a, b) => b.totalTokens - a.totalTokens);
    
    // Calculate statistics
    const totalHolders = snapshots.reduce((sum, s) => sum + s.holderCount, 0);
    const uniqueHolders = aggregatedHolders.length;
    const averageTokensPerHolder = uniqueHolders > 0 
      ? totalHolders / uniqueHolders 
      : 0;
    
    const maxTokensHeld = Math.max(...aggregatedHolders.map(h => h.totalTokens), 0);
    const topHoldersByTokenCount = aggregatedHolders.slice(0, 10);
    const crossTokenHolders = aggregatedHolders.filter(h => h.totalTokens > 1).length;
    
    return {
      blockNumber: snapshots[0]?.blockNumber || 0,
      timestamp: snapshots[0]?.timestamp || Date.now(),
      tokenIds,
      uniqueHolders,
      totalHolders,
      aggregatedHolders,
      tokenSnapshots: snapshots,
      statistics: {
        averageTokensPerHolder,
        maxTokensHeld,
        topHoldersByTokenCount,
        crossTokenHolders
      }
    };
  }

  /**
   * Find common holders across multiple tokens
   */
  findCommonHolders(snapshots: Snapshot[]): Array<{
    address: string;
    tokensHeld: Array<{ tokenId: string; balance: string }>;
  }> {
    const holderTokens = new Map<string, Array<{ tokenId: string; balance: string }>>();
    
    for (const snapshot of snapshots) {
      for (const holder of snapshot.holders) {
        if (!holderTokens.has(holder.address)) {
          holderTokens.set(holder.address, []);
        }
        holderTokens.get(holder.address)!.push({
          tokenId: snapshot.tokenId,
          balance: holder.balance
        });
      }
    }
    
    // Filter for holders with multiple tokens
    const commonHolders: Array<{
      address: string;
      tokensHeld: Array<{ tokenId: string; balance: string }>;
    }> = [];
    
    for (const [address, tokens] of holderTokens) {
      if (tokens.length > 1) {
        commonHolders.push({ address, tokensHeld: tokens });
      }
    }
    
    // Sort by number of tokens held
    commonHolders.sort((a, b) => b.tokensHeld.length - a.tokensHeld.length);
    
    return commonHolders;
  }

  /**
   * Calculate token distribution metrics
   */
  calculateDistributionMetrics(snapshot: AggregatedSnapshot): {
    giniCoefficient: number;
    herfindahlIndex: number;
    concentrationRatio: { cr5: number; cr10: number; cr20: number };
  } {
    // For each token, calculate distribution metrics
    const metrics = {
      giniCoefficient: 0,
      herfindahlIndex: 0,
      concentrationRatio: { cr5: 0, cr10: 0, cr20: 0 }
    };
    
    if (snapshot.tokenSnapshots.length === 0) {
      return metrics;
    }
    
    // Average metrics across all tokens
    let totalGini = 0;
    let totalHHI = 0;
    let totalCR5 = 0;
    let totalCR10 = 0;
    let totalCR20 = 0;
    
    for (const tokenSnapshot of snapshot.tokenSnapshots) {
      const balances = tokenSnapshot.holders.map(h => BigInt(h.balance));
      const totalSupply = BigInt(tokenSnapshot.totalSupply);
      
      if (totalSupply === 0n) continue;
      
      // Gini coefficient (simplified)
      const sortedBalances = [...balances].sort((a, b) => Number(a - b));
      let cumulativeSum = 0n;
      let giniSum = 0n;
      
      for (let i = 0; i < sortedBalances.length; i++) {
        cumulativeSum += sortedBalances[i];
        giniSum += cumulativeSum;
      }
      
      const gini = sortedBalances.length > 0
        ? 1 - (2 * Number(giniSum) / (sortedBalances.length * Number(totalSupply)))
        : 0;
      
      totalGini += Math.max(0, Math.min(1, gini));
      
      // Herfindahl-Hirschman Index
      let hhi = 0;
      for (const balance of balances) {
        const share = Number(balance * 10000n / totalSupply) / 10000;
        hhi += share * share;
      }
      totalHHI += hhi;
      
      // Concentration ratios
      const topHolders = tokenSnapshot.holders.slice(0, 20);
      totalCR5 += topHolders.slice(0, 5).reduce((sum, h) => sum + h.percentage, 0);
      totalCR10 += topHolders.slice(0, 10).reduce((sum, h) => sum + h.percentage, 0);
      totalCR20 += topHolders.slice(0, 20).reduce((sum, h) => sum + h.percentage, 0);
    }
    
    const tokenCount = snapshot.tokenSnapshots.length;
    
    return {
      giniCoefficient: totalGini / tokenCount,
      herfindahlIndex: totalHHI / tokenCount,
      concentrationRatio: {
        cr5: totalCR5 / tokenCount,
        cr10: totalCR10 / tokenCount,
        cr20: totalCR20 / tokenCount
      }
    };
  }

  /**
   * Export aggregated snapshot to CSV format
   */
  exportToCSV(snapshot: AggregatedSnapshot): string {
    const headers = ['Address', 'Total Tokens', ...snapshot.tokenIds.map(id => `Token_${id}`)];
    const rows: string[] = [headers.join(',')];
    
    for (const holder of snapshot.aggregatedHolders) {
      const row = [holder.address, holder.totalTokens.toString()];
      
      // Add balance for each token
      for (const tokenId of snapshot.tokenIds) {
        const token = holder.tokens.find(t => t.tokenId === tokenId);
        row.push(token ? token.balance : '0');
      }
      
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  }

  /**
   * Generate collection statistics
   */
  generateCollectionStats(snapshots: Snapshot[]): {
    totalUniqueHolders: number;
    totalSupplyAcrossTokens: string;
    averageHoldersPerToken: number;
    mostHeldToken: { tokenId: string; holders: number };
    leastHeldToken: { tokenId: string; holders: number };
    tokenDistribution: Array<{ tokenId: string; holders: number; percentage: number }>;
  } {
    const uniqueHolders = new Set<string>();
    let totalSupply = 0n;
    let totalHolders = 0;
    
    let mostHeld = { tokenId: '', holders: 0 };
    let leastHeld = { tokenId: '', holders: Infinity };
    const tokenDistribution: Array<{ tokenId: string; holders: number; percentage: number }> = [];
    
    for (const snapshot of snapshots) {
      snapshot.holders.forEach(h => uniqueHolders.add(h.address));
      totalSupply += BigInt(snapshot.totalSupply);
      totalHolders += snapshot.holderCount;
      
      if (snapshot.holderCount > mostHeld.holders) {
        mostHeld = { tokenId: snapshot.tokenId, holders: snapshot.holderCount };
      }
      
      if (snapshot.holderCount < leastHeld.holders) {
        leastHeld = { tokenId: snapshot.tokenId, holders: snapshot.holderCount };
      }
      
      tokenDistribution.push({
        tokenId: snapshot.tokenId,
        holders: snapshot.holderCount,
        percentage: 0
      });
    }
    
    // Calculate percentages
    if (totalHolders > 0) {
      tokenDistribution.forEach(td => {
        td.percentage = (td.holders / totalHolders) * 100;
      });
    }
    
    return {
      totalUniqueHolders: uniqueHolders.size,
      totalSupplyAcrossTokens: totalSupply.toString(),
      averageHoldersPerToken: snapshots.length > 0 ? totalHolders / snapshots.length : 0,
      mostHeldToken: mostHeld,
      leastHeldToken: leastHeld.holders === Infinity 
        ? { tokenId: '', holders: 0 } 
        : leastHeld,
      tokenDistribution
    };
  }
}