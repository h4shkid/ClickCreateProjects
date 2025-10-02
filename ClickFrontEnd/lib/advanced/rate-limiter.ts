import { EventEmitter } from 'events';

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  strategy?: 'sliding' | 'fixed' | 'token-bucket';
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (context: any) => string;
}

export interface QueueOptions {
  maxSize?: number;
  maxWaitTime?: number;
  priority?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

/**
 * Rate Limiter implementation
 */
export class RateLimiter extends EventEmitter {
  private requests = new Map<string, number[]>();
  private tokenBuckets = new Map<string, { tokens: number; lastRefill: number }>();
  private readonly options: Required<RateLimitOptions>;
  
  constructor(options: RateLimitOptions = {}) {
    super();
    this.options = {
      windowMs: options.windowMs || 60000, // 1 minute
      maxRequests: options.maxRequests || 100,
      strategy: options.strategy || 'sliding',
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || true,
      keyGenerator: options.keyGenerator || (() => 'global')
    };
    
    // Cleanup old entries periodically
    setInterval(() => this.cleanup(), this.options.windowMs);
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(context: any = {}): Promise<RateLimitInfo> {
    const key = this.options.keyGenerator(context);
    
    switch (this.options.strategy) {
      case 'sliding':
        return this.checkSlidingWindow(key);
      case 'fixed':
        return this.checkFixedWindow(key);
      case 'token-bucket':
        return this.checkTokenBucket(key);
      default:
        return this.checkSlidingWindow(key);
    }
  }

  /**
   * Sliding window rate limiting
   */
  private checkSlidingWindow(key: string): RateLimitInfo {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    // Get or create request history
    let requestTimes = this.requests.get(key) || [];
    
    // Remove old requests outside window
    requestTimes = requestTimes.filter(time => time > windowStart);
    
    const info: RateLimitInfo = {
      limit: this.options.maxRequests,
      remaining: Math.max(0, this.options.maxRequests - requestTimes.length),
      resetTime: new Date(now + this.options.windowMs)
    };
    
    if (requestTimes.length >= this.options.maxRequests) {
      const oldestRequest = Math.min(...requestTimes);
      info.retryAfter = Math.ceil((oldestRequest + this.options.windowMs - now) / 1000);
      
      this.emit('limited', { key, info });
      throw new Error(`Rate limit exceeded. Retry after ${info.retryAfter} seconds`);
    }
    
    // Add current request
    requestTimes.push(now);
    this.requests.set(key, requestTimes);
    
    this.emit('request', { key, info });
    return info;
  }

  /**
   * Fixed window rate limiting
   */
  private checkFixedWindow(key: string): RateLimitInfo {
    const now = Date.now();
    const windowKey = `${key}:${Math.floor(now / this.options.windowMs)}`;
    
    const count = (this.requests.get(windowKey) as any) || 0;
    
    const info: RateLimitInfo = {
      limit: this.options.maxRequests,
      remaining: Math.max(0, this.options.maxRequests - count),
      resetTime: new Date(Math.ceil(now / this.options.windowMs) * this.options.windowMs)
    };
    
    if (count >= this.options.maxRequests) {
      info.retryAfter = Math.ceil((info.resetTime.getTime() - now) / 1000);
      
      this.emit('limited', { key, info });
      throw new Error(`Rate limit exceeded. Retry after ${info.retryAfter} seconds`);
    }
    
    this.requests.set(windowKey, count + 1);
    
    this.emit('request', { key, info });
    return info;
  }

  /**
   * Token bucket rate limiting
   */
  private checkTokenBucket(key: string): RateLimitInfo {
    const now = Date.now();
    let bucket = this.tokenBuckets.get(key);
    
    if (!bucket) {
      bucket = {
        tokens: this.options.maxRequests,
        lastRefill: now
      };
    }
    
    // Refill tokens based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / this.options.windowMs) * this.options.maxRequests;
    bucket.tokens = Math.min(this.options.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    const info: RateLimitInfo = {
      limit: this.options.maxRequests,
      remaining: Math.floor(bucket.tokens),
      resetTime: new Date(now + this.options.windowMs)
    };
    
    if (bucket.tokens < 1) {
      const timeToNextToken = (1 - bucket.tokens) * (this.options.windowMs / this.options.maxRequests);
      info.retryAfter = Math.ceil(timeToNextToken / 1000);
      
      this.emit('limited', { key, info });
      throw new Error(`Rate limit exceeded. Retry after ${info.retryAfter} seconds`);
    }
    
    bucket.tokens -= 1;
    this.tokenBuckets.set(key, bucket);
    
    this.emit('request', { key, info });
    return info;
  }

  /**
   * Reset limits for a specific key
   */
  reset(key?: string): void {
    if (key) {
      this.requests.delete(key);
      this.tokenBuckets.delete(key);
    } else {
      this.requests.clear();
      this.tokenBuckets.clear();
    }
    
    this.emit('reset', key);
  }

  /**
   * Cleanup old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    // Clean sliding window entries
    this.requests.forEach((times, key) => {
      if (key.includes(':')) return; // Skip fixed window keys
      
      const filtered = times.filter(time => time > windowStart);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    });
    
    // Clean fixed window entries
    const currentWindow = Math.floor(now / this.options.windowMs);
    this.requests.forEach((_, key) => {
      if (!key.includes(':')) return;
      
      const [, window] = key.split(':');
      if (parseInt(window) < currentWindow - 1) {
        this.requests.delete(key);
      }
    });
  }

  /**
   * Get current stats
   */
  getStats(): {
    activeKeys: number;
    totalRequests: number;
    strategy: string;
  } {
    let totalRequests = 0;
    
    this.requests.forEach((value) => {
      if (Array.isArray(value)) {
        totalRequests += value.length;
      } else {
        totalRequests += value;
      }
    });
    
    return {
      activeKeys: this.requests.size + this.tokenBuckets.size,
      totalRequests,
      strategy: this.options.strategy
    };
  }
}

/**
 * Queue Manager for handling rate-limited requests
 */
export class QueueManager extends EventEmitter {
  private queue: Array<{
    id: string;
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    priority: number;
    attempts: number;
    addedAt: number;
  }> = [];
  
  private processing = false;
  private readonly options: Required<QueueOptions>;
  private readonly rateLimiter?: RateLimiter;
  
  constructor(options: QueueOptions = {}, rateLimiter?: RateLimiter) {
    super();
    this.options = {
      maxSize: options.maxSize || 1000,
      maxWaitTime: options.maxWaitTime || 30000, // 30 seconds
      priority: options.priority || false,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000
    };
    this.rateLimiter = rateLimiter;
  }

  /**
   * Add item to queue
   */
  async add<T>(
    fn: () => Promise<T>,
    priority = 0
  ): Promise<T> {
    if (this.queue.length >= this.options.maxSize) {
      throw new Error('Queue is full');
    }
    
    return new Promise((resolve, reject) => {
      const item = {
        id: this.generateId(),
        fn,
        resolve,
        reject,
        priority,
        attempts: 0,
        addedAt: Date.now()
      };
      
      this.queue.push(item);
      
      if (this.options.priority) {
        this.queue.sort((a, b) => b.priority - a.priority);
      }
      
      this.emit('itemAdded', { id: item.id, queueSize: this.queue.length });
      
      if (!this.processing) {
        this.process();
      }
    });
  }

  /**
   * Process queue
   */
  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      // Check if item has expired
      if (Date.now() - item.addedAt > this.options.maxWaitTime) {
        item.reject(new Error('Queue wait time exceeded'));
        this.emit('itemExpired', { id: item.id });
        continue;
      }
      
      try {
        // Check rate limit if configured
        if (this.rateLimiter) {
          await this.rateLimiter.checkLimit();
        }
        
        // Execute function
        const result = await item.fn();
        item.resolve(result);
        
        this.emit('itemProcessed', { id: item.id, attempts: item.attempts + 1 });
        
      } catch (error) {
        item.attempts++;
        
        if (error instanceof Error && error.message.includes('Rate limit')) {
          // Re-queue item for rate limit errors
          this.queue.unshift(item);
          
          // Wait before retrying
          const retryAfter = parseInt(error.message.match(/\d+/)?.[0] || '1');
          await this.delay(retryAfter * 1000);
          
        } else if (item.attempts < this.options.retryAttempts) {
          // Retry with delay
          await this.delay(this.options.retryDelay * item.attempts);
          this.queue.unshift(item);
          
          this.emit('itemRetry', { id: item.id, attempts: item.attempts });
          
        } else {
          // Max retries reached
          item.reject(error);
          
          this.emit('itemFailed', { id: item.id, error });
        }
      }
    }
    
    this.processing = false;
    this.emit('queueEmpty');
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    
    this.queue = [];
    this.emit('queueCleared');
  }

