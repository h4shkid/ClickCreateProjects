#!/usr/bin/env npx tsx

import { ethers } from 'ethers';
import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const QUICKNODE_ENDPOINT = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT;

// ERC-1155 ABI (only events we need)
const ERC1155_ABI = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
];

interface SyncProgress {
  currentBlock: number;
  targetBlock: number;
  eventsProcessed: number;
  startTime: number;
}

class BlockchainSyncer {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private db: Database.Database;
  private progress: SyncProgress;

  constructor() {
    console.log('🔌 Initializing blockchain syncer...');
    
    // Initialize provider
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

    // Initialize contract
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_ABI, this.provider);
    console.log(`📄 Contract: ${CONTRACT_ADDRESS}`);

    // Initialize database
    const dbPath = path.join(__dirname, '..', 'data', 'nft-snapshot.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    console.log(`💾 Database: ${dbPath}`);

    this.progress = {
      currentBlock: 0,
      targetBlock: 0,
      eventsProcessed: 0,
      startTime: Date.now()
    };
  }

  async sync(startBlock?: number, endBlock?: number) {
    try {
      console.log('\n🚀 Starting blockchain sync...\n');

      // Get current block number
      const currentBlockNumber = await this.provider.getBlockNumber();
      console.log(`📊 Current blockchain height: ${currentBlockNumber.toLocaleString()}`);

      // Get sync status from database
      const syncStatus = this.db.prepare(
        'SELECT last_synced_block FROM sync_status WHERE contract_address = ?'
      ).get(CONTRACT_ADDRESS) as any;

      const fromBlock = startBlock || (syncStatus?.last_synced_block || currentBlockNumber - 10000);
      const toBlock = endBlock || currentBlockNumber;

      console.log(`📈 Syncing from block ${fromBlock.toLocaleString()} to ${toBlock.toLocaleString()}`);
      console.log(`📦 Total blocks to scan: ${(toBlock - fromBlock).toLocaleString()}\n`);

      this.progress.currentBlock = fromBlock;
      this.progress.targetBlock = toBlock;

      // Process in chunks to avoid rate limits
      const CHUNK_SIZE = 1000;
      let currentChunkStart = fromBlock;

      while (currentChunkStart <= toBlock) {
        const currentChunkEnd = Math.min(currentChunkStart + CHUNK_SIZE - 1, toBlock);
        
        await this.processChunk(currentChunkStart, currentChunkEnd);
        
        // Update sync status in database
        this.db.prepare(
          'INSERT OR REPLACE INTO sync_status (contract_address, last_synced_block, status) VALUES (?, ?, ?)'
        ).run(CONTRACT_ADDRESS, currentChunkEnd, 'syncing');

        currentChunkStart = currentChunkEnd + 1;
        this.progress.currentBlock = currentChunkEnd;

        // Show progress
        const progress = ((currentChunkEnd - fromBlock) / (toBlock - fromBlock) * 100).toFixed(1);
        const elapsed = ((Date.now() - this.progress.startTime) / 1000).toFixed(0);
        console.log(`⏳ Progress: ${progress}% | Block ${currentChunkEnd.toLocaleString()} | Events: ${this.progress.eventsProcessed} | Time: ${elapsed}s`);
      }

      // Update final status
      this.db.prepare(
        'INSERT OR REPLACE INTO sync_status (contract_address, last_synced_block, status) VALUES (?, ?, ?)'
      ).run(CONTRACT_ADDRESS, toBlock, 'synced');

      console.log('\n✅ Sync completed successfully!');
      this.showStatistics();

    } catch (error) {
      console.error('❌ Sync error:', error);
      throw error;
    }
  }

