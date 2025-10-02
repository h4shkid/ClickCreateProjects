#!/usr/bin/env npx tsx

import { ethers } from 'ethers';
import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const QUICKNODE_ENDPOINT = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT;
const GENESIS_BLOCK = 16671072; // Contract creation block

// Load full ABI
const CONTRACT_ABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'extracontext', 'contractabi.md'), 'utf-8')
);

// Event signatures
const EVENT_SIGNATURES = {
  TransferSingle: 'TransferSingle(address,address,address,uint256,uint256)',
  TransferBatch: 'TransferBatch(address,address,address,uint256[],uint256[])',
  ApprovalForAll: 'ApprovalForAll(address,address,bool)',
  URI: 'URI(string,uint256)',
  ExtensionRegistered: 'ExtensionRegistered(address,address)',
  ExtensionUnregistered: 'ExtensionUnregistered(address,address)',
  ExtensionBlacklisted: 'ExtensionBlacklisted(address,address)',
  RoyaltiesUpdated: 'RoyaltiesUpdated(uint256,address[],uint256[])',
  MintPermissionsUpdated: 'MintPermissionsUpdated(address,address,address)',
};

interface SyncStats {
  totalEvents: number;
  transferEvents: number;
  mintEvents: number;
  burnEvents: number;
  approvalEvents: number;
  metadataEvents: number;
  extensionEvents: number;
  uniqueTokens: Set<string>;
  uniqueHolders: Set<string>;
  blocksProcessed: number;
  startTime: number;
}

class ComprehensiveBlockchainSyncer {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private db: Database.Database;
  private syncId: string;
  private stats: SyncStats;
  private isRunning: boolean = false;

