import { getDatabase } from '@/lib/database/init';

export interface FullSeasonHolder {
  address: string;
  tokensOwned: string[];
  tokenBalances: Record<string, number>;
  missingTokens: string[];
  completionPercentage: number;
  isComplete: boolean;
  numberOfCompleteSets: number;
  totalTokensHeld: number;
}

export class FullSeasonDetector {
  private db: any;

  constructor() {
    const dbManager = getDatabase();
    this.db = dbManager.getDb();
  }

  /**
   * Find holders who own at least one of every token in the specified season
   */
  async findFullSeasonHolders(seasonTokenIds: string[]): Promise<FullSeasonHolder[]> {
    // Get all holders and their tokens for this season with balances
    const query = `
      SELECT 
        address,
        token_id,
        balance
      FROM current_state
      WHERE token_id IN (${seasonTokenIds.map(() => '?').join(',')})
        AND balance > 0
      ORDER BY address, token_id
    `;

    const holdings = this.db.prepare(query).all(...seasonTokenIds) as any[];

    // Group by holder address with balance tracking
    const holderMap = new Map<string, Map<string, number>>();
    
    for (const holding of holdings) {
      if (!holderMap.has(holding.address)) {
        holderMap.set(holding.address, new Map());
      }
      holderMap.get(holding.address)!.set(holding.token_id, parseInt(holding.balance));
    }

    // Check which holders have complete sets and calculate number of sets
    const results: FullSeasonHolder[] = [];

    for (const [address, tokenBalances] of holderMap) {
      const ownedTokens = Array.from(tokenBalances.keys());
      const missingTokens = seasonTokenIds.filter(tokenId => !tokenBalances.has(tokenId));
      const completionPercentage = (ownedTokens.length / seasonTokenIds.length) * 100;
      const isComplete = missingTokens.length === 0;
      
      // Calculate number of complete sets (minimum balance across all tokens in the set)
      let numberOfCompleteSets = 0;
      if (isComplete) {
        numberOfCompleteSets = Math.min(...seasonTokenIds.map(tokenId => tokenBalances.get(tokenId) || 0));
      }
      
      // Calculate total tokens held
      const totalTokensHeld = Array.from(tokenBalances.values()).reduce((sum, balance) => sum + balance, 0);
      
      // Convert token balances map to object
      const tokenBalancesObj: Record<string, number> = {};
      tokenBalances.forEach((balance, tokenId) => {
        tokenBalancesObj[tokenId] = balance;
      });

      // Only include holders with complete sets or high completion for debugging
      if (isComplete || completionPercentage > 90) {
        console.log(`Holder ${address}: owns ${ownedTokens.length}/${seasonTokenIds.length} tokens, complete: ${isComplete}, sets: ${numberOfCompleteSets}`);
      }

      results.push({
        address,
        tokensOwned: ownedTokens,
        tokenBalances: tokenBalancesObj,
        missingTokens,
        completionPercentage,
        isComplete,
        numberOfCompleteSets,
        totalTokensHeld
      });
    }

    // Sort by number of complete sets first, then by completion percentage
    results.sort((a, b) => {
      // First sort by number of complete sets
      if (a.numberOfCompleteSets !== b.numberOfCompleteSets) {
        return b.numberOfCompleteSets - a.numberOfCompleteSets;
      }
      // Then by completion percentage
      if (a.isComplete && !b.isComplete) return -1;
      if (!a.isComplete && b.isComplete) return 1;
      return b.completionPercentage - a.completionPercentage;
    });

    return results;
  }

  /**
   * Get only complete season holders
   */
  async getCompleteSeasonHolders(seasonTokenIds: string[]): Promise<string[]> {
    const allHolders = await this.findFullSeasonHolders(seasonTokenIds);
    return allHolders
      .filter(holder => holder.isComplete)
      .map(holder => holder.address);
  }

  /**
   * Get statistics about season completion
   */
  async getSeasonCompletionStats(seasonTokenIds: string[]): Promise<{
    totalHolders: number;
    completeSetHolders: number;
    averageCompletion: number;
    tokenDistribution: Record<string, number>;
  }> {
    const holders = await this.findFullSeasonHolders(seasonTokenIds);
    const completeSetHolders = holders.filter(h => h.isComplete).length;
    const averageCompletion = holders.reduce((sum, h) => sum + h.completionPercentage, 0) / holders.length || 0;

    // Get distribution of how many holders own each token
    const tokenDistribution: Record<string, number> = {};
    for (const tokenId of seasonTokenIds) {
      const count = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM current_state 
        WHERE token_id = ? AND balance > 0
      `).get(tokenId)?.count || 0;
      tokenDistribution[tokenId] = count;
    }

    return {
      totalHolders: holders.length,
      completeSetHolders,
      averageCompletion,
      tokenDistribution
    };
  }
}