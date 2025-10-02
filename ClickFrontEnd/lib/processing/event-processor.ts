import Database from 'better-sqlite3';
import { TransferEvent } from '../blockchain/contracts/erc1155';
import { getDatabase } from '../database/init';

export interface ProcessingResult {
  eventsProcessed: number;
  stateUpdates: number;
  errors: number;
  duplicates: number;
}

export interface HolderBalance {
  address: string;
  tokenId: string;
  balance: string;
  lastUpdatedBlock: number;
}

export class EventProcessor {
  private db: Database.Database;

  constructor() {
    const dbManager = getDatabase();
    this.db = dbManager.getDb();
  }

  /**
   * Process and store transfer events
   */
  async processEvents(events: TransferEvent[]): Promise<ProcessingResult> {
    console.log(`🔄 Processing ${events.length} events...`);
    
    const result: ProcessingResult = {
      eventsProcessed: 0,
      stateUpdates: 0,
      errors: 0,
      duplicates: 0
    };

    // Prepare statements for better performance
    const insertEventStmt = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        block_number, block_timestamp, transaction_hash, log_index,
        event_type, operator, from_address, to_address, token_id, amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const upsertStateStmt = this.db.prepare(`
      INSERT INTO current_state (address, token_id, balance, last_updated_block)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(address, token_id) DO UPDATE SET
        balance = ?,
        last_updated_block = ?,
        updated_at = CURRENT_TIMESTAMP
    `);

    const getBalanceStmt = this.db.prepare(`
      SELECT balance FROM current_state
      WHERE address = ? AND token_id = ?
    `);

    // Use transaction for atomic operations
    const processTransaction = this.db.transaction((events: TransferEvent[]) => {
      for (const event of events) {
        try {
          // Store event (with normalized addresses)
          const eventResult = insertEventStmt.run(
            event.blockNumber,
            event.blockTimestamp,
            event.transactionHash,
            event.logIndex,
            event.eventType,
            event.operator ? event.operator.toLowerCase() : event.operator,
            event.from.toLowerCase(),
            event.to.toLowerCase(),
            event.tokenId,
            event.amount
          );

          if (eventResult.changes > 0) {
            result.eventsProcessed++;
            
            // Update balances
            this.updateBalances(
              event,
              getBalanceStmt,
              upsertStateStmt,
              result
            );
          } else {
            result.duplicates++;
          }
        } catch (error) {
          console.error('Error processing event:', error);
          result.errors++;
        }
      }
    });

    // Execute transaction
    try {
      processTransaction(events);
      console.log(`✅ Processing complete:`, result);
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw error;
    }

    return result;
  }

  /**
   * Update holder balances based on transfer event
   */
  private updateBalances(
    event: TransferEvent,
    getBalanceStmt: Database.Statement,
    upsertStateStmt: Database.Statement,
    result: ProcessingResult
  ): void {
    const amount = BigInt(event.amount);
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    // Update sender balance (if not mint)
    if (event.from.toLowerCase() !== zeroAddress) {
      const normalizedFrom = event.from.toLowerCase();
      const currentBalance = this.getCurrentBalance(
        normalizedFrom,
        event.tokenId,
        getBalanceStmt
      );
      const newBalance = currentBalance - amount;
      
      if (newBalance >= BigInt(0)) {
        upsertStateStmt.run(
          normalizedFrom,
          event.tokenId,
          newBalance.toString(),
          event.blockNumber,
          newBalance.toString(),
          event.blockNumber
        );
        result.stateUpdates++;
      } else {
        console.warn(`⚠️ Negative balance detected for ${normalizedFrom}, token ${event.tokenId}`);
      }
    }

    // Update receiver balance (if not burn)
    if (event.to.toLowerCase() !== zeroAddress) {
      const normalizedTo = event.to.toLowerCase();
      const currentBalance = this.getCurrentBalance(
        normalizedTo,
        event.tokenId,
        getBalanceStmt
      );
      const newBalance = currentBalance + amount;
      
      upsertStateStmt.run(
        normalizedTo,
        event.tokenId,
        newBalance.toString(),
        event.blockNumber,
        newBalance.toString(),
        event.blockNumber
      );
      result.stateUpdates++;
    }
  }

  /**
   * Get current balance for address and token
   */
  private getCurrentBalance(
    address: string,
    tokenId: string,
    stmt: Database.Statement
  ): bigint {
    const row = stmt.get(address, tokenId) as { balance: string } | undefined;
    return row ? BigInt(row.balance) : BigInt(0);
  }

  /**
   * Get all holders for a specific token
   */
  getTokenHolders(tokenId: string): HolderBalance[] {
    const stmt = this.db.prepare(`
      SELECT address, token_id, balance, last_updated_block
      FROM current_state
      WHERE token_id = ? AND CAST(balance AS INTEGER) > 0
      ORDER BY CAST(balance AS INTEGER) DESC
    `);

    const rows = stmt.all(tokenId) as HolderBalance[];
    return rows;
  }

  /**
   * Get all tokens held by an address
   */
  getAddressTokens(address: string): HolderBalance[] {
    const stmt = this.db.prepare(`
      SELECT address, token_id, balance, last_updated_block
      FROM current_state
      WHERE address = ? AND CAST(balance AS INTEGER) > 0
      ORDER BY token_id
    `);

    const rows = stmt.all(address) as HolderBalance[];
    return rows;
  }

