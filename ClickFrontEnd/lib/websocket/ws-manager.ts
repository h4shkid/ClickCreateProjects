import { WebSocket } from 'ws';
import { EventEmitter } from 'events';

export interface WebSocketConfig {
  url: string;
  apiKey?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface ConnectionStats {
  connected: boolean;
  connectionTime?: Date;
  reconnectAttempts: number;
  messagesReceived: number;
  messagesSent: number;
  lastHeartbeat?: Date;
  lastError?: string;
}

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;
  private stats: ConnectionStats;
  private messageQueue: any[] = [];
  private subscriptions = new Map<string, any>();

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      reconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config
    };
    
    this.stats = {
      connected: false,
      reconnectAttempts: 0,
      messagesReceived: 0,
      messagesSent: 0
    };
  }

  /**
   * Connect to WebSocket
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔌 Connecting to WebSocket...');
      
      try {
        // Create WebSocket connection
        const wsUrl = this.config.apiKey 
          ? this.config.url.replace('wss://', `wss://${this.config.apiKey}@`)
          : this.config.url;
        
        this.ws = new WebSocket(wsUrl);
        
        // Set up event handlers
        this.ws.on('open', () => {
          console.log('✅ WebSocket connected');
          this.handleOpen();
          resolve();
        });
        
        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });
        
        this.ws.on('error', (error) => {
          this.handleError(error);
          if (!this.stats.connected) {
            reject(error);
          }
        });
        
        this.ws.on('close', (code, reason) => {
          this.handleClose(code, reason.toString());
        });
        
        this.ws.on('ping', () => {
          this.ws?.pong();
        });
        
        this.ws.on('pong', () => {
          this.stats.lastHeartbeat = new Date();
        });
        
      } catch (error) {
        console.error('❌ WebSocket connection failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Handle connection open
   */
  private handleOpen(): void {
    this.stats.connected = true;
    this.stats.connectionTime = new Date();
    this.reconnectAttempts = 0;
    this.isIntentionallyClosed = false;
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Process queued messages
    this.processMessageQueue();
    
    // Re-establish subscriptions
    this.resubscribe();
    
    this.emit('connected');
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: any): void {
    try {
      const message = JSON.parse(data.toString());
      this.stats.messagesReceived++;
      
      // Handle different message types
      if (message.method === 'eth_subscription') {
        this.handleSubscriptionMessage(message);
      } else if (message.id && message.result) {
        this.handleResponse(message);
      } else if (message.error) {
        this.handleErrorMessage(message);
      }
      
      // Emit raw message for debugging
      this.emit('message', message);
      
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  /**
   * Handle subscription message
   */
  private handleSubscriptionMessage(message: any): void {
    const { subscription, result } = message.params;
    
    // Find subscription handler
    const handler = this.subscriptions.get(subscription);
    if (handler) {
      this.emit('subscription', {
        subscription,
        data: result
      });
      
      // Call specific handler if provided
      if (handler.callback) {
        handler.callback(result);
      }
    }
  }

  /**
   * Handle response message
   */
  private handleResponse(message: any): void {
    this.emit('response', message);
  }

  /**
   * Handle error message
   */
  private handleErrorMessage(message: any): void {
    console.error('WebSocket error message:', message.error);
    this.stats.lastError = message.error.message;
    this.emit('error', message.error);
  }

  /**
   * Handle connection error
   */
  private handleError(error: Error): void {
    console.error('❌ WebSocket error:', error.message);
    this.stats.lastError = error.message;
    this.emit('error', error);
  }

  /**
   * Handle connection close
   */
  private handleClose(code: number, reason: string): void {
    console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
    
    this.stats.connected = false;
    this.stopHeartbeat();
    
    this.emit('disconnected', { code, reason });
    
    // Attempt reconnection if not intentionally closed
    if (!this.isIntentionallyClosed && this.config.reconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 10)) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('max_reconnect_reached');
      return;
    }
    
    this.reconnectAttempts++;
    this.stats.reconnectAttempts = this.reconnectAttempts;
    
    // Exponential backoff
    const delay = Math.min(
      (this.config.reconnectInterval || 1000) * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );
    
    console.log(`⏳ Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, this.config.heartbeatInterval || 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send message
   */
  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      this.ws.send(data);
      this.stats.messagesSent++;
    } else {
      // Queue message if not connected
      this.messageQueue.push(message);
      console.log('Message queued (not connected)');
    }
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  /**
   * Subscribe to events
   */
  async subscribe(params: any, callback?: (data: any) => void): Promise<string> {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      
      const message = {
        jsonrpc: '2.0',
        id,
        method: 'eth_subscribe',
        params
      };
      
      // Store subscription info
      const subscriptionInfo = { params, callback };
      
      // Listen for response
      const responseHandler = (response: any) => {
        if (response.id === id) {
          if (response.result) {
            // Store subscription
            this.subscriptions.set(response.result, subscriptionInfo);
            console.log(`✅ Subscribed: ${response.result}`);
            resolve(response.result);
          } else if (response.error) {
            reject(new Error(response.error.message));
          }
          this.off('response', responseHandler);
        }
      };
      
      this.on('response', responseHandler);
      this.send(message);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        this.off('response', responseHandler);
        reject(new Error('Subscription timeout'));
      }, 10000);
    });
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(subscriptionId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const id = Date.now();
      
      const message = {
        jsonrpc: '2.0',
        id,
        method: 'eth_unsubscribe',
        params: [subscriptionId]
      };
      
      // Listen for response
      const responseHandler = (response: any) => {
        if (response.id === id) {
          if (response.result !== undefined) {
            // Remove subscription
            this.subscriptions.delete(subscriptionId);
            console.log(`✅ Unsubscribed: ${subscriptionId}`);
            resolve(response.result);
          } else if (response.error) {
            reject(new Error(response.error.message));
          }
          this.off('response', responseHandler);
        }
      };
      
      this.on('response', responseHandler);
      this.send(message);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        this.off('response', responseHandler);
        reject(new Error('Unsubscribe timeout'));
      }, 10000);
    });
  }

  /**
   * Re-establish subscriptions after reconnection
   */
  private async resubscribe(): Promise<void> {
    const oldSubscriptions = new Map(this.subscriptions);
    this.subscriptions.clear();
    
    for (const [_, info] of oldSubscriptions) {
      try {
        await this.subscribe(info.params, info.callback);
      } catch (error) {
        console.error('Failed to re-subscribe:', error);
      }
    }
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    console.log('Disconnecting WebSocket...');
    this.isIntentionallyClosed = true;
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.stats.connected = false;
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}