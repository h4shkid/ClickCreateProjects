import { getDatabase } from '../database/init';
import Database from 'better-sqlite3';
import { EventEmitter } from 'events';

export interface OptimizationResult {
  operation: string;
  itemsProcessed: number;
  timeElapsed: number;
  optimizationApplied: string[];
  performance: {
    before: number;
    after: number;
    improvement: number;
  };
}

export class PerformanceOptimizer extends EventEmitter {
  private db: Database.Database;
  private queryCache = new Map<string, { result: any; timestamp: number }>();
  private batchQueue: Array<{ query: string; params: any[]; callback: Function }> = [];
  private isProcessingBatch = false;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    super();
    const dbManager = getDatabase();
    this.db = dbManager.getDb();
    this.initializeOptimizations();
  }

  /**
   * Initialize database optimizations
   */
  private initializeOptimizations(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Optimize cache size (10MB)
    this.db.pragma('cache_size = -10000');
    
    // Enable memory mapping for faster reads
    this.db.pragma('mmap_size = 268435456'); // 256MB
    
    // Optimize temp store
    this.db.pragma('temp_store = MEMORY');
    
    // Enable query planner optimizations
    this.db.pragma('optimize');
    
    console.log('✅ Database optimizations applied');
  }

  /**
   * Create optimized indexes
   */
  async createOptimizedIndexes(): Promise<OptimizationResult> {
    const startTime = Date.now();
    const optimizations: string[] = [];

    try {
      // Analyze query patterns and create missing indexes
      const indexes = [
        {
          name: 'idx_events_composite',
          table: 'events',
          columns: '(token_id, block_number, from_address, to_address)',
          condition: 'WHERE token_id IS NOT NULL'
        },
        {
          name: 'idx_state_balance',
          table: 'current_state',
          columns: '(balance DESC)',
          condition: 'WHERE balance > 0'
        },
        {
          name: 'idx_state_composite',
          table: 'current_state',
          columns: '(token_id, address, balance)',
          condition: null
        },
        {
          name: 'idx_metadata_updated',
          table: 'nft_metadata',
          columns: '(updated_at DESC)',
          condition: null
        }
      ];

      for (const index of indexes) {
        try {
          const query = `CREATE INDEX IF NOT EXISTS ${index.name} 
            ON ${index.table} ${index.columns}
            ${index.condition || ''}`;
          
          this.db.prepare(query).run();
          optimizations.push(`Created index: ${index.name}`);
        } catch (error) {
          // Index might already exist
        }
      }

      // Analyze tables for statistics
      this.db.prepare('ANALYZE').run();
      optimizations.push('Updated table statistics');

    } catch (error) {
      console.error('Error creating indexes:', error);
    }

    const timeElapsed = Date.now() - startTime;
    
    return {
      operation: 'createOptimizedIndexes',
      itemsProcessed: optimizations.length,
      timeElapsed,
      optimizationApplied: optimizations,
      performance: {
        before: 0,
        after: 0,
        improvement: 0
      }
    };
  }

  /**
   * Batch process database operations
   */
  async batchProcess<T>(
    items: T[],
    processor: (batch: T[]) => Promise<void>,
    batchSize = 100
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    const optimizations: string[] = [];
    let processedCount = 0;

    // Process in batches within a transaction
    const batches = Math.ceil(items.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
      const batch = items.slice(i * batchSize, (i + 1) * batchSize);
      
      // Execute processor without transaction wrapper since it's async
      await processor(batch);
      processedCount += batch.length;
      
      this.emit('batchProgress', {
        current: processedCount,
        total: items.length,
        percentage: (processedCount / items.length) * 100
      });
      
      optimizations.push(`Batch ${i + 1}/${batches} processed`);
    }

    const timeElapsed = Date.now() - startTime;
    const itemsPerSecond = (items.length / timeElapsed) * 1000;

    return {
      operation: 'batchProcess',
      itemsProcessed: items.length,
      timeElapsed,
      optimizationApplied: optimizations,
      performance: {
        before: 0,
        after: itemsPerSecond,
        improvement: 0
      }
    };
  }

  /**
   * Cached query execution
   */
  async cachedQuery<T>(
    query: string,
    params: any[] = [],
    ttl = 60000 // 1 minute default
  ): Promise<T> {
    const cacheKey = `${query}:${JSON.stringify(params)}`;
    const cached = this.queryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < ttl) {
      this.cacheHits++;
      return cached.result;
    }

    this.cacheMisses++;
    const stmt = this.db.prepare(query);
    const result = stmt.all(...params) as T;
    
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (this.queryCache.size > 1000) {
      this.cleanCache();
    }

    return result;
  }

  /**
   * Optimize large dataset queries with pagination
   */
  async *paginatedQuery<T>(
    query: string,
    params: any[] = [],
    pageSize = 1000
  ): AsyncGenerator<T[], void, unknown> {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const paginatedQuery = `${query} LIMIT ${pageSize} OFFSET ${offset}`;
      const stmt = this.db.prepare(paginatedQuery);
      const results = stmt.all(...params) as T[];

      if (results.length === 0) {
        hasMore = false;
      } else {
        yield results;
        offset += pageSize;
      }

      if (results.length < pageSize) {
        hasMore = false;
      }
    }
  }

  /**
   * Vacuum database to reclaim space
   */
  async vacuumDatabase(): Promise<OptimizationResult> {
    const startTime = Date.now();
    
    // Get size before vacuum
    const sizeBefore = this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as any;
    
    // Perform vacuum
    this.db.prepare('VACUUM').run();
    
    // Get size after vacuum
    const sizeAfter = this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as any;
    
    const spaceSaved = sizeBefore.size - sizeAfter.size;
    const improvement = ((spaceSaved / sizeBefore.size) * 100) || 0;

    return {
      operation: 'vacuumDatabase',
      itemsProcessed: 1,
      timeElapsed: Date.now() - startTime,
      optimizationApplied: [`Reclaimed ${(spaceSaved / 1024 / 1024).toFixed(2)} MB`],
      performance: {
        before: sizeBefore.size,
        after: sizeAfter.size,
        improvement
      }
    };
  }

  /**
   * Optimize event processing with parallel execution
   */
  async parallelProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrency = 5
  ): Promise<R[]> {
    const results: R[] = [];
    const executing: Promise<void>[] = [];

    for (const item of items) {
      const promise = processor(item).then(result => {
        results.push(result);
      });

      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
        executing.splice(executing.findIndex(p => p), 1);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Memory-efficient streaming for large datasets
   */
  createReadStream(query: string, params: any[] = []): NodeJS.ReadableStream {
    const Readable = require('stream').Readable;
    const stmt = this.db.prepare(query);
    const iterator = stmt.iterate(...params);

    const stream = new Readable({
      objectMode: true,
      read() {
        const { value, done } = iterator.next();
        if (done) {
          this.push(null);
        } else {
          this.push(value);
        }
      }
    });

    return stream;
  }

  /**
   * Optimize state rebuilding
   */
  async optimizedStateRebuild(): Promise<OptimizationResult> {
    const startTime = Date.now();
    const optimizations: string[] = [];

    // Use transaction for atomic operation
    this.db.transaction(() => {
      // Clear current state
      this.db.prepare('DELETE FROM current_state').run();
      optimizations.push('Cleared current state');

      // Rebuild using optimized query
      this.db.prepare(`
        INSERT INTO current_state (address, token_id, balance, last_updated_block, updated_at)
        SELECT 
          address,
          token_id,
          SUM(CASE 
            WHEN address = to_address THEN CAST(amount AS INTEGER)
            WHEN address = from_address THEN -CAST(amount AS INTEGER)
            ELSE 0
          END) as balance,
          MAX(block_number) as last_updated_block,
          CURRENT_TIMESTAMP
        FROM (
          SELECT to_address as address, token_id, amount, block_number FROM events
          WHERE to_address != '0x0000000000000000000000000000000000000000'
          UNION ALL
          SELECT from_address as address, token_id, amount, block_number FROM events
          WHERE from_address != '0x0000000000000000000000000000000000000000'
        )
        GROUP BY address, token_id
        HAVING balance > 0
      `).run();
      
      optimizations.push('Rebuilt state using optimized query');
    })();

    const timeElapsed = Date.now() - startTime;

    return {
      operation: 'optimizedStateRebuild',
      itemsProcessed: 1,
      timeElapsed,
      optimizationApplied: optimizations,
      performance: {
        before: 0,
        after: timeElapsed,
        improvement: 0
      }
    };
  }

  /**
   * Clean cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > 300000) { // 5 minutes
        expired.push(key);
      }
    }

    expired.forEach(key => this.queryCache.delete(key));
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    cacheHitRate: number;
    cacheSize: number;
    totalCacheHits: number;
    totalCacheMisses: number;
    dbSize: number;
    indexCount: number;
  } {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

    const dbSize = this.db.prepare(
      "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()"
    ).get() as any;

    const indexCount = this.db.prepare(
      "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'index'"
    ).get() as any;

    return {
      cacheHitRate: Math.round(cacheHitRate),
      cacheSize: this.queryCache.size,
      totalCacheHits: this.cacheHits,
      totalCacheMisses: this.cacheMisses,
      dbSize: dbSize.size,
      indexCount: indexCount.count
    };
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.queryCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    console.log('✅ All caches cleared');
  }
}