  /**
   * Get holder count for token
   */
  getHolderCount(tokenId: string): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(DISTINCT address) as count
      FROM current_state
      WHERE token_id = ? AND CAST(balance AS INTEGER) > 0
    `);

    const row = stmt.get(tokenId) as { count: number };
    return row.count;
  }

  /**
   * Get total supply for token
   */
  getTotalSupply(tokenId: string): string {
    const stmt = this.db.prepare(`
      SELECT SUM(CAST(balance AS INTEGER)) as total
      FROM current_state
      WHERE token_id = ?
    `);

    const row = stmt.get(tokenId) as { total: string | null };
    return row.total || '0';
  }

  /**
   * Update sync status
   */
  updateSyncStatus(
    contractAddress: string,
    lastBlock: number,
    status: 'syncing' | 'synced' | 'error',
    error?: string
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO sync_status (contract_address, last_synced_block, status, error_message)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(contract_address) DO UPDATE SET
        last_synced_block = ?,
        status = ?,
        error_message = ?,
        sync_timestamp = CURRENT_TIMESTAMP
    `);

    stmt.run(
      contractAddress,
      lastBlock,
      status,
      error || null,
      lastBlock,
      status,
      error || null
    );
  }

  /**
   * Get sync status
   */
  getSyncStatus(contractAddress: string): {
    lastSyncedBlock: number;
    status: string;
    syncTimestamp: string;
  } | null {
    const stmt = this.db.prepare(`
      SELECT last_synced_block, status, sync_timestamp
      FROM sync_status
      WHERE contract_address = ?
    `);

    const row = stmt.get(contractAddress) as any;
    return row ? {
      lastSyncedBlock: row.last_synced_block,
      status: row.status,
      syncTimestamp: row.sync_timestamp
    } : null;
  }

  /**
   * Clear all data for fresh sync
   */
  clearAllData(): void {
    console.log('⚠️ Clearing all data...');
    
    const clearTransaction = this.db.transaction(() => {
      this.db.exec('DELETE FROM events');
      this.db.exec('DELETE FROM current_state');
      this.db.exec('DELETE FROM snapshot_cache');
      this.db.exec('DELETE FROM analytics_summary');
      this.db.exec('DELETE FROM sync_status');
    });

    clearTransaction();
    console.log('✅ All data cleared');
  }

  /**
   * Get event statistics
   */
  getEventStats(): {
    totalEvents: number;
    uniqueHolders: number;
    uniqueTokens: number;
    lastBlockProcessed: number;
  } {
    const totalEvents = (this.db.prepare('SELECT COUNT(*) as count FROM events').get() as any).count;
    const uniqueHolders = (this.db.prepare('SELECT COUNT(DISTINCT address) as count FROM current_state').get() as any).count;
    const uniqueTokens = (this.db.prepare('SELECT COUNT(DISTINCT token_id) as count FROM current_state').get() as any).count;
    const lastBlock = (this.db.prepare('SELECT MAX(block_number) as block FROM events').get() as any).block || 0;

    return {
      totalEvents,
      uniqueHolders,
      uniqueTokens,
      lastBlockProcessed: lastBlock
    };
  }

  /**
   * Rebuild state from events (useful for fixing inconsistencies)
   */
  rebuildStateFromEvents(): void {
    console.log('🔧 Rebuilding state from events...');
    
    const rebuildTransaction = this.db.transaction(() => {
      // Clear current state
      this.db.exec('DELETE FROM current_state');
      
      // Rebuild from events
      const events = this.db.prepare(`
        SELECT * FROM events
        ORDER BY block_number, log_index
      `).all() as any[];

      const balances = new Map<string, bigint>();
      const lastBlocks = new Map<string, number>();

      for (const event of events) {
        const key = `${event.from_address}:${event.token_id}`;
        const amount = BigInt(event.amount);
        const zeroAddress = '0x0000000000000000000000000000000000000000';

        // Process from address
        if (event.from_address.toLowerCase() !== zeroAddress) {
          const fromKey = `${event.from_address}:${event.token_id}`;
          const currentBalance = balances.get(fromKey) || BigInt(0);
          balances.set(fromKey, currentBalance - amount);
          lastBlocks.set(fromKey, event.block_number);
        }

        // Process to address
        if (event.to_address.toLowerCase() !== zeroAddress) {
          const toKey = `${event.to_address}:${event.token_id}`;
          const currentBalance = balances.get(toKey) || BigInt(0);
          balances.set(toKey, currentBalance + amount);
          lastBlocks.set(toKey, event.block_number);
        }
      }

      // Insert rebuilt state
      const insertStmt = this.db.prepare(`
        INSERT INTO current_state (address, token_id, balance, last_updated_block)
        VALUES (?, ?, ?, ?)
      `);

      for (const [key, balance] of balances.entries()) {
        if (balance > BigInt(0)) {
          const [address, tokenId] = key.split(':');
          const lastBlock = lastBlocks.get(key) || 0;
          insertStmt.run(address, tokenId, balance.toString(), lastBlock);
        }
      }
    });

    rebuildTransaction();
    console.log('✅ State rebuilt successfully');
  }
}