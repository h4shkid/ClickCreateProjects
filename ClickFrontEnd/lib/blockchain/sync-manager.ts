import { ethers } from 'ethers';
import { getProvider } from './provider';
import { EventProcessor } from '../processing/event-processor';
import { getDatabase } from '../database/init';
import { ERC1155_ABI } from './contracts/erc1155';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';

export interface SyncResult {
  blocksScanned: number;
  eventsFound: number;
  fromBlock: number;
  toBlock: number;
  duration: number;
}

export class SyncManager {
  private provider: ethers.JsonRpcProvider | null = null;
  private contract: ethers.Contract | null = null;
  private eventProcessor: EventProcessor;

  constructor() {
    this.eventProcessor = new EventProcessor();
  }

  private async ensureInitialized() {
    if (!this.provider) {
      this.provider = await getProvider();
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_ABI, this.provider);
    }
  }

  /**
   * Check for and sync missing blocks since last sync
   */
  async syncMissingBlocks(): Promise<SyncResult | null> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      
      // Get current blockchain height
      const currentBlock = await this.provider!.getBlockNumber();
      
      // Get last synced block from database
      const syncStatus = this.eventProcessor.getSyncStatus(CONTRACT_ADDRESS);
      const lastSyncedBlock = syncStatus?.lastSyncedBlock || 0;
      
      // If we're already synced, skip
      if (lastSyncedBlock >= currentBlock - 1) {
        console.log('✅ Already up to date');
        return null;
      }
      
      const fromBlock = lastSyncedBlock + 1;
      const toBlock = currentBlock;
      const blocksToScan = toBlock - fromBlock + 1;
      
      console.log(`🔄 Syncing missing blocks: ${fromBlock} to ${toBlock} (${blocksToScan} blocks)`);
      
      // Update status to syncing
      this.eventProcessor.updateSyncStatus(CONTRACT_ADDRESS, lastSyncedBlock, 'syncing');
      
      // Process blocks in chunks
      const CHUNK_SIZE = 1000;
      let totalEvents = 0;
      let currentChunkStart = fromBlock;
      
      while (currentChunkStart <= toBlock) {
        const currentChunkEnd = Math.min(currentChunkStart + CHUNK_SIZE - 1, toBlock);
        
        // Fetch events for this chunk
        const events = await this.fetchEvents(currentChunkStart, currentChunkEnd);
        totalEvents += events.length;
        
        if (events.length > 0) {
          // Process events into database
          await this.eventProcessor.processEvents(events);
        }
        
        // Update sync status after each chunk
        this.eventProcessor.updateSyncStatus(CONTRACT_ADDRESS, currentChunkEnd, 'syncing');
        
        currentChunkStart = currentChunkEnd + 1;
      }
      
      // Mark as fully synced
      this.eventProcessor.updateSyncStatus(CONTRACT_ADDRESS, toBlock, 'synced');
      
      const duration = Date.now() - startTime;
      
      const result: SyncResult = {
        blocksScanned: blocksToScan,
        eventsFound: totalEvents,
        fromBlock,
        toBlock,
        duration
      };
      
      console.log(`✅ Sync complete: ${totalEvents} events found in ${blocksToScan} blocks (${duration}ms)`);
      
      return result;
      
    } catch (error) {
      console.error('❌ Sync error:', error);
      this.eventProcessor.updateSyncStatus(
        CONTRACT_ADDRESS, 
        0, 
        'error', 
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Fetch events from blockchain for given block range
   */
  private async fetchEvents(fromBlock: number, toBlock: number): Promise<any[]> {
    await this.ensureInitialized();
    const events: any[] = [];
    
    // Fetch TransferSingle events
    const singleEvents = await this.contract!.queryFilter(
      this.contract!.filters.TransferSingle(),
      fromBlock,
      toBlock
    );
    
    // Fetch TransferBatch events
    const batchEvents = await this.contract!.queryFilter(
      this.contract!.filters.TransferBatch(),
      fromBlock,
      toBlock
    );
    
    // Process single transfer events
    for (const event of singleEvents) {
      if (!(event as any).args) continue;
      
      const block = await event.getBlock();
      
      events.push({
        blockNumber: event.blockNumber,
        blockTimestamp: block.timestamp,
        transactionHash: event.transactionHash,
        logIndex: (event as any).index,
        eventType: 'TransferSingle',
        operator: (event as any).args.operator,
        from: (event as any).args.from,
        to: (event as any).args.to,
        tokenId: (event as any).args.id.toString(),
        amount: (event as any).args.value.toString()
      });
    }
    
    // Process batch transfer events
    for (const event of batchEvents) {
      if (!(event as any).args) continue;
      
      const block = await event.getBlock();
      const eventArgs = (event as any).args;
      const ids = eventArgs.ids;
      const values = eventArgs.values;
      
      for (let i = 0; i < ids.length; i++) {
        events.push({
          blockNumber: event.blockNumber,
          blockTimestamp: block.timestamp,
          transactionHash: event.transactionHash,
          logIndex: (event as any).index,
          eventType: 'TransferBatch',
          operator: eventArgs.operator,
          from: eventArgs.from,
          to: eventArgs.to,
          tokenId: ids[i].toString(),
          amount: values[i].toString()
        });
      }
    }
    
    return events;
  }

  /**
   * Get current sync status
   */
  getSyncStatus(): {
    lastSyncedBlock: number;
    currentBlock?: number;
    blocksBehing?: number;
    isSynced: boolean;
  } {
    const syncStatus = this.eventProcessor.getSyncStatus(CONTRACT_ADDRESS);
    
    if (!syncStatus) {
      return {
        lastSyncedBlock: 0,
        isSynced: false
      };
    }
    
    return {
      lastSyncedBlock: syncStatus.lastSyncedBlock,
      isSynced: syncStatus.status === 'synced'
    };
  }

  /**
   * Quick check if we need to sync (doesn't hit blockchain)
   */
  async needsSync(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      const currentBlock = await this.provider!.getBlockNumber();
      const syncStatus = this.eventProcessor.getSyncStatus(CONTRACT_ADDRESS);
      const lastSyncedBlock = syncStatus?.lastSyncedBlock || 0;
      
      // Consider needing sync if we're more than 5 blocks behind
      return currentBlock - lastSyncedBlock > 5;
    } catch (error) {
      console.error('Error checking sync status:', error);
      return true; // Assume we need sync if we can't check
    }
  }
}