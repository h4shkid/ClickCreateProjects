import { EventEmitter } from 'events';
import { TransferEvent } from '../blockchain/contracts/erc1155';

export interface BroadcastMessage {
  type: 'transfer' | 'state_update' | 'new_block' | 'connection' | 'stats';
  data: any;
  timestamp: Date;
}

export interface ClientSubscription {
  id: string;
  filters?: {
    tokenIds?: string[];
    addresses?: string[];
    eventTypes?: string[];
  };
  callback: (message: BroadcastMessage) => void;
}

export class EventBroadcaster extends EventEmitter {
  private clients = new Map<string, ClientSubscription>();
  private messageHistory: BroadcastMessage[] = [];
  private maxHistorySize = 100;
  private stats = {
    messagesbroadcasted: 0,
    activeClients: 0
  };

  constructor() {
    super();
  }

  /**
   * Register a client for receiving broadcasts
   */
  registerClient(subscription: ClientSubscription): void {
    this.clients.set(subscription.id, subscription);
    this.stats.activeClients = this.clients.size;
    
    console.log(`📡 Client registered: ${subscription.id}`);
    
    // Send recent history to new client
    this.sendHistoryToClient(subscription);
    
    // Send connection confirmation
    this.sendToClient(subscription.id, {
      type: 'connection',
      data: { 
        status: 'connected',
        clientId: subscription.id,
        historySize: this.messageHistory.length
      },
      timestamp: new Date()
    });
  }

  /**
   * Unregister a client
   */
  unregisterClient(clientId: string): void {
    if (this.clients.delete(clientId)) {
      this.stats.activeClients = this.clients.size;
      console.log(`📡 Client unregistered: ${clientId}`);
    }
  }

  /**
   * Broadcast transfer event
   */
  broadcastTransfer(event: TransferEvent): void {
    const message: BroadcastMessage = {
      type: 'transfer',
      data: {
        ...event,
        // Add human-readable data
        fromShort: `${event.from.slice(0, 6)}...${event.from.slice(-4)}`,
        toShort: `${event.to.slice(0, 6)}...${event.to.slice(-4)}`,
        tokenIdShort: event.tokenId.length > 20 
          ? `${event.tokenId.slice(0, 10)}...` 
          : event.tokenId
      },
      timestamp: new Date()
    };
    
    this.broadcast(message);
  }

  /**
   * Broadcast state update
   */
  broadcastStateUpdate(update: {
    tokenId: string;
    address: string;
    oldBalance?: string;
    newBalance: string;
    blockNumber: number;
  }): void {
    const message: BroadcastMessage = {
      type: 'state_update',
      data: update,
      timestamp: new Date()
    };
    
    this.broadcast(message);
  }

  /**
   * Broadcast new block
   */
  broadcastNewBlock(block: {
    number: number;
    hash: string;
    timestamp: number;
  }): void {
    const message: BroadcastMessage = {
      type: 'new_block',
      data: block,
      timestamp: new Date()
    };
    
    this.broadcast(message);
  }

  /**
   * Broadcast statistics update
   */
  broadcastStats(stats: any): void {
    const message: BroadcastMessage = {
      type: 'stats',
      data: stats,
      timestamp: new Date()
    };
    
    this.broadcast(message);
  }

  /**
   * Broadcast message to all clients
   */
  private broadcast(message: BroadcastMessage): void {
    // Add to history
    this.addToHistory(message);
    
    // Send to all clients based on their filters
    for (const [clientId, subscription] of this.clients) {
      if (this.shouldSendToClient(subscription, message)) {
        this.sendToClient(clientId, message);
      }
    }
    
    this.stats.messagesbroadcasted++;
    
    // Emit for internal listeners
    this.emit('broadcast', message);
  }

  /**
   * Check if message should be sent to client based on filters
   */
  private shouldSendToClient(
    subscription: ClientSubscription,
    message: BroadcastMessage
  ): boolean {
    // No filters means receive all
    if (!subscription.filters) {
      return true;
    }
    
    const filters = subscription.filters;
    
    // Filter by event type
    if (filters.eventTypes && !filters.eventTypes.includes(message.type)) {
      return false;
    }
    
    // Filter by token IDs for transfer events
    if (message.type === 'transfer' && filters.tokenIds) {
      const tokenId = message.data.tokenId;
      if (!filters.tokenIds.includes(tokenId)) {
        return false;
      }
    }
    
    // Filter by addresses for transfer events
    if (message.type === 'transfer' && filters.addresses) {
      const from = message.data.from.toLowerCase();
      const to = message.data.to.toLowerCase();
      const hasAddress = filters.addresses.some(addr => {
        const lower = addr.toLowerCase();
        return lower === from || lower === to;
      });
      if (!hasAddress) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Send message to specific client
   */
  private sendToClient(clientId: string, message: BroadcastMessage): void {
    const subscription = this.clients.get(clientId);
    if (subscription) {
      try {
        subscription.callback(message);
      } catch (error) {
        console.error(`Error sending to client ${clientId}:`, error);
        // Consider removing client if callback fails repeatedly
      }
    }
  }

  /**
   * Send history to new client
   */
  private sendHistoryToClient(subscription: ClientSubscription): void {
    const relevantHistory = this.messageHistory.filter(msg => 
      this.shouldSendToClient(subscription, msg)
    );
    
    // Send last 10 relevant messages
    const recentHistory = relevantHistory.slice(-10);
    
    for (const message of recentHistory) {
      this.sendToClient(subscription.id, message);
    }
  }

  /**
   * Add message to history
   */
  private addToHistory(message: BroadcastMessage): void {
    this.messageHistory.push(message);
    
    // Trim history if too large
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get broadcast statistics
   */
  getStats(): {
    messagesbroadcasted: number;
    activeClients: number;
    historySize: number;
  } {
    return {
      ...this.stats,
      historySize: this.messageHistory.length
    };
  }

  /**
   * Get message history
   */
  getHistory(limit?: number): BroadcastMessage[] {
    if (limit) {
      return this.messageHistory.slice(-limit);
    }
    return [...this.messageHistory];
  }

  /**
   * Clear message history
   */
  clearHistory(): void {
    this.messageHistory = [];
    console.log('📜 Message history cleared');
  }

  /**
   * Get active client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }
}