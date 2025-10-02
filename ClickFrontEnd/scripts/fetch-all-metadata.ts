import { MetadataFetcher } from '../lib/metadata/metadata-fetcher';
import { getDatabase } from '../lib/database/init';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fetchAllTokenMetadata() {
  console.log('🚀 Fetching metadata for ALL tokens in database...\n');
  
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';
  console.log(`📄 Contract: ${contractAddress}`);
  
  try {
    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();
    
    // Get ALL unique token IDs from database
    const tokenStmt = db.prepare(`
      SELECT DISTINCT token_id 
      FROM current_state 
      WHERE balance > 0
      ORDER BY CAST(token_id AS INTEGER)
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
    const batchSize = 5;
    
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const tokenIds = batch.map(t => t.token_id);
      
      console.log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(tokens.length/batchSize)}`);
      console.log(`   Token IDs: ${tokenIds.map(id => id.length > 10 ? id.substring(0, 10) + '...' : id).join(', ')}`);
      
      // Fetch metadata for batch
      const metadataMap = await fetcher.fetchBatchMetadata(
        contractAddress,
        tokenIds,
        3
      );
      
      // Log results
      for (const [tokenId, metadata] of metadataMap.entries()) {
        if (metadata) {
          successCount++;
          const name = metadata.name || 'Unnamed';
          const shortName = name.length > 30 ? name.substring(0, 30) + '...' : name;
          console.log(`   ✅ ${tokenId.substring(0, 10)}... - ${shortName}`);
        } else {
          failedCount++;
          console.log(`   ❌ ${tokenId.substring(0, 10)}... - No metadata found`);
        }
      }
      
      // Rate limiting between batches
      if (i + batchSize < tokens.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Get statistics
    const stats = fetcher.getStats();
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 METADATA FETCH COMPLETE!');
    console.log('='.repeat(50));
    console.log(`✅ Successful: ${successCount}/${tokens.length}`);
    console.log(`❌ Failed: ${failedCount}/${tokens.length}`);
    console.log(`💾 Total in DB: ${stats.totalMetadata}`);
    console.log(`🖼️ With Images: ${stats.metadataWithImages}`);
    console.log(`🏷️ With Attributes: ${stats.metadataWithAttributes}`);
    console.log(`📈 Success Rate: ${((successCount/tokens.length) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
fetchAllTokenMetadata()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });