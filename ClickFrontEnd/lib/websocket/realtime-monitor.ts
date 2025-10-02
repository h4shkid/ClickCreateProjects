import { WebSocketManager } from './ws-manager';
import { EventProcessor } from '../processing/event-processor';
import { TransferEvent } from '../blockchain/contracts/erc1155';
import { EventEmitter } from 'events';
import { ethers } from 'ethers';

export interface RealtimeConfig {
  wsUrl: string;
  contractAddress: string;
  tokenIds?: string[]; // Optional: filter for specific tokens
  fromBlock?: string; // Start monitoring from this block
}

export interface RealtimeStats {
  connected: boolean;
  monitoring: boolean;
  eventsReceived: number;
  eventsProcessed: number;
  lastEventTime?: Date;
  currentBlock?: number;
  subscriptions: string[];
}

export class RealtimeMonitor extends EventEmitter {
  private wsManager: WebSocketManager;
  private eventProcessor: EventProcessor;
  private config: RealtimeConfig;
  private stats: RealtimeStats;
  private subscriptionIds: string[] = [];
  private isMonitoring = false;

  constructor(config: RealtimeConfig) {
    super();
    this.config = config;
    this.wsManager = new WebSocketManager({ url: config.wsUrl });
    this.eventProcessor = new EventProcessor();
    
    this.stats = {
      connected: false,
      monitoring: false,
      eventsReceived: 0,
      eventsProcessed: 0,
      subscriptions: []
    };
    
    this.setupEventHandlers();
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    // Connection events
    this.wsManager.on('connected', () => {
      console.log('🟢 WebSocket connected');
      this.stats.connected = true;
      this.emit('connected');
    });
    
    this.wsManager.on('disconnected', (info) => {
      console.log('🔴 WebSocket disconnected:', info);
      this.stats.connected = false;
      this.stats.monitoring = false;
      this.emit('disconnected', info);
    });
    
    this.wsManager.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
    
    // Subscription events
    this.wsManager.on('subscription', async (data) => {
      await this.handleSubscriptionData(data);
    });
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    console.log('🚀 Starting real-time monitor...');
    
    try {
      // Connect to WebSocket
      await this.wsManager.connect();
      
      // Subscribe to new blocks (for tracking)
      await this.subscribeToNewBlocks();
      
      // Subscribe to contract logs
      await this.subscribeToContractLogs();
      
      // Subscribe to pending transactions (optional)
      // await this.subscribeToPendingTransactions();
      
      this.isMonitoring = true;
      this.stats.monitoring = true;
      
      console.log('✅ Real-time monitoring started');
      this.emit('monitoring_started');
      
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      throw error;
    }
  }

  /**
   * Subscribe to new blocks
   */
  private async subscribeToNewBlocks(): Promise<void> {
    try {
      const subscriptionId = await this.wsManager.subscribe(
        ['newHeads'],
        (data) => {
          this.stats.currentBlock = parseInt(data.number, 16);
          this.emit('new_block', {
            number: this.stats.currentBlock,
            hash: data.hash,
            timestamp: parseInt(data.timestamp, 16)
          });
        }
      );
      
      this.subscriptionIds.push(subscriptionId);
      this.stats.subscriptions.push('newHeads');
      console.log('📦 Subscribed to new blocks');
      
    } catch (error) {
      console.error('Failed to subscribe to new blocks:', error);
    }
  }

  /**
   * Subscribe to contract logs
   */
  private async subscribeToContractLogs(): Promise<void> {
    try {
      // ERC-1155 TransferSingle event signature
      const transferSingleTopic = ethers.id('TransferSingle(address,address,address,uint256,uint256)');
      
      // ERC-1155 TransferBatch event signature
      const transferBatchTopic = ethers.id('TransferBatch(address,address,address,uint256[],uint256[])');
      
      // Subscribe to TransferSingle events
      const singleSubId = await this.wsManager.subscribe(
        ['logs', {
          address: this.config.contractAddress,
          topics: [transferSingleTopic],
          fromBlock: this.config.fromBlock
        }],
        (log) => this.handleTransferSingleLog(log)
      );
      
      this.subscriptionIds.push(singleSubId);
      this.stats.subscriptions.push('TransferSingle');
      console.log('📝 Subscribed to TransferSingle events');
      
      // Subscribe to TransferBatch events
      const batchSubId = await this.wsManager.subscribe(
        ['logs', {
          address: this.config.contractAddress,
          topics: [transferBatchTopic],
          fromBlock: this.config.fromBlock
        }],
        (log) => this.handleTransferBatchLog(log)
      );
      
      this.subscriptionIds.push(batchSubId);
      this.stats.subscriptions.push('TransferBatch');
      console.log('📝 Subscribed to TransferBatch events');
      
    } catch (error) {
      console.error('Failed to subscribe to contract logs:', error);
      throw error;
    }
  }

  /**
   * Handle subscription data
   */
  private async handleSubscriptionData(data: any): Promise<void> {
    // This is called for all subscription messages
    // Specific handlers are called via callbacks in subscribe()
  }

  /**
   * Handle TransferSingle log
   */
  private async handleTransferSingleLog(log: any): Promise<void> {
    try {
      this.stats.eventsReceived++;
      this.stats.lastEventTime = new Date();
      
      // Parse the log
      const event = this.parseTransferSingleLog(log);
      
      // Filter by token ID if specified
      if (this.config.tokenIds && !this.config.tokenIds.includes(event.tokenId)) {
        return;
      }
      
      console.log(`🔄 TransferSingle: ${event.from.slice(0, 6)}...${event.from.slice(-4)} → ${event.to.slice(0, 6)}...${event.to.slice(-4)} | Token: ${event.tokenId.slice(0, 10)}... | Amount: ${event.amount}`);
      
      // Process and store the event
      await this.processEvent(event);
      
      // Emit event for listeners
      this.emit('transfer', event);
      
    } catch (error) {
      console.error('Error handling TransferSingle log:', error);
    }
  }

