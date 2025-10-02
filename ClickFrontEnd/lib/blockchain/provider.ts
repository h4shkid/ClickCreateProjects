import { ethers } from 'ethers';

export interface ProviderConfig {
  alchemyApiKey?: string;
  quickNodeEndpoint?: string;
  chainId?: number;
}

export class ProviderManager {
  private primaryProvider: ethers.JsonRpcProvider | null = null;
  private fallbackProvider: ethers.JsonRpcProvider | null = null;
  private currentProvider: ethers.JsonRpcProvider | null = null;
  private config: ProviderConfig;
  private failoverActive = false;
  private retryCount = 0;
  private maxRetries = 3;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Initialize providers
   */
  async initialize(): Promise<void> {
    console.log('🔌 Initializing RPC providers...');
    
    // Initialize QuickNode provider (primary - more reliable)
    if (this.config.quickNodeEndpoint && this.config.quickNodeEndpoint !== 'https://your-quicknode-endpoint.com') {
      try {
        this.primaryProvider = new ethers.JsonRpcProvider(this.config.quickNodeEndpoint);
        
        // Test connection with timeout
        const blockPromise = this.primaryProvider.getBlockNumber();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        );
        
        const blockNumber = await Promise.race([blockPromise, timeoutPromise]) as number;
        console.log('✅ QuickNode provider connected. Current block:', blockNumber);
        
        this.currentProvider = this.primaryProvider;
      } catch (error: any) {
        console.error('❌ Failed to connect to QuickNode:', error.message);
      }
    }

    // Initialize Alchemy provider (fallback)
    if (this.config.alchemyApiKey && this.config.alchemyApiKey !== 'your_alchemy_api_key_here' && !this.currentProvider) {
      try {
        const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${this.config.alchemyApiKey}`;
        this.fallbackProvider = new ethers.JsonRpcProvider(alchemyUrl);
        
        // Test connection with timeout
        const blockPromise = this.fallbackProvider.getBlockNumber();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        );
        
        const blockNumber = await Promise.race([blockPromise, timeoutPromise]) as number;
        console.log('✅ Alchemy provider connected. Current block:', blockNumber);
        
        if (!this.currentProvider) {
          this.currentProvider = this.fallbackProvider;
        }
      } catch (error: any) {
        console.error('❌ Failed to connect to Alchemy:', error.message);
      }
    }

    // Fallback to public provider if both fail
    if (!this.currentProvider) {
      console.log('⚠️ Using default Ethereum provider (rate limited)');
      // Use ethers' default provider which aggregates multiple public RPCs
      this.currentProvider = ethers.getDefaultProvider('mainnet') as ethers.JsonRpcProvider;
      
      // Test connection
      const blockNumber = await this.currentProvider.getBlockNumber();
      console.log('✅ Public provider connected. Current block:', blockNumber);
    }
  }

  /**
   * Get current provider with automatic failover
   */
  async getProvider(): Promise<ethers.JsonRpcProvider> {
    if (!this.currentProvider) {
      await this.initialize();
    }
    
    if (!this.currentProvider) {
      throw new Error('No RPC provider available');
    }

    return this.currentProvider;
  }

  /**
   * Switch to fallback provider
   */
  private async switchProvider(): Promise<void> {
    if (this.failoverActive) {
      return; // Already in failover mode
    }

    console.log('⚠️ Switching to fallback provider...');
    this.failoverActive = true;

    if (this.currentProvider === this.primaryProvider && this.fallbackProvider) {
      this.currentProvider = this.fallbackProvider;
      console.log('✅ Switched to QuickNode provider');
    } else if (this.fallbackProvider) {
      this.currentProvider = this.fallbackProvider;
      console.log('✅ Switched to fallback provider');
    } else {
      // Use public provider as last resort
      this.currentProvider = new ethers.JsonRpcProvider('https://rpc.ankr.com/eth');
      console.log('✅ Switched to public provider');
    }

    // Try to restore primary after delay
    setTimeout(() => this.tryRestorePrimary(), 60000); // Try after 1 minute
  }

  /**
   * Try to restore primary provider
   */
  private async tryRestorePrimary(): Promise<void> {
    if (!this.primaryProvider) return;

    try {
      await this.primaryProvider.getBlockNumber();
      this.currentProvider = this.primaryProvider;
      this.failoverActive = false;
      this.retryCount = 0;
      console.log('✅ Restored primary provider');
    } catch (error) {
      // Primary still down, try again later
      setTimeout(() => this.tryRestorePrimary(), 120000); // Try after 2 minutes
    }
  }

  /**
   * Execute a provider call with retry logic
   */
  async executeWithRetry<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>): Promise<T> {
    let lastError: any;
    
    for (let i = 0; i <= this.maxRetries; i++) {
      try {
        const provider = await this.getProvider();
        return await fn(provider);
      } catch (error: any) {
        lastError = error;
        console.error(`Provider call failed (attempt ${i + 1}/${this.maxRetries + 1}):`, error.message);
        
        // Check if we should switch providers
        if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR' || error.code === -32603) {
          await this.switchProvider();
        }
        
        // Exponential backoff
        if (i < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, i), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Get network information
   */
  async getNetworkInfo(): Promise<{
    chainId: number;
    name: string;
    blockNumber: number;
  }> {
    const provider = await this.getProvider();
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    return {
      chainId: Number(network.chainId),
      name: network.name,
      blockNumber
    };
  }

  /**
   * Get provider statistics
   */
  getStats(): {
    primaryConnected: boolean;
    fallbackConnected: boolean;
    currentProvider: string;
    failoverActive: boolean;
    retryCount: number;
  } {
    return {
      primaryConnected: this.primaryProvider !== null,
      fallbackConnected: this.fallbackProvider !== null,
      currentProvider: this.currentProvider === this.primaryProvider ? 'Alchemy' : 
                      this.currentProvider === this.fallbackProvider ? 'QuickNode' : 'Public',
      failoverActive: this.failoverActive,
      retryCount: this.retryCount
    };
  }
}

// Singleton instance
let providerManager: ProviderManager | null = null;

export function getProviderManager(): ProviderManager {
  if (!providerManager) {
    providerManager = new ProviderManager({
      alchemyApiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
      quickNodeEndpoint: process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT,
      chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1')
    });
  }
  return providerManager;
}

export async function getProvider(): Promise<ethers.JsonRpcProvider> {
  const manager = getProviderManager();
  await manager.initialize();
  return manager.getProvider();
}