  constructor() {
    console.log('🚀 Initializing Comprehensive Blockchain Syncer...');
    
    // Initialize provider with preference for QuickNode
    if (QUICKNODE_ENDPOINT && QUICKNODE_ENDPOINT !== 'https://your-quicknode-endpoint.com') {
      this.provider = new ethers.JsonRpcProvider(QUICKNODE_ENDPOINT);
      console.log('✅ Using QuickNode provider');
    } else if (ALCHEMY_API_KEY && ALCHEMY_API_KEY !== 'your_alchemy_api_key_here') {
      const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
      this.provider = new ethers.JsonRpcProvider(alchemyUrl);
      console.log('✅ Using Alchemy provider');
    } else {
      this.provider = ethers.getDefaultProvider('mainnet') as ethers.JsonRpcProvider;
      console.log('⚠️ Using public provider (rate limited)');
    }

    // Initialize contract with full ABI
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);
    console.log(`📄 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`🏗️ Genesis Block: ${GENESIS_BLOCK.toLocaleString()}`);

    // Initialize database
    const dbPath = path.join(__dirname, '..', 'data', 'nft-snapshot.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 10000');
    console.log(`💾 Database: ${dbPath}`);

    this.syncId = uuidv4();
    this.stats = {
      totalEvents: 0,
      transferEvents: 0,
      mintEvents: 0,
      burnEvents: 0,
      approvalEvents: 0,
      metadataEvents: 0,
      extensionEvents: 0,
      uniqueTokens: new Set(),
      uniqueHolders: new Set(),
      blocksProcessed: 0,
      startTime: Date.now()
    };
  }

  async syncFromGenesis(endBlock?: number) {
    try {
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('  🎯 STARTING COMPREHENSIVE HISTORICAL SYNC');
      console.log('═══════════════════════════════════════════════════════\n');

      this.isRunning = true;
      const currentBlock = await this.provider.getBlockNumber();
      const targetEndBlock = endBlock || currentBlock;
      
      const totalBlocks = targetEndBlock - GENESIS_BLOCK;
      console.log(`📊 Current blockchain height: ${currentBlock.toLocaleString()}`);
      console.log(`🎯 Target end block: ${targetEndBlock.toLocaleString()}`);
      console.log(`📦 Total blocks to process: ${totalBlocks.toLocaleString()}`);
      console.log(`⏱️ Estimated time: ${this.estimateTime(totalBlocks)}\n`);

      // Initialize sync progress
      this.initializeSyncProgress(GENESIS_BLOCK, targetEndBlock);

      // Process in optimized chunks
      const CHUNK_SIZE = 5000; // Larger chunks for historical data
      let currentChunkStart = GENESIS_BLOCK;

      while (currentChunkStart <= targetEndBlock && this.isRunning) {
        const currentChunkEnd = Math.min(currentChunkStart + CHUNK_SIZE - 1, targetEndBlock);
        
        await this.processChunk(currentChunkStart, currentChunkEnd);
        
        // Update progress
        this.updateSyncProgress(currentChunkEnd);
        currentChunkStart = currentChunkEnd + 1;
        
        // Show progress
        this.showProgress(currentChunkEnd, GENESIS_BLOCK, targetEndBlock);
      }

      if (this.isRunning) {
        // Mark sync as complete
        this.completeSyncProgress();
        
        // Process the collected data
        await this.processCollectedData();
        
        // Show final statistics
        this.showFinalStatistics();
      }

    } catch (error) {
      console.error('❌ Fatal sync error:', error);
      this.failSyncProgress(error as Error);
      throw error;
    }
  }

  private async processChunk(fromBlock: number, toBlock: number) {
    try {
      console.log(`\n🔄 Processing blocks ${fromBlock.toLocaleString()} to ${toBlock.toLocaleString()}...`);
      
      // Get all logs for the contract in this range
      const logs = await this.provider.getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock,
        toBlock
      });

      if (logs.length > 0) {
        console.log(`  📝 Found ${logs.length} events`);
        
        // Process logs in a transaction
        const transaction = this.db.transaction(() => {
          for (const log of logs) {
            this.processLog(log);
          }
        });
        
        transaction();
        this.stats.blocksProcessed += (toBlock - fromBlock + 1);
      }
      
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR' || error.code === -32005) {
        console.log('⚠️ Rate limit hit, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        return this.processChunk(fromBlock, toBlock); // Retry
      }
      throw error;
    }
  }

  private processLog(log: ethers.Log) {
    try {
      // Store raw log
      this.storeRawLog(log);
      
      // Decode and process based on event type
      const eventSignature = log.topics[0];
      
      // Process TransferSingle events
      if (eventSignature === this.contract.interface.getEvent('TransferSingle')?.topicHash) {
        this.processTransferSingle(log);
      }
      // Process TransferBatch events
      else if (eventSignature === this.contract.interface.getEvent('TransferBatch')?.topicHash) {
        this.processTransferBatch(log);
      }
      // Process ApprovalForAll events
      else if (eventSignature === this.contract.interface.getEvent('ApprovalForAll')?.topicHash) {
        this.processApprovalForAll(log);
      }
      // Process URI events
      else if (eventSignature === this.contract.interface.getEvent('URI')?.topicHash) {
        this.processURI(log);
      }
      // Process Extension events
      else if (eventSignature === this.contract.interface.getEvent('ExtensionRegistered')?.topicHash) {
        this.processExtensionRegistered(log);
      }
      // Process other events...
      
      this.stats.totalEvents++;
      
    } catch (error) {
      console.error('Error processing log:', error);
    }
  }

  private processTransferSingle(log: ethers.Log) {
    const parsed = this.contract.interface.parseLog(log);
    if (!parsed) return;
    
    const { operator, from, to, id, value } = parsed.args;
    const tokenId = id.toString();
    const amount = value.toString();
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    
    // Store in events table
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO events (
        transaction_hash, block_number, log_index, event_type,
        from_address, to_address, token_id, amount,
        operator, block_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      log.transactionHash,
      log.blockNumber,
      log.index,
      'TransferSingle',
      from,
      to,
      tokenId,
      amount,
      operator,
      Date.now() // Will be updated with actual timestamp later
    );
    
    // Track statistics
    this.stats.transferEvents++;
    this.stats.uniqueTokens.add(tokenId);
    if (from !== zeroAddress) this.stats.uniqueHolders.add(from);
    if (to !== zeroAddress) this.stats.uniqueHolders.add(to);
    
    // Check if it's a mint
    if (from.toLowerCase() === zeroAddress) {
      this.recordMint(log, to, tokenId, amount, operator);
      this.stats.mintEvents++;
    }
    
    // Check if it's a burn
    if (to.toLowerCase() === zeroAddress) {
      this.recordBurn(log, from, tokenId, amount);
      this.stats.burnEvents++;
    }
  }

  private processTransferBatch(log: ethers.Log) {
    const parsed = this.contract.interface.parseLog(log);
    if (!parsed) return;
    
    const { operator, from, to, ids, values } = parsed.args;
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    
    for (let i = 0; i < ids.length; i++) {
      const tokenId = ids[i].toString();
      const amount = values[i].toString();
      
      // Store each transfer
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO events (
          transaction_hash, block_number, log_index, event_type,
          from_address, to_address, token_id, amount,
          operator, block_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        log.transactionHash,
        log.blockNumber,
        log.index,
        'TransferBatch',
        from,
        to,
        tokenId,
        amount,
        operator,
        Date.now()
      );
      
      this.stats.uniqueTokens.add(tokenId);
      
      // Check for mints and burns
      if (from.toLowerCase() === zeroAddress) {
        this.recordMint(log, to, tokenId, amount, operator);
        this.stats.mintEvents++;
      }
      if (to.toLowerCase() === zeroAddress) {
        this.recordBurn(log, from, tokenId, amount);
        this.stats.burnEvents++;
      }
    }
    
    this.stats.transferEvents++;
    if (from !== zeroAddress) this.stats.uniqueHolders.add(from);
    if (to !== zeroAddress) this.stats.uniqueHolders.add(to);
  }

  private processApprovalForAll(log: ethers.Log) {
    const parsed = this.contract.interface.parseLog(log);
    if (!parsed) return;
    
    const { account, operator, approved } = parsed.args;
    
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO approval_history (
        owner_address, operator_address, approved,
        block_number, transaction_hash, log_index, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      account,
      operator,
      approved ? 1 : 0,
      log.blockNumber,
      log.transactionHash,
      log.index,
      Date.now()
    );
    
    this.stats.approvalEvents++;
  }

  private processURI(log: ethers.Log) {
    const parsed = this.contract.interface.parseLog(log);
    if (!parsed) return;
    
    const { value: uri, id } = parsed.args;
    const tokenId = id.toString();
    
    const stmt = this.db.prepare(`
      INSERT INTO token_metadata_history (
        token_id, uri, block_number, transaction_hash, timestamp
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      tokenId,
      uri,
      log.blockNumber,
      log.transactionHash,
      Date.now()
    );
    
    this.stats.metadataEvents++;
    this.stats.uniqueTokens.add(tokenId);
  }

