import { MetadataFetcher } from '../lib/metadata/metadata-fetcher';
import { getDatabase } from '../lib/database/init';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fetchAllMetadata() {
  console.log('🚀 Starting metadata fetch for all tokens...\n');
  
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';
  console.log(`📄 Contract: ${contractAddress}`);
  
  try {
    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();
    
    // Get unique token IDs from database
    const tokenStmt = db.prepare(`
      SELECT DISTINCT token_id 
      FROM current_state 
      WHERE balance > 0
      ORDER BY CAST(token_id AS INTEGER)
      LIMIT 20
    `);
    
    const tokens = tokenStmt.all() as any[];
    console.log(`📊 Found ${tokens.length} unique tokens with holders\n`);
    
    if (tokens.length === 0) {
      console.log('❌ No tokens found in database. Please run sync first.');
      return;
    }
    
    // Initialize metadata fetcher
    const fetcher = new MetadataFetcher();
    
    // Fetch metadata for each token
    let successCount = 0;
    let failedCount = 0;
    const batchSize = 5; // Process in small batches
    
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const tokenIds = batch.map(t => t.token_id);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tokens.length/batchSize)}`);
      console.log(`   Token IDs: ${tokenIds.map(id => id.substring(0, 10) + '...').join(', ')}`);
      
      // Fetch metadata for batch
      const metadataMap = await fetcher.fetchBatchMetadata(
        contractAddress,
        tokenIds,
        3 // Concurrency
      );
      
      // Log results
      for (const [tokenId, metadata] of metadataMap.entries()) {
        if (metadata) {
          successCount++;
          console.log(`   ✅ ${tokenId.substring(0, 10)}... - ${metadata.name || 'Unnamed'}`);
          if (metadata.imageUrl) {
            console.log(`      🖼️ Image: ${metadata.imageUrl.substring(0, 50)}...`);
          }
        } else {
          failedCount++;
          console.log(`   ❌ ${tokenId.substring(0, 10)}... - Failed to fetch`);
        }
      }
      
      // Rate limiting between batches
      if (i + batchSize < tokens.length) {
        console.log('   ⏳ Waiting before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Get statistics
    const stats = fetcher.getStats();
    
    console.log('\n📊 Metadata Fetch Complete!');
    console.log('============================');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`💾 Total in DB: ${stats.totalMetadata}`);
    console.log(`🖼️ With Images: ${stats.metadataWithImages}`);
    console.log(`🏷️ With Attributes: ${stats.metadataWithAttributes}`);
    
    // Show some sample metadata
    const samples = db.prepare(`
      SELECT token_id, name, description, image_url
      FROM nft_metadata
      WHERE image_url IS NOT NULL
      LIMIT 5
    `).all() as any[];
    
    if (samples.length > 0) {
      console.log('\n📸 Sample Tokens with Images:');
      console.log('==============================');
      for (const sample of samples) {
        console.log(`\nToken: ${sample.token_id.substring(0, 20)}...`);
        console.log(`Name: ${sample.name || 'Unnamed'}`);
        console.log(`Description: ${sample.description?.substring(0, 100) || 'No description'}...`);
        console.log(`Image: ${sample.image_url?.substring(0, 80) || 'No image'}...`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error fetching metadata:', error);
  }
}

// Run the script
fetchAllMetadata()
  .then(() => {
    console.log('\n✨ Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });