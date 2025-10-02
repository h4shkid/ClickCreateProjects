import { getDatabase } from '@/lib/database/init';

export interface ExactMatchHolder {
  address: string;
  tokenIds: string[];
  tokenBalances: Record<string, number>;
  totalBalance: string;
  numberOfCompleteSets: number;
}

export class ExactMatchDetector {
  private db: any;

  constructor() {
    const dbManager = getDatabase();
    this.db = dbManager.getDb();
  }

  /**
   * Find holders who own EXACTLY the specified tokens (no more, no less)
   * @param tokenIds Array of token IDs that must be held
   * @returns Array of holders who have exactly these tokens
   */
  async findExactMatchHolders(tokenIds: string[]): Promise<ExactMatchHolder[]> {
    if (!tokenIds || tokenIds.length === 0) {
      return [];
    }

    // Step 1: Find all addresses that have ALL the required tokens
    const placeholders = tokenIds.map(() => '?').join(',');
    const requiredTokensQuery = `
      SELECT address
      FROM current_state
      WHERE token_id IN (${placeholders})
        AND balance > 0
      GROUP BY address
      HAVING COUNT(DISTINCT token_id) = ?
    `;
    
    const addressesWithAllTokens = this.db.prepare(requiredTokensQuery)
      .all(...tokenIds, tokenIds.length) as any[];

    if (addressesWithAllTokens.length === 0) {
      return [];
    }

    // Step 2: Filter out addresses that have additional tokens beyond the required ones
    const exactMatchHolders: ExactMatchHolder[] = [];
    
    for (const row of addressesWithAllTokens) {
      const address = row.address;
      
      // Check if this address has any tokens NOT in our required list
      const allTokensQuery = `
        SELECT token_id, balance
        FROM current_state
        WHERE address = ?
          AND balance > 0
      `;
      
      const allTokens = this.db.prepare(allTokensQuery).all(address) as any[];
      
      // Check if all tokens owned are in our required list
      const hasOnlyRequiredTokens = allTokens.every((token: any) => 
        tokenIds.includes(token.token_id)
      );
      
      if (hasOnlyRequiredTokens) {
        const tokenBalances: Record<string, number> = {};
        allTokens.forEach((token: any) => {
          tokenBalances[token.token_id] = parseInt(token.balance);
        });
        
        const totalBalance = allTokens.reduce((sum: bigint, token: any) => 
          sum + BigInt(token.balance), BigInt(0)
        ).toString();
        
        // Calculate number of complete sets (minimum balance across all tokens)
        const numberOfCompleteSets = Math.min(...tokenIds.map(id => tokenBalances[id] || 0));
        
        exactMatchHolders.push({
          address,
          tokenIds: allTokens.map((t: any) => t.token_id),
          tokenBalances,
          totalBalance,
          numberOfCompleteSets
        });
      }
    }

    return exactMatchHolders;
  }

  /**
   * Find holders who own ANY of the specified tokens
   * @param tokenIds Array of token IDs
   * @returns Array of holders who have any of these tokens
   */
  async findAnyMatchHolders(tokenIds: string[]): Promise<ExactMatchHolder[]> {
    if (!tokenIds || tokenIds.length === 0) {
      return [];
    }

    const placeholders = tokenIds.map(() => '?').join(',');
    const query = `
      SELECT 
        address,
        GROUP_CONCAT(token_id) as token_ids,
        SUM(balance) as total_balance
      FROM current_state
      WHERE token_id IN (${placeholders})
        AND balance > 0
      GROUP BY address
      ORDER BY total_balance DESC
    `;

    const holders = this.db.prepare(query).all(...tokenIds) as any[];

    return holders.map((holder: any) => {
      const tokenIdList = holder.token_ids.split(',');
      
      // Get individual balances for each token
      const tokenBalances: Record<string, number> = {};
      for (const tokenId of tokenIdList) {
        const balanceQuery = `SELECT balance FROM current_state WHERE address = ? AND token_id = ?`;
        const result = this.db.prepare(balanceQuery).get(holder.address, tokenId);
        tokenBalances[tokenId] = result ? parseInt(result.balance) : 0;
      }
      
      // Calculate number of complete sets if all tokens are present
      const hasAllTokens = tokenIds.every(id => tokenIdList.includes(id));
      const numberOfCompleteSets = hasAllTokens 
        ? Math.min(...tokenIds.map(id => tokenBalances[id] || 0))
        : 0;
      
      return {
        address: holder.address,
        tokenIds: tokenIdList,
        tokenBalances,
        totalBalance: holder.total_balance,
        numberOfCompleteSets
      };
    });
  }

  /**
   * Get statistics about exact vs any match
   */
  async getMatchStatistics(tokenIds: string[]): Promise<{
    exactMatchCount: number;
    anyMatchCount: number;
    tokenCombinations: Map<string, number>;
  }> {
    const exactMatches = await this.findExactMatchHolders(tokenIds);
    const anyMatches = await this.findAnyMatchHolders(tokenIds);

    // Count different token combinations
    const combinations = new Map<string, number>();
    for (const holder of anyMatches) {
      const combo = holder.tokenIds.sort().join(',');
      combinations.set(combo, (combinations.get(combo) || 0) + 1);
    }

    return {
      exactMatchCount: exactMatches.length,
      anyMatchCount: anyMatches.length,
      tokenCombinations: combinations
    };
  }
}