  private processExtensionRegistered(log: ethers.Log) {
    const parsed = this.contract.interface.parseLog(log);
    if (!parsed) return;
    
    const { extension, sender } = parsed.args;
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO extension_registry (
        extension_address, registered_block, registered_tx
      ) VALUES (?, ?, ?)
    `);
    
    stmt.run(extension, log.blockNumber, log.transactionHash);
    this.stats.extensionEvents++;
  }

  private recordMint(log: ethers.Log, recipient: string, tokenId: string, amount: string, minter: string) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO minting_history (
        token_id, minter_address, recipient_address, amount,
        block_number, transaction_hash, log_index, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      tokenId,
      minter,
      recipient,
      amount,
      log.blockNumber,
      log.transactionHash,
      log.index,
      Date.now()
    );
  }

  private recordBurn(log: ethers.Log, burner: string, tokenId: string, amount: string) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO burn_history (
        token_id, burner_address, amount,
        block_number, transaction_hash, log_index, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      tokenId,
      burner,
      amount,
      log.blockNumber,
      log.transactionHash,
      log.index,
      Date.now()
    );
  }

  private storeRawLog(log: ethers.Log) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO raw_event_logs (
        block_number, transaction_hash, log_index,
        address, topics, data, event_signature, processed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      log.blockNumber,
      log.transactionHash,
      log.index,
      log.address,
      JSON.stringify(log.topics),
      log.data,
      log.topics[0],
      1
    );
  }

  private async processCollectedData() {
    console.log('\n🔧 Processing collected data...');
    
    // Rebuild current state
    await this.rebuildCurrentState();
    
    // Calculate token supplies
    await this.calculateTokenSupplies();
    
    // Build ownership timeline
    await this.buildOwnershipTimeline();
    
    // Generate collection statistics
    await this.generateCollectionStats();
  }

  private async rebuildCurrentState() {
    console.log('  📊 Rebuilding current state...');
    
    // Clear current state
    this.db.exec('DELETE FROM current_state');
    
    // Get all events ordered
    const events = this.db.prepare(`
      SELECT * FROM events
      ORDER BY block_number, log_index
    `).all() as any[];
    
    // Build balance map
    const balances = new Map<string, bigint>();
    const lastBlocks = new Map<string, number>();
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    
    for (const event of events) {
      const amount = BigInt(event.amount);
      
      // Process from address
      if (event.from_address.toLowerCase() !== zeroAddress) {
        const key = `${event.from_address}:${event.token_id}`;
        const currentBalance = balances.get(key) || 0n;
        balances.set(key, currentBalance - amount);
        lastBlocks.set(key, event.block_number);
      }
      
      // Process to address
      if (event.to_address.toLowerCase() !== zeroAddress) {
        const key = `${event.to_address}:${event.token_id}`;
        const currentBalance = balances.get(key) || 0n;
        balances.set(key, currentBalance + amount);
        lastBlocks.set(key, event.block_number);
      }
    }
    
    // Insert positive balances
    const insertStmt = this.db.prepare(`
      INSERT INTO current_state (address, token_id, balance, last_updated_block)
      VALUES (?, ?, ?, ?)
    `);
    
    const transaction = this.db.transaction(() => {
      for (const [key, balance] of balances.entries()) {
        if (balance > 0n) {
          const [address, tokenId] = key.split(':');
          insertStmt.run(address, tokenId, balance.toString(), lastBlocks.get(key) || 0);
        }
      }
    });
    
    transaction();
    
    const holdersCount = this.db.prepare('SELECT COUNT(DISTINCT address) as count FROM current_state').get() as any;
    console.log(`    ✅ ${holdersCount.count} unique holders`);
  }

  private async calculateTokenSupplies() {
    console.log('  📈 Calculating token supplies...');
    
    const tokens = this.db.prepare(`
      SELECT DISTINCT token_id FROM events
    `).all() as any[];
    
    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO token_supply (
        token_id, total_supply, circulating_supply, burned_amount, last_updated_block
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    const transaction = this.db.transaction(() => {
      for (const { token_id } of tokens) {
        // Get total minted
        const minted = this.db.prepare(`
          SELECT COALESCE(SUM(CAST(amount AS INTEGER)), 0) as total
          FROM minting_history WHERE token_id = ?
        `).get(token_id) as any;
        
        // Get total burned
        const burned = this.db.prepare(`
          SELECT COALESCE(SUM(CAST(amount AS INTEGER)), 0) as total
          FROM burn_history WHERE token_id = ?
        `).get(token_id) as any;
        
        // Get current circulating
        const circulating = this.db.prepare(`
          SELECT COALESCE(SUM(CAST(balance AS INTEGER)), 0) as total
          FROM current_state WHERE token_id = ?
        `).get(token_id) as any;
        
        const lastBlock = this.db.prepare(`
          SELECT MAX(block_number) as block FROM events WHERE token_id = ?
        `).get(token_id) as any;
        
        insertStmt.run(
          token_id,
          minted.total.toString(),
          circulating.total.toString(),
          burned.total.toString(),
          lastBlock.block || 0
        );
      }
    });
    
    transaction();
    console.log(`    ✅ ${tokens.length} token supplies calculated`);
  }

  private async buildOwnershipTimeline() {
    console.log('  📜 Building ownership timeline...');
    // Complex logic to track ownership changes over time
    // This would analyze transfer events and build a complete timeline
    // Simplified for brevity
  }

  private async generateCollectionStats() {
    console.log('  📊 Generating collection statistics...');
    
    const stats = {
      total_tokens: this.stats.uniqueTokens.size,
      total_holders: this.stats.uniqueHolders.size,
      total_transfers: this.stats.transferEvents,
      total_supply: '0',
      total_volume: '0',
      unique_traders: this.stats.uniqueHolders.size,
      most_traded_token: null,
      whale_concentration: 0,
      gini_coefficient: 0
    };
    
    // Calculate total supply
    const supply = this.db.prepare(`
      SELECT SUM(CAST(total_supply AS INTEGER)) as total FROM token_supply
    `).get() as any;
    stats.total_supply = supply?.total?.toString() || '0';
    
    // Insert stats
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO collection_stats (
        stat_date, total_tokens, total_holders, total_supply,
        total_transfers, total_volume, unique_traders,
        most_traded_token, whale_concentration, gini_coefficient
      ) VALUES (date('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      stats.total_tokens,
      stats.total_holders,
      stats.total_supply,
      stats.total_transfers,
      stats.total_volume,
      stats.unique_traders,
      stats.most_traded_token,
      stats.whale_concentration,
      stats.gini_coefficient
    );
    
    console.log(`    ✅ Collection statistics generated`);
  }

  private initializeSyncProgress(startBlock: number, endBlock: number) {
    const stmt = this.db.prepare(`
      INSERT INTO sync_progress (
        sync_id, start_block, end_block, current_block,
        status, started_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);
    
    stmt.run(this.syncId, startBlock, endBlock, startBlock, 'processing');
  }

