import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { getDatabase } from '../database/init';
import Database from 'better-sqlite3';

export interface BatchJob<T> {
  id: string;
  data: T;
  priority: number;
  retries: number;
  maxRetries: number;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface BatchResult<T, R> {
  job: BatchJob<T>;
  result?: R;
  error?: Error;
  duration: number;
}

export interface BatchProcessorOptions {
  batchSize?: number;
  concurrency?: number;
  retryDelay?: number;
  maxRetries?: number;
  processingTimeout?: number;
  priorityQueue?: boolean;
}

export class BatchProcessor<T, R> extends EventEmitter {
  private queue: BatchJob<T>[] = [];
  private processing = new Set<string>();
  private completed = new Map<string, BatchResult<T, R>>();
  private isProcessing = false;
  protected db: Database.Database;
  
  private readonly options: Required<BatchProcessorOptions>;
  
  constructor(options: BatchProcessorOptions = {}) {
    super();
    this.options = {
      batchSize: options.batchSize || 100,
      concurrency: options.concurrency || 5,
      retryDelay: options.retryDelay || 1000,
      maxRetries: options.maxRetries || 3,
      processingTimeout: options.processingTimeout || 30000,
      priorityQueue: options.priorityQueue || false
    };
    
    const dbManager = getDatabase();
    this.db = dbManager.getDb();
  }

  /**
   * Add job to queue
   */
  addJob(data: T, priority = 0): string {
    const job: BatchJob<T> = {
      id: this.generateId(),
      data,
      priority,
      retries: 0,
      maxRetries: this.options.maxRetries,
      createdAt: new Date(),
      status: 'pending'
    };
    
    this.queue.push(job);
    
    if (this.options.priorityQueue) {
      this.queue.sort((a, b) => b.priority - a.priority);
    }
    
    this.emit('jobAdded', job);
    
    // Auto-start processing if not running
    if (!this.isProcessing) {
      this.startProcessing();
    }
    
    return job.id;
  }

  /**
   * Add multiple jobs
   */
  addJobs(items: T[], priority = 0): string[] {
    return items.map(item => this.addJob(item, priority));
  }

  /**
   * Process queue
   */
  async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.emit('processingStarted');
    
    while (this.queue.length > 0 || this.processing.size > 0) {
      // Get next batch
      const batch = this.getNextBatch();
      
      if (batch.length === 0 && this.processing.size > 0) {
        // Wait for current processing to complete
        await this.delay(100);
        continue;
      }
      
      if (batch.length === 0) break;
      
      // Process batch concurrently
      await this.processBatch(batch);
    }
    
    this.isProcessing = false;
    this.emit('processingCompleted', this.getStats());
  }

  /**
   * Stop processing
   */
  stopProcessing(): void {
    this.isProcessing = false;
    this.emit('processingStopped');
  }

  /**
   * Process a batch of jobs
   */
  private async processBatch(batch: BatchJob<T>[]): Promise<void> {
    const promises = batch.map(job => this.processJob(job));
    await Promise.allSettled(promises);
  }

  /**
   * Process individual job
   */
  private async processJob(job: BatchJob<T>): Promise<void> {
    const startTime = Date.now();
    job.status = 'processing';
    this.processing.add(job.id);
    
    this.emit('jobStarted', job);
    
    try {
      // Apply timeout
      const result = await this.withTimeout(
        this.processFunction(job.data),
        this.options.processingTimeout
      );
      
      job.status = 'completed';
      job.processedAt = new Date();
      
      const batchResult: BatchResult<T, R> = {
        job,
        result,
        duration: Date.now() - startTime
      };
      
      this.completed.set(job.id, batchResult);
      this.emit('jobCompleted', batchResult);
      
    } catch (error) {
      job.retries++;
      
      if (job.retries < job.maxRetries) {
        // Retry job
        job.status = 'pending';
        await this.delay(this.options.retryDelay * job.retries);
        this.queue.unshift(job);
        this.emit('jobRetry', job);
      } else {
        // Job failed
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
        
        const batchResult: BatchResult<T, R> = {
          job,
          error: error instanceof Error ? error : new Error(String(error)),
          duration: Date.now() - startTime
        };
        
        this.completed.set(job.id, batchResult);
        this.emit('jobFailed', batchResult);
      }
    } finally {
      this.processing.delete(job.id);
    }
  }