  /**
   * Get queue status
   */
  getStatus(): {
    size: number;
    processing: boolean;
    oldestItem?: number;
  } {
    return {
      size: this.queue.length,
      processing: this.processing,
      oldestItem: this.queue[0]?.addedAt
    };
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * API Rate Limiter with multiple strategies
 */
export class APIRateLimiter {
  private limiters = new Map<string, RateLimiter>();
  private queues = new Map<string, QueueManager>();
  
  /**
   * Configure rate limiter for an endpoint
   */
  configure(
    endpoint: string,
    options: RateLimitOptions & QueueOptions
  ): void {
    const limiter = new RateLimiter(options);
    const queue = new QueueManager(options, limiter);
    
    this.limiters.set(endpoint, limiter);
    this.queues.set(endpoint, queue);
  }

  /**
   * Execute rate-limited request
   */
  async execute<T>(
    endpoint: string,
    fn: () => Promise<T>,
    priority = 0
  ): Promise<T> {
    const queue = this.queues.get(endpoint);
    
    if (!queue) {
      // No rate limiting configured
      return fn();
    }
    
    return queue.add(fn, priority);
  }

  /**
   * Get limiter for endpoint
   */
  getLimiter(endpoint: string): RateLimiter | undefined {
    return this.limiters.get(endpoint);
  }

  /**
   * Get queue for endpoint
   */
  getQueue(endpoint: string): QueueManager | undefined {
    return this.queues.get(endpoint);
  }

  /**
   * Reset all limiters
   */
  resetAll(): void {
    this.limiters.forEach(limiter => limiter.reset());
    this.queues.forEach(queue => queue.clear());
  }

  /**
   * Get overall stats
   */
  getStats(): Map<string, any> {
    const stats = new Map();
    
    this.limiters.forEach((limiter, endpoint) => {
      const queue = this.queues.get(endpoint);
      stats.set(endpoint, {
        limiter: limiter.getStats(),
        queue: queue?.getStatus()
      });
    });
    
    return stats;
  }
}