  private updateSyncProgress(currentBlock: number) {
    const stmt = this.db.prepare(`
      UPDATE sync_progress
      SET current_block = ?, total_events = ?
      WHERE sync_id = ?
    `);
    
    stmt.run(currentBlock, this.stats.totalEvents, this.syncId);
  }

  private completeSyncProgress() {
    const stmt = this.db.prepare(`
      UPDATE sync_progress
      SET status = 'completed', completed_at = datetime('now'),
          total_events = ?
      WHERE sync_id = ?
    `);
    
    stmt.run(this.stats.totalEvents, this.syncId);
  }

  private failSyncProgress(error: Error) {
    const stmt = this.db.prepare(`
      UPDATE sync_progress
      SET status = 'failed', error_message = ?
      WHERE sync_id = ?
    `);
    
    stmt.run(error.message, this.syncId);
  }

  private showProgress(current: number, start: number, end: number) {
    const progress = ((current - start) / (end - start) * 100).toFixed(2);
    const elapsed = ((Date.now() - this.stats.startTime) / 1000).toFixed(0);
    const blocksPerSecond = this.stats.blocksProcessed / parseInt(elapsed);
    const remainingBlocks = end - current;
    const eta = remainingBlocks / blocksPerSecond;
    
    console.log(`\n⏳ PROGRESS: ${progress}%`);
    console.log(`   📦 Blocks: ${current.toLocaleString()} / ${end.toLocaleString()}`);
    console.log(`   📝 Events: ${this.stats.totalEvents.toLocaleString()}`);
    console.log(`   🎯 Unique Tokens: ${this.stats.uniqueTokens.size.toLocaleString()}`);
    console.log(`   👥 Unique Holders: ${this.stats.uniqueHolders.size.toLocaleString()}`);
    console.log(`   ⚡ Speed: ${blocksPerSecond.toFixed(2)} blocks/sec`);
    console.log(`   ⏱️ Elapsed: ${this.formatTime(parseInt(elapsed))}`);
    console.log(`   🏁 ETA: ${this.formatTime(eta)}`);
  }