  /**
   * Process function to be implemented by subclass
   */
  protected async processFunction(data: T): Promise<R> {
    throw new Error('processFunction must be implemented');
  }

  /**
   * Get next batch of jobs
   */
  private getNextBatch(): BatchJob<T>[] {
    const availableSlots = this.options.concurrency - this.processing.size;
    if (availableSlots <= 0) return [];
    
    const batchSize = Math.min(availableSlots, this.options.batchSize);
    return this.queue.splice(0, batchSize);
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    totalJobs: number;
    averageDuration: number;
  } {
    const completedJobs = Array.from(this.completed.values());
    const successfulJobs = completedJobs.filter(r => !r.error);
    const failedJobs = completedJobs.filter(r => r.error);
    
    const averageDuration = successfulJobs.length > 0
      ? successfulJobs.reduce((sum, r) => sum + r.duration, 0) / successfulJobs.length
      : 0;
    
    return {
      pending: this.queue.length,
      processing: this.processing.size,
      completed: successfulJobs.length,
      failed: failedJobs.length,
      totalJobs: this.queue.length + this.processing.size + completedJobs.length,
      averageDuration: Math.round(averageDuration)
    };
  }

  /**
   * Get job result
   */
  getResult(jobId: string): BatchResult<T, R> | undefined {
    return this.completed.get(jobId);
  }

  /**
   * Clear completed jobs
   */
  clearCompleted(): void {
    this.completed.clear();
    this.emit('completedCleared');
  }

  /**
   * Helper functions
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Processing timeout')), timeout)
      )
    ]);
  }
}

/**
 * NFT Metadata Batch Processor
 */
export class NFTMetadataBatchProcessor extends BatchProcessor<string, any> {
  protected async processFunction(tokenId: string): Promise<any> {
    // Simulate metadata fetching
    return {
      tokenId,
      name: `NFT #${tokenId}`,
      description: `Description for NFT #${tokenId}`,
      image: `https://placeholder.com/nft/${tokenId}.png`,
      attributes: [
        { trait_type: 'Rarity', value: 'Common' },
        { trait_type: 'Level', value: Math.floor(Math.random() * 100) }
      ]
    };
  }
}

/**
 * Event Processing Batch Processor
 */
export class EventBatchProcessor extends BatchProcessor<any, void> {
  protected async processFunction(event: any): Promise<void> {
    // Process blockchain event
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO events (
        transaction_hash,
        block_number,
        block_timestamp,
        from_address,
        to_address,
        token_id,
        amount,
        event_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      event.transactionHash,
      event.blockNumber,
      event.timestamp,
      event.from,
      event.to,
      event.tokenId,
      event.amount,
      event.eventType
    );
  }
}

/**
 * Snapshot Generation Batch Processor
 */
export class SnapshotBatchProcessor extends BatchProcessor<
  { address: string; tokenId: string },
  { address: string; balance: string }
> {
  protected async processFunction(data: { address: string; tokenId: string }): Promise<{
    address: string;
    balance: string;
  }> {
    // Calculate balance for address
    const result = this.db.prepare(`
      SELECT 
        ? as address,
        COALESCE(SUM(
          CASE 
            WHEN to_address = ? THEN CAST(amount AS INTEGER)
            WHEN from_address = ? THEN -CAST(amount AS INTEGER)
            ELSE 0
          END
        ), 0) as balance
      FROM events
      WHERE token_id = ? AND (to_address = ? OR from_address = ?)
    `).get(
      data.address,
      data.address,
      data.address,
      data.tokenId,
      data.address,
      data.address
    ) as any;
    
    return {
      address: data.address,
      balance: result.balance.toString()
    };
  }
}

/**
 * Parallel batch processor for CPU-intensive tasks
 */
export class ParallelBatchProcessor<T, R> extends BatchProcessor<T, R> {
  private workers: Worker[] = [];
  
  constructor(
    workerPath: string,
    workerCount: number,
    options: BatchProcessorOptions = {}
  ) {
    super(options);
    
    // Initialize worker pool
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(workerPath);
      this.workers.push(worker);
    }
  }
  
  protected async processFunction(data: T): Promise<R> {
    // Get available worker
    const worker = this.workers[Math.floor(Math.random() * this.workers.length)];
    
    return new Promise((resolve, reject) => {
      worker.once('message', resolve);
      worker.once('error', reject);
      worker.postMessage(data);
    });
  }
  
  cleanup(): void {
    this.workers.forEach(worker => worker.terminate());
  }
}