  private async processChunk(fromBlock: number, toBlock: number) {
    try {
      // Fetch TransferSingle events
      const singleEvents = await this.contract.queryFilter(
        this.contract.filters.TransferSingle(),
        fromBlock,
        toBlock
      );

      // Fetch TransferBatch events
      const batchEvents = await this.contract.queryFilter(
        this.contract.filters.TransferBatch(),
        fromBlock,
        toBlock
      );

      // Process events
      const insertStmt = this.db.prepare(`
        INSERT OR IGNORE INTO events (
          transaction_hash, block_number, log_index, event_type,
          from_address, to_address, token_id, amount,
          operator, block_timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = this.db.transaction(() => {
        // Process TransferSingle events
        for (const event of singleEvents) {
          const args = event.args!;
          insertStmt.run(
            event.transactionHash,
            event.blockNumber,
            event.index,
            'TransferSingle',
            args.from,
            args.to,
            args.id.toString(),
            args.value.toString(),
            args.operator,
            Date.now()
          );
          this.progress.eventsProcessed++;
        }

        // Process TransferBatch events
        for (const event of batchEvents) {
          const args = event.args!;
          const ids = args.ids;
          const values = args.values;
          
          for (let i = 0; i < ids.length; i++) {
            insertStmt.run(
              event.transactionHash,
              event.blockNumber,
              event.index,
              'TransferBatch',
              args.from,
              args.to,
              ids[i].toString(),
              values[i].toString(),
              args.operator,
              Date.now()
            );
            this.progress.eventsProcessed++;
          }
        }
      });

      transaction();
      
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR') {
        console.log('⚠️ Network error, retrying...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.processChunk(fromBlock, toBlock);
      }
      throw error;
    }
  }

  private showStatistics() {
    const stats = {
      events: this.db.prepare('SELECT COUNT(*) as count FROM events').get() as any,
      uniqueHolders: this.db.prepare('SELECT COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) as count FROM events').get() as any,
      uniqueTokens: this.db.prepare('SELECT COUNT(DISTINCT token_id) as count FROM events').get() as any,
      transfers: this.db.prepare("SELECT COUNT(*) as count FROM events WHERE event_type = 'TransferSingle'").get() as any,
      batches: this.db.prepare("SELECT COUNT(DISTINCT transaction_hash) as count FROM events WHERE event_type = 'TransferBatch'").get() as any
    };

    console.log('\n📊 Sync Statistics:');
    console.log(`  Total Events: ${stats.events.count.toLocaleString()}`);
    console.log(`  Unique Holders: ${stats.uniqueHolders.count.toLocaleString()}`);
    console.log(`  Unique Tokens: ${stats.uniqueTokens.count.toLocaleString()}`);
    console.log(`  Single Transfers: ${stats.transfers.count.toLocaleString()}`);
    console.log(`  Batch Transfers: ${stats.batches.count.toLocaleString()}`);

    // Show sample events
    const samples = this.db.prepare(`
      SELECT from_address, to_address, token_id, amount 
      FROM events 
      ORDER BY block_number DESC 
      LIMIT 5
    `).all() as any[];

    if (samples.length > 0) {
      console.log('\n📋 Recent Transfers:');
      samples.forEach((s, i) => {
        console.log(`  ${i+1}. ${s.from_address.substring(0, 10)}... → ${s.to_address.substring(0, 10)}...`);
        console.log(`     Token: ${s.token_id.substring(0, 20)}... Amount: ${s.amount}`);
      });
    }
  }

  async rebuildState() {
    console.log('\n🔧 Rebuilding current state from events...');
    
    // Clear current state
    this.db.exec('DELETE FROM current_state');
    
    // Get all events
    const events = this.db.prepare(`
      SELECT * FROM events
      ORDER BY block_number, log_index
    `).all() as any[];
    
    console.log(`📊 Processing ${events.length} events...`);
    
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
    
    // Insert into current_state
    const insertStmt = this.db.prepare(`
      INSERT INTO current_state (address, token_id, balance, last_updated_block)
      VALUES (?, ?, ?, ?)
    `);
    
    let inserted = 0;
    let skipped = 0;
    
    const transaction = this.db.transaction(() => {
      for (const [key, balance] of balances.entries()) {
        const [address, tokenId] = key.split(':');
        const lastBlock = lastBlocks.get(key) || 0;
        
        if (balance > 0n) {
          insertStmt.run(address, tokenId, balance.toString(), lastBlock);
          inserted++;
        } else {
          skipped++;
        }
      }
    });

    transaction();
    
    console.log(`\n✅ State rebuilt successfully!`);
    console.log(`  Inserted: ${inserted} holder records`);
    console.log(`  Skipped: ${skipped} zero balances`);
  }

  close() {
    this.db.close();
  }
}

// Main execution
async function main() {
  const syncer = new BlockchainSyncer();
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const startBlock = args[0] ? parseInt(args[0]) : undefined;
    const endBlock = args[1] ? parseInt(args[1]) : undefined;

    // Sync blockchain events
    await syncer.sync(startBlock, endBlock);
    
    // Rebuild current state
    await syncer.rebuildState();
    
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

export { BlockchainSyncer };