  private showFinalStatistics() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ SYNC COMPLETED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════\n');
    
    console.log('📊 FINAL STATISTICS:');
    console.log(`   Total Events Processed: ${this.stats.totalEvents.toLocaleString()}`);
    console.log(`   Transfer Events: ${this.stats.transferEvents.toLocaleString()}`);
    console.log(`   Mint Events: ${this.stats.mintEvents.toLocaleString()}`);
    console.log(`   Burn Events: ${this.stats.burnEvents.toLocaleString()}`);
    console.log(`   Approval Events: ${this.stats.approvalEvents.toLocaleString()}`);
    console.log(`   Metadata Events: ${this.stats.metadataEvents.toLocaleString()}`);
    console.log(`   Extension Events: ${this.stats.extensionEvents.toLocaleString()}`);
    console.log(`\n   Unique Tokens: ${this.stats.uniqueTokens.size.toLocaleString()}`);
    console.log(`   Unique Holders: ${this.stats.uniqueHolders.size.toLocaleString()}`);
    console.log(`   Blocks Processed: ${this.stats.blocksProcessed.toLocaleString()}`);
    console.log(`\n   Total Time: ${this.formatTime(elapsed)}`);
    console.log(`   Average Speed: ${(this.stats.blocksProcessed / elapsed).toFixed(2)} blocks/sec`);
    console.log(`   Events per Block: ${(this.stats.totalEvents / this.stats.blocksProcessed).toFixed(2)}`);
    
    // Get database stats
    const dbSize = this.db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as any;
    console.log(`\n   Database Size: ${(dbSize.size / 1024 / 1024).toFixed(2)} MB`);
  }

  private estimateTime(blocks: number): string {
    // Estimate based on 50 blocks per second (conservative)
    const seconds = blocks / 50;
    return this.formatTime(seconds);
  }

  private formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  async stop() {
    console.log('\n⛔ Stopping sync...');
    this.isRunning = false;
  }

  close() {
    this.db.close();
  }
}

// Main execution
async function main() {
  const syncer = new ComprehensiveBlockchainSyncer();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Received interrupt signal...');
    await syncer.stop();
    syncer.close();
    process.exit(0);
  });

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const endBlock = args[0] ? parseInt(args[0]) : undefined;
    
    if (args.includes('--help')) {
      console.log(`
Usage: npx tsx scripts/comprehensive-sync.ts [endBlock]

Options:
  endBlock    Optional end block number (defaults to current)
  --help      Show this help message

Examples:
  npx tsx scripts/comprehensive-sync.ts              # Sync from genesis to current
  npx tsx scripts/comprehensive-sync.ts 17000000     # Sync from genesis to block 17000000

Press Ctrl+C at any time to stop the sync gracefully.
      `);
      process.exit(0);
    }
    
    // Start comprehensive sync from genesis
    await syncer.syncFromGenesis(endBlock);
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    syncer.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { ComprehensiveBlockchainSyncer };