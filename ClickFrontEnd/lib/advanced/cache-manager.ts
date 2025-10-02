import { EventEmitter } from 'events';
import { createHash } from 'crypto';

export interface CacheOptions {
  ttl?: number;
  maxSize?: number;
  strategy?: 'LRU' | 'LFU' | 'FIFO';
  persistent?: boolean;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  hits: number;
  size: number;
  expires: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  items: number;
  hitRate: number;
}

export class CacheManager extends EventEmitter {
  private cache = new Map<string, CacheEntry<any>>();
  private accessOrder: string[] = [];
  private hitCount = new Map<string, number>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  
  private readonly options: Required<CacheOptions>;
  
  constructor(options: CacheOptions = {}) {
    super();
    this.options = {
      ttl: options.ttl || 300000, // 5 minutes default
      maxSize: options.maxSize || 100 * 1024 * 1024, // 100MB default
      strategy: options.strategy || 'LRU',
      persistent: options.persistent || false
    };
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get item from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.emit('miss', key);
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expires) {
      this.delete(key);
      this.stats.misses++;
      this.emit('expired', key);
      return null;
    }
    
    // Update statistics
    this.stats.hits++;
    entry.hits++;
    this.hitCount.set(key, (this.hitCount.get(key) || 0) + 1);
    
    // Update access order for LRU
    if (this.options.strategy === 'LRU') {
      this.updateAccessOrder(key);
    }
    
    this.emit('hit', key);
    return entry.value;
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const size = this.calculateSize(value);
    const expires = Date.now() + (ttl || this.options.ttl);
    
    // Check if we need to evict items
    if (this.getCurrentSize() + size > this.options.maxSize) {
      this.evict(size);
    }
    
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
      size,
      expires
    };
    
    this.cache.set(key, entry);
    this.accessOrder.push(key);
    
    this.emit('set', key, value);
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.hitCount.delete(key);
      this.emit('delete', key);
    }
    return deleted;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hitCount.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    this.emit('clear');
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? Date.now() <= entry.expires : false;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      size: this.getCurrentSize(),
      items: this.cache.size,
      hitRate: Math.round(hitRate)
    };
  }

  /**
   * Create cache key from multiple parts
   */
  createKey(...parts: any[]): string {
    const combined = parts.map(p => JSON.stringify(p)).join(':');
    return createHash('md5').update(combined).digest('hex');
  }

  /**
   * Batch get multiple items
   */
  mget<T>(keys: string[]): Map<string, T | null> {
    const results = new Map<string, T | null>();
    keys.forEach(key => {
      results.set(key, this.get<T>(key));
    });
    return results;
  }

  /**
   * Batch set multiple items
   */
  mset<T>(items: Array<{ key: string; value: T; ttl?: number }>): void {
    items.forEach(item => {
      this.set(item.key, item.value, item.ttl);
    });
  }

  /**
   * Cache decorator for async functions
   */
  wrap<T>(
    fn: (...args: any[]) => Promise<T>,
    keyGenerator?: (...args: any[]) => string,
    ttl?: number
  ): (...args: any[]) => Promise<T> {
    return async (...args: any[]): Promise<T> => {
      const key = keyGenerator ? keyGenerator(...args) : this.createKey(fn.name, ...args);
      
      // Check cache first
      const cached = this.get<T>(key);
      if (cached !== null) {
        return cached;
      }
      
      // Execute function and cache result
      const result = await fn(...args);
      this.set(key, result, ttl);
      
      return result;
    };
  }

  /**
   * Evict items based on strategy
   */
  private evict(requiredSize: number): void {
    let freedSize = 0;
    const toEvict: string[] = [];
    
    if (this.options.strategy === 'LRU') {
      // Evict least recently used
      for (const key of this.accessOrder) {
        const entry = this.cache.get(key);
        if (entry) {
          toEvict.push(key);
          freedSize += entry.size;
          if (freedSize >= requiredSize) break;
        }
      }
    } else if (this.options.strategy === 'LFU') {
      // Evict least frequently used
      const sorted = Array.from(this.cache.entries())
        .sort((a, b) => a[1].hits - b[1].hits);
      
      for (const [key, entry] of sorted) {
        toEvict.push(key);
        freedSize += entry.size;
        if (freedSize >= requiredSize) break;
      }
    } else {
      // FIFO - evict oldest
      const sorted = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      for (const [key, entry] of sorted) {
        toEvict.push(key);
        freedSize += entry.size;
        if (freedSize >= requiredSize) break;
      }
    }
    
    // Perform evictions
    toEvict.forEach(key => {
      this.delete(key);
      this.stats.evictions++;
      this.emit('evict', key);
    });
  }

  /**
   * Update access order for LRU
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Calculate size of value
   */
  private calculateSize(value: any): number {
    const str = JSON.stringify(value);
    return Buffer.byteLength(str, 'utf8');
  }

  /**
   * Get current cache size
   */
  private getCurrentSize(): number {
    let size = 0;
    this.cache.forEach(entry => {
      size += entry.size;
    });
    return size;
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      const now = Date.now();
      const expired: string[] = [];
      
      this.cache.forEach((entry, key) => {
        if (now > entry.expires) {
          expired.push(key);
        }
      });
      
      expired.forEach(key => this.delete(key));
      
      if (expired.length > 0) {
        this.emit('cleanup', expired.length);
      }
    }, 60000); // Run every minute
  }

  /**
   * Warmup cache with preloaded data
   */
  async warmup(
    loader: () => Promise<Array<{ key: string; value: any; ttl?: number }>>
  ): Promise<void> {
    const items = await loader();
    this.mset(items);
    this.emit('warmup', items.length);
  }

  /**
   * Get cache entries matching pattern
   */
  keys(pattern?: string): string[] {
    const keys = Array.from(this.cache.keys());
    
    if (!pattern) return keys;
    
    // Simple wildcard pattern matching
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }
}

/**
 * Multi-tier cache with memory and disk layers
 */
export class MultiTierCache extends CacheManager {
  private l2Cache = new Map<string, any>();
  private readonly l2MaxSize: number;
  
  constructor(options: CacheOptions & { l2MaxSize?: number } = {}) {
    super(options);
    this.l2MaxSize = options.l2MaxSize || 500 * 1024 * 1024; // 500MB for L2
  }
  
  async getAsync<T>(key: string): Promise<T | null> {
    // Check L1 (memory) cache first
    let value = super.get<T>(key);
    if (value !== null) return value;
    
    // Check L2 cache
    value = this.l2Cache.get(key);
    if (value !== null) {
      // Promote to L1
      super.set(key, value);
      return value;
    }
    
    return null;
  }
  
  set<T>(key: string, value: T, ttl?: number): void {
    super.set(key, value, ttl);
    
    // Also store in L2
    this.l2Cache.set(key, value);
    
    // Manage L2 size
    if (this.l2Cache.size > this.l2MaxSize / 1000) {
      const toDelete = Array.from(this.l2Cache.keys()).slice(0, 100);
      toDelete.forEach(k => this.l2Cache.delete(k));
    }
  }
}