  /**
   * Handle TransferBatch log
   */
  private async handleTransferBatchLog(log: any): Promise<void> {
    try {
      this.stats.eventsReceived++;
      this.stats.lastEventTime = new Date();
      
      // Parse the log
      const events = this.parseTransferBatchLog(log);
      
      for (const event of events) {
        // Filter by token ID if specified
        if (this.config.tokenIds && !this.config.tokenIds.includes(event.tokenId)) {
          continue;
        }
        
        console.log(`🔄 TransferBatch: ${event.from.slice(0, 6)}...${event.from.slice(-4)} → ${event.to.slice(0, 6)}...${event.to.slice(-4)} | Token: ${event.tokenId.slice(0, 10)}... | Amount: ${event.amount}`);
        
        // Process and store the event
        await this.processEvent(event);
        
        // Emit event for listeners
        this.emit('transfer', event);
      }
      
    } catch (error) {
      console.error('Error handling TransferBatch log:', error);
    }
  }

  /**
   * Parse TransferSingle log
   */
  private parseTransferSingleLog(log: any): TransferEvent {
    // Decode the topics and data
    const operator = ethers.getAddress('0x' + log.topics[1].slice(26));
    const from = ethers.getAddress('0x' + log.topics[2].slice(26));
    const to = ethers.getAddress('0x' + log.topics[3].slice(26));
    
    // Decode data (tokenId and amount)
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256', 'uint256'],
      log.data
    );
    
    return {
      operator,
      from,
      to,
      tokenId: decoded[0].toString(),
      amount: decoded[1].toString(),
      blockNumber: parseInt(log.blockNumber, 16),
      blockTimestamp: Date.now() / 1000, // Will be updated when block is fetched
      transactionHash: log.transactionHash,
      logIndex: parseInt(log.logIndex, 16),
      eventType: 'TransferSingle'
    };
  }

  /**
   * Parse TransferBatch log
   */
  private parseTransferBatchLog(log: any): TransferEvent[] {
    // Decode the topics
    const operator = ethers.getAddress('0x' + log.topics[1].slice(26));
    const from = ethers.getAddress('0x' + log.topics[2].slice(26));
    const to = ethers.getAddress('0x' + log.topics[3].slice(26));
    
    // Decode data (tokenIds and amounts arrays)
    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
      ['uint256[]', 'uint256[]'],
      log.data
    );
    
    const events: TransferEvent[] = [];
    const tokenIds = decoded[0];
    const amounts = decoded[1];
    
    for (let i = 0; i < tokenIds.length; i++) {
      events.push({
        operator,
        from,
        to,
        tokenId: tokenIds[i].toString(),
        amount: amounts[i].toString(),
        blockNumber: parseInt(log.blockNumber, 16),
        blockTimestamp: Date.now() / 1000,
        transactionHash: log.transactionHash,
        logIndex: parseInt(log.logIndex, 16),
        eventType: 'TransferBatch'
      });
    }
    
    return events;
  }

  /**
   * Process and store event
   */
  private async processEvent(event: TransferEvent): Promise<void> {
    try {
      // Store in database and update state
      const result = await this.eventProcessor.processEvents([event]);
      
      if (result.eventsProcessed > 0) {
        this.stats.eventsProcessed++;
        
        // Emit state update
        this.emit('state_updated', {
          event,
          stateUpdates: result.stateUpdates
        });
      }
      
    } catch (error) {
      console.error('Error processing event:', error);
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping real-time monitor...');
    
    try {
      // Unsubscribe from all subscriptions
      for (const subId of this.subscriptionIds) {
        try {
          await this.wsManager.unsubscribe(subId);
        } catch (error) {
          console.error(`Failed to unsubscribe ${subId}:`, error);
        }
      }
      
      this.subscriptionIds = [];
      this.stats.subscriptions = [];
      
      // Disconnect WebSocket
      this.wsManager.disconnect();
      
      this.isMonitoring = false;
      this.stats.monitoring = false;
      
      console.log('✅ Real-time monitoring stopped');
      this.emit('monitoring_stopped');
      
    } catch (error) {
      console.error('Error stopping monitor:', error);
      throw error;
    }
  }

  /**
   * Get monitoring statistics
   */
  getStats(): RealtimeStats {
    return {
      ...this.stats,
      ...this.wsManager.getStats()
    };
  }

  /**
   * Check if monitoring
   */
  isActive(): boolean {
    return this.isMonitoring && this.wsManager.isConnected();
  }

  /**
   * Subscribe to pending transactions (optional)
   */
  private async subscribeToPendingTransactions(): Promise<void> {
    try {
      const subscriptionId = await this.wsManager.subscribe(
        ['newPendingTransactions'],
        (txHash) => {
          // Could filter for transactions to our contract
          this.emit('pending_transaction', txHash);
        }
      );
      
      this.subscriptionIds.push(subscriptionId);
      this.stats.subscriptions.push('pendingTransactions');
      console.log('⏳ Subscribed to pending transactions');
      
    } catch (error) {
      console.error('Failed to subscribe to pending transactions:', error);
    }
  }
}