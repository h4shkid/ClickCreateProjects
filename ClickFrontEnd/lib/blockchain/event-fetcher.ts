import { ERC1155Contract, TransferEvent } from './contracts/erc1155';
import { getProviderManager } from './provider';
import { BLOCK_RANGE } from '../utils/constants';

export interface FetchProgress {
  currentBlock: number;
  totalBlocks: number;
  processedEvents: number;
  percentComplete: number;
}

export class EventFetcher {
  private contract: ERC1155Contract;
  private progressCallback?: (progress: FetchProgress) => void;
  private abortController?: AbortController;

  constructor(contractAddress: string) {
    this.contract = new ERC1155Contract(contractAddress);
  }

  /**
   * Initialize the fetcher
   */
  async initialize(): Promise<void> {
    await this.contract.initialize();
    
    // Verify it's an ERC-1155 contract
    const isERC1155 = await this.contract.isERC1155();
    if (!isERC1155) {
      throw new Error('Contract does not implement ERC-1155 interface');
    }
    
    console.log('✅ Event fetcher initialized');
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (progress: FetchProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Fetch events with chunking and retry logic
   */
  async fetchHistoricalEvents(
    startBlock: number,
    endBlock: number,
    chunkSize: number = BLOCK_RANGE.DEFAULT_CHUNK_SIZE
  ): Promise<TransferEvent[]> {
    console.log(`🔍 Fetching events from block ${startBlock} to ${endBlock}`);
    console.log(`📦 Using chunk size: ${chunkSize} blocks`);
    
    const allEvents: TransferEvent[] = [];
    const totalBlocks = endBlock - startBlock + 1;
    let currentBlock = startBlock;
    let processedEvents = 0;
    
    // Create abort controller for cancellation
    this.abortController = new AbortController();
    
    while (currentBlock <= endBlock) {
      // Check if operation was cancelled
      if (this.abortController.signal.aborted) {
        console.log('⚠️ Event fetching cancelled');
        break;
      }
      
      const toBlock = Math.min(currentBlock + chunkSize - 1, endBlock);
      
      try {
        // Fetch events for this chunk with retry
        const events = await this.fetchChunkWithRetry(currentBlock, toBlock);
        allEvents.push(...events);
        processedEvents += events.length;
        
        // Report progress
        const percentComplete = ((toBlock - startBlock + 1) / totalBlocks) * 100;
        
        if (this.progressCallback) {
          this.progressCallback({
            currentBlock: toBlock,
            totalBlocks,
            processedEvents,
            percentComplete
          });
        }
        
        console.log(
          `✅ Processed blocks ${currentBlock}-${toBlock} ` +
          `(${percentComplete.toFixed(1)}%) - Found ${events.length} events`
        );
        
        currentBlock = toBlock + 1;
        
        // Small delay to avoid rate limiting
        await this.delay(100);
        
      } catch (error: any) {
        console.error(`❌ Error fetching blocks ${currentBlock}-${toBlock}:`, error.message);
        
        // If chunk is too large, reduce size and retry
        if (chunkSize > BLOCK_RANGE.MIN_CHUNK_SIZE) {
          const newChunkSize = Math.max(
            BLOCK_RANGE.MIN_CHUNK_SIZE,
            Math.floor(chunkSize / 2)
          );
          console.log(`🔄 Reducing chunk size to ${newChunkSize} and retrying`);
          chunkSize = newChunkSize;
        } else {
          // Skip this chunk if we can't process it
          console.error(`⚠️ Skipping blocks ${currentBlock}-${toBlock}`);
          currentBlock = toBlock + 1;
        }
      }
    }
    
    console.log(`✅ Fetching complete! Total events: ${allEvents.length}`);
    return allEvents;
  }

  /**
   * Fetch a chunk with retry logic
   */
  private async fetchChunkWithRetry(
    fromBlock: number,
    toBlock: number,
    maxRetries: number = 3
  ): Promise<TransferEvent[]> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const providerManager = getProviderManager();
        return await providerManager.executeWithRetry(async () => {
          return await this.contract.queryAllTransferEvents(fromBlock, toBlock);
        });
      } catch (error: any) {
        lastError = error;
        console.warn(
          `⚠️ Attempt ${attempt}/${maxRetries} failed for blocks ${fromBlock}-${toBlock}: ${error.message}`
        );
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await this.delay(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Fetch recent events (last N blocks)
   */
  async fetchRecentEvents(blockCount: number = 1000): Promise<TransferEvent[]> {
    const providerManager = getProviderManager();
    const provider = await providerManager.getProvider();
    const currentBlock = await provider.getBlockNumber();
    const startBlock = Math.max(0, currentBlock - blockCount);
    
    return this.fetchHistoricalEvents(startBlock, currentBlock);
  }

  /**
   * Fetch events for specific token IDs
   */
  async fetchEventsForTokens(
    tokenIds: string[],
    startBlock: number,
    endBlock: number
  ): Promise<TransferEvent[]> {
    const events = await this.fetchHistoricalEvents(startBlock, endBlock);
    
    // Filter for specific token IDs
    return events.filter(event => tokenIds.includes(event.tokenId));
  }

  /**
   * Fetch events for specific address
   */
  async fetchEventsForAddress(
    address: string,
    startBlock: number,
    endBlock: number
  ): Promise<TransferEvent[]> {
    const events = await this.fetchHistoricalEvents(startBlock, endBlock);
    
    // Filter for events involving this address
    return events.filter(event => 
      event.from.toLowerCase() === address.toLowerCase() ||
      event.to.toLowerCase() === address.toLowerCase()
    );
  }

  /**
   * Cancel ongoing fetch operation
   */
  cancelFetch(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Estimate time to fetch blocks
   */
  estimateFetchTime(
    startBlock: number,
    endBlock: number,
    chunkSize: number = BLOCK_RANGE.DEFAULT_CHUNK_SIZE
  ): { chunks: number; estimatedSeconds: number } {
    const totalBlocks = endBlock - startBlock + 1;
    const chunks = Math.ceil(totalBlocks / chunkSize);
    // Estimate 0.5 seconds per chunk (including delays)
    const estimatedSeconds = chunks * 0.5;
    
    return { chunks, estimatedSeconds };
  }

  /**
   * Find optimal chunk size based on network conditions
   */
  async findOptimalChunkSize(): Promise<number> {
    console.log('🔍 Finding optimal chunk size...');
    
    const providerManager = getProviderManager();
    const provider = await providerManager.getProvider();
    const currentBlock = await provider.getBlockNumber();
    
    let chunkSize = BLOCK_RANGE.DEFAULT_CHUNK_SIZE;
    const testSizes = [5000, 2000, 1000, 500, 100];
    
    for (const size of testSizes) {
      try {
        const startBlock = currentBlock - size;
        const start = Date.now();
        
        await this.contract.queryAllTransferEvents(startBlock, currentBlock);
        
        const duration = Date.now() - start;
        
        if (duration < 5000) { // If it takes less than 5 seconds
          chunkSize = size as any;
          console.log(`✅ Optimal chunk size: ${chunkSize} blocks (${duration}ms)`);
          break;
        }
      } catch (error) {
        console.log(`❌ Chunk size ${size} failed, trying smaller...`);
      }
    }
    
    return chunkSize;
  }
}