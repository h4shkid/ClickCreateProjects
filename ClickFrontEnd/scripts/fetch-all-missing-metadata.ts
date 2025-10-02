import { ethers } from 'ethers';
import Database from 'better-sqlite3';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;

// ERC-1155 ABI for metadata
const ERC1155_ABI = [
  'function uri(uint256 id) view returns (string)'
];

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

async function initDatabase() {
  const dbPath = path.resolve('./data/nft-snapshot.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

async function fetchTokenURI(tokenId: string, provider: ethers.Provider): Promise<string | null> {
  try {
    const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_ABI, provider);
    const uri = await contract.uri(tokenId);
    
    // Replace {id} placeholder with actual token ID (hex padded to 64 chars)
    const hexId = BigInt(tokenId).toString(16).padStart(64, '0');
    const finalUri = uri.replace('{id}', hexId);
    
    return finalUri;
  } catch (error) {
    console.error(`Error fetching URI for token ${tokenId}:`, error);
    return null;
  }
}

async function fetchMetadataFromURI(uri: string): Promise<NFTMetadata | null> {
  try {
    // Handle IPFS URLs
    let finalUrl = uri;
    if (uri.startsWith('ipfs://')) {
      // Use public IPFS gateway
      finalUrl = uri.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    console.log(`Fetching metadata from: ${finalUrl}`);
    const response = await axios.get(finalUrl, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NFT-Metadata-Fetcher/1.0)'
      }
    });
    
    const metadata = response.data;
    
    // Convert IPFS image URLs to HTTP
    if (metadata.image && metadata.image.startsWith('ipfs://')) {
      metadata.image = metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    return metadata;
  } catch (error: any) {
    console.error(`Error fetching metadata from URI:`, error.message);
    return null;
  }
}

async function fetchFromOpenSea(tokenId: string): Promise<NFTMetadata | null> {
  if (!OPENSEA_API_KEY) {
    return null;
  }
  
  try {
    const url = `https://api.opensea.io/api/v2/chain/ethereum/contract/${CONTRACT_ADDRESS}/nfts/${tokenId}`;
    
    const response = await axios.get(url, {
      headers: {
        'X-API-KEY': OPENSEA_API_KEY,
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    const data = response.data.nft;
    
    return {
      name: data.name || `Token #${tokenId}`,
      description: data.description,
      image: data.image_url || data.display_image_url,
      attributes: data.traits?.map((trait: any) => ({
        trait_type: trait.trait_type,
        value: trait.value
      })) || []
    };
  } catch (error: any) {
    console.error(`OpenSea error for token ${tokenId}:`, error.message);
    return null;
  }
}

async function saveMetadata(db: Database.Database, tokenId: string, metadata: NFTMetadata) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO nft_metadata (
      token_id, name, description, image_url, attributes, 
      fetched_at, last_updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    tokenId,
    metadata.name || `Token #${tokenId.substring(0, 8)}`,
    metadata.description || '',
    metadata.image || '',
    JSON.stringify(metadata.attributes || []),
    new Date().toISOString(),
    new Date().toISOString()
  );
}

async function main() {
  console.log('🔍 Starting metadata fetch for all missing tokens...\n');
  
  // Initialize database
  const db = await initDatabase();
  
  // Get all tokens without metadata
  const missingTokens = db.prepare(`
    SELECT DISTINCT token_id 
    FROM current_state 
    WHERE token_id NOT IN (SELECT token_id FROM nft_metadata)
    ORDER BY CAST(token_id AS INTEGER)
  `).all() as any[];
  
  console.log(`📊 Found ${missingTokens.length} tokens without metadata\n`);
  
  if (missingTokens.length === 0) {
    console.log('✅ All tokens already have metadata!');
    return;
  }
  
  // Initialize provider
  const provider = new ethers.JsonRpcProvider(
    `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
  );
  
  let successCount = 0;
  let failedCount = 0;
  
  // Process tokens in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < missingTokens.length; i += batchSize) {
    const batch = missingTokens.slice(i, Math.min(i + batchSize, missingTokens.length));
    
    console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(missingTokens.length/batchSize)}`);
    
    await Promise.all(batch.map(async (row) => {
      const tokenId = row.token_id;
      console.log(`\n🎨 Fetching metadata for token ${tokenId}...`);
      
      let metadata: NFTMetadata | null = null;
      
      // Try fetching from contract URI first
      const uri = await fetchTokenURI(tokenId, provider);
      if (uri) {
        console.log(`  📝 Token URI: ${uri.substring(0, 50)}...`);
        metadata = await fetchMetadataFromURI(uri);
      }
      
      // Fallback to OpenSea if contract fetch failed
      if (!metadata && OPENSEA_API_KEY) {
        console.log(`  🌊 Trying OpenSea API...`);
        metadata = await fetchFromOpenSea(tokenId);
      }
      
      // Save whatever metadata we got (even if partial)
      if (metadata) {
        await saveMetadata(db, tokenId, metadata);
        console.log(`  ✅ Saved metadata for token ${tokenId}`);
        if (metadata.name) console.log(`     Name: ${metadata.name}`);
        if (metadata.image) console.log(`     Image: ${metadata.image.substring(0, 50)}...`);
        successCount++;
      } else {
        // Save minimal metadata to prevent repeated failures
        await saveMetadata(db, tokenId, {
          name: `Token #${tokenId}`,
          description: `ERC-1155 Token ID: ${tokenId}`,
          attributes: []
        });
        console.log(`  ⚠️ No metadata found, saved placeholder for token ${tokenId}`);
        failedCount++;
      }
    }));
    
    // Rate limit between batches
    if (i + batchSize < missingTokens.length) {
      console.log('\n⏳ Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Metadata Fetch Complete!');
  console.log('='.repeat(50));
  console.log(`✅ Successfully fetched: ${successCount} tokens`);
  console.log(`⚠️ Placeholders created: ${failedCount} tokens`);
  
  // Show summary of metadata in database
  const summary = db.prepare(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN image_url != '' THEN 1 END) as with_images,
      COUNT(CASE WHEN name NOT LIKE 'Token #%' THEN 1 END) as with_names
    FROM nft_metadata
  `).get() as any;
  
  console.log(`\n📈 Database Summary:`);
  console.log(`   Total metadata records: ${summary.total}`);
  console.log(`   Tokens with images: ${summary.with_images}`);
  console.log(`   Tokens with proper names: ${summary.with_names}`);
  
  db.close();
}

// Run the script
main().catch(console.error);