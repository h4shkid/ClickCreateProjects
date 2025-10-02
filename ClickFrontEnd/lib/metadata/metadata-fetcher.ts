import axios, { AxiosInstance } from 'axios';
import { getDatabase } from '../database/init';
import Database from 'better-sqlite3';

export interface NFTMetadata {
  tokenId: string;
  name?: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  externalUrl?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
  properties?: any;
  animation_url?: string;
  background_color?: string;
}

export interface MetadataSource {
  name: string;
  priority: number;
  fetchMetadata: (contractAddress: string, tokenId: string) => Promise<NFTMetadata | null>;
}

export class MetadataFetcher {
  private db: Database.Database;
  private alchemyClient: AxiosInstance;
  private sources: MetadataSource[] = [];
  private cache = new Map<string, NFTMetadata>();
  private rateLimitDelay = 100; // ms between requests

  constructor() {
    const dbManager = getDatabase();
    this.db = dbManager.getDb();
    
    // Initialize Alchemy client
    const alchemyApiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
    this.alchemyClient = axios.create({
      baseURL: `https://eth-mainnet.g.alchemy.com/nft/v3/${alchemyApiKey}`,
      timeout: 10000,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Set up metadata sources in priority order
    this.initializeSources();
  }

  /**
   * Initialize metadata sources
   */
  private initializeSources(): void {
    // 1. Local cache (highest priority)
    this.sources.push({
      name: 'LocalCache',
      priority: 1,
      fetchMetadata: async (contractAddress: string, tokenId: string) => {
        return this.getFromCache(contractAddress, tokenId);
      }
    });
    
    // 2. Alchemy NFT API
    this.sources.push({
      name: 'AlchemyNFT',
      priority: 2,
      fetchMetadata: async (contractAddress: string, tokenId: string) => {
        return this.fetchFromAlchemy(contractAddress, tokenId);
      }
    });
    
    // 3. OpenSea API (if API key available)
    if (process.env.OPENSEA_API_KEY) {
      this.sources.push({
        name: 'OpenSea',
        priority: 3,
        fetchMetadata: async (contractAddress: string, tokenId: string) => {
          return this.fetchFromOpenSea(contractAddress, tokenId);
        }
      });
    }
    
    // 4. Direct token URI (fallback)
    this.sources.push({
      name: 'TokenURI',
      priority: 4,
      fetchMetadata: async (contractAddress: string, tokenId: string) => {
        return this.fetchFromTokenURI(contractAddress, tokenId);
      }
    });
    
    // Sort by priority
    this.sources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Fetch metadata for a token
   */
  async fetchMetadata(
    contractAddress: string,
    tokenId: string,
    forceRefresh = false
  ): Promise<NFTMetadata | null> {
    const cacheKey = `${contractAddress}:${tokenId}`;
    
    // Check memory cache first
    if (!forceRefresh && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Try each source in priority order
    for (const source of this.sources) {
      try {
        console.log(`🔍 Trying ${source.name} for token ${tokenId.substring(0, 10)}...`);
        const metadata = await source.fetchMetadata(contractAddress, tokenId);
        
        if (metadata) {
          console.log(`✅ Found metadata via ${source.name}`);
          
          // Cache in memory
          this.cache.set(cacheKey, metadata);
          
          // Store in database
          await this.storeMetadata(contractAddress, metadata);
          
          return metadata;
        }
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error);
      }
      
      // Rate limit between attempts
      await this.delay(this.rateLimitDelay);
    }
    
    console.log(`❌ No metadata found for token ${tokenId.substring(0, 10)}...`);
    return null;
  }

  /**
   * Fetch metadata for multiple tokens
   */
  async fetchBatchMetadata(
    contractAddress: string,
    tokenIds: string[],
    concurrency = 3
  ): Promise<Map<string, NFTMetadata>> {
    const results = new Map<string, NFTMetadata>();
    
    console.log(`📦 Fetching metadata for ${tokenIds.length} tokens...`);
    
    // Process in batches to respect rate limits
    for (let i = 0; i < tokenIds.length; i += concurrency) {
      const batch = tokenIds.slice(i, i + concurrency);
      
      const promises = batch.map(async (tokenId) => {
        const metadata = await this.fetchMetadata(contractAddress, tokenId);
        if (metadata) {
          results.set(tokenId, metadata);
        }
        return metadata;
      });
      
      await Promise.all(promises);
      
      // Progress update
      const progress = Math.min(i + concurrency, tokenIds.length);
      console.log(`  Progress: ${progress}/${tokenIds.length}`);
      
      // Rate limit between batches
      if (i + concurrency < tokenIds.length) {
        await this.delay(this.rateLimitDelay * 2);
      }
    }
    
    console.log(`✅ Fetched metadata for ${results.size}/${tokenIds.length} tokens`);
    return results;
  }

  /**
   * Get metadata from cache
   */
  private async getFromCache(
    contractAddress: string,
    tokenId: string
  ): Promise<NFTMetadata | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM nft_metadata
      WHERE token_id = ?
    `);
    
    const row = stmt.get(tokenId) as any;
    
    if (row) {
      return {
        tokenId: row.token_id,
        name: row.name,
        description: row.description,
        image: row.image_url,
        imageUrl: row.image_url,
        externalUrl: row.external_url,
        attributes: row.attributes ? JSON.parse(row.attributes) : undefined
      };
    }
    
    return null;
  }

  /**
   * Fetch from Alchemy NFT API
   */
  private async fetchFromAlchemy(
    contractAddress: string,
    tokenId: string
  ): Promise<NFTMetadata | null> {
    try {
      const response = await this.alchemyClient.get('/getNFTMetadata', {
        params: {
          contractAddress,
          tokenId,
          refreshCache: false
        }
      });
      
      const data = response.data;
      
      if (data && data.metadata) {
        const metadata = data.metadata;
        
        return {
          tokenId,
          name: metadata.name || data.title,
          description: metadata.description || data.description,
          image: metadata.image || data.media?.[0]?.gateway,
          imageUrl: metadata.image || data.media?.[0]?.gateway,
          externalUrl: metadata.external_url,
          attributes: metadata.attributes,
          animation_url: metadata.animation_url
        };
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.log('⚠️ Alchemy rate limit reached, backing off...');
        await this.delay(5000);
      }
      throw error;
    }
    
    return null;
  }

  /**
   * Fetch from OpenSea API
   */
  private async fetchFromOpenSea(
    contractAddress: string,
    tokenId: string
  ): Promise<NFTMetadata | null> {
    try {
      const apiKey = process.env.OPENSEA_API_KEY;
      
      const response = await axios.get(
        `https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}/nfts/${tokenId}`,
        {
          headers: {
            'X-API-KEY': apiKey,
            'Accept': 'application/json'
          },
          timeout: 10000
        }
      );
      
      const data = response.data.nft;
      
      if (data) {
        return {
          tokenId,
          name: data.name,
          description: data.description,
          image: data.image_url || data.display_image_url,
          imageUrl: data.image_url || data.display_image_url,
          externalUrl: data.external_link,
          attributes: data.traits?.map((trait: any) => ({
            trait_type: trait.trait_type,
            value: trait.value,
            display_type: trait.display_type
          })),
          animation_url: data.animation_url,
          background_color: data.background_color
        };
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.log('⚠️ OpenSea rate limit reached');
        await this.delay(10000);
      }
      throw error;
    }
    
    return null;
  }

  /**
   * Fetch from token URI directly
   */
  private async fetchFromTokenURI(
    contractAddress: string,
    tokenId: string
  ): Promise<NFTMetadata | null> {
    try {
      // This would require calling the contract's uri() method
      // For now, returning null as this requires contract interaction
      // Could be implemented with ethers.js if needed
      return null;
    } catch (error) {
      console.error('Error fetching token URI:', error);
      return null;
    }
  }

  /**
   * Store metadata in database
   */
  private async storeMetadata(
    contractAddress: string,
    metadata: NFTMetadata
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO nft_metadata (
        token_id, name, description, image_url, external_url,
        attributes, metadata_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    stmt.run(
      metadata.tokenId,
      metadata.name || null,
      metadata.description || null,
      metadata.imageUrl || null,
      metadata.externalUrl || null,
      metadata.attributes ? JSON.stringify(metadata.attributes) : null,
      JSON.stringify(metadata)
    );
  }

  /**
   * Get all metadata from database
   */
  getAllStoredMetadata(limit = 100): NFTMetadata[] {
    const stmt = this.db.prepare(`
      SELECT * FROM nft_metadata
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(limit) as any[];
    
    return rows.map(row => ({
      tokenId: row.token_id,
      name: row.name,
      description: row.description,
      image: row.image_url,
      imageUrl: row.image_url,
      externalUrl: row.external_url,
      attributes: row.attributes ? JSON.parse(row.attributes) : undefined
    }));
  }

  /**
   * Clear metadata cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Metadata cache cleared');
  }

  /**
   * Update metadata for a token
   */
  async updateMetadata(
    contractAddress: string,
    tokenId: string
  ): Promise<NFTMetadata | null> {
    // Force refresh from external sources
    return this.fetchMetadata(contractAddress, tokenId, true);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Process IPFS URLs
   */
  processIPFSUrl(url: string): string {
    if (!url) return url;
    
    // Convert IPFS URLs to HTTP gateway URLs
    if (url.startsWith('ipfs://')) {
      const hash = url.replace('ipfs://', '');
      return `https://ipfs.io/ipfs/${hash}`;
    }
    
    // Handle Arweave URLs
    if (url.startsWith('ar://')) {
      const hash = url.replace('ar://', '');
      return `https://arweave.net/${hash}`;
    }
    
    return url;
  }

  /**
   * Get metadata statistics
   */
  getStats(): {
    totalMetadata: number;
    metadataWithImages: number;
    metadataWithAttributes: number;
    cacheSize: number;
  } {
    const total = this.db.prepare('SELECT COUNT(*) as count FROM nft_metadata').get() as any;
    const withImages = this.db.prepare('SELECT COUNT(*) as count FROM nft_metadata WHERE image_url IS NOT NULL').get() as any;
    const withAttributes = this.db.prepare('SELECT COUNT(*) as count FROM nft_metadata WHERE attributes IS NOT NULL').get() as any;
    
    return {
      totalMetadata: total.count,
      metadataWithImages: withImages.count,
      metadataWithAttributes: withAttributes.count,
      cacheSize: this.cache.size
    };
  }
}