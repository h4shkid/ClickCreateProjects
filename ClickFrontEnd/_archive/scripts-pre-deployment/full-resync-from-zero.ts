#!/usr/bin/env npx tsx

import { ethers } from 'ethers';
import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
const DEPLOYMENT_BLOCK = 16671072; // ClickCreate deployment block
const CHUNK_SIZE = 2000; // Blocks per chunk (conservative for reliability)

const ERC1155_ABI = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
];

interface SyncProgress {
  currentBlock: number;
  targetBlock: number;
  totalEvents: number;
  totalChunks: number;
  currentChunk: number;
  startTime: number;
  lastProgressUpdate: number;
}

class FullResync {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private db: Database.Database;
  private progress: SyncProgress;

  constructor() {
    console.log('🔄 FULL RESYNC FROM DEPLOYMENT BLOCK\n');
    console.log('=' .repeat(60));

    // Initialize provider
    if (!ALCHEMY_API_KEY || ALCHEMY_API_KEY === 'your_alchemy_api_key_here') {
      throw new Error('❌ NEXT_PUBLIC_ALCHEMY_API_KEY not configured');
    }

    const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    this.provider = new ethers.JsonRpcProvider(alchemyUrl);
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_ABI, this.provider);

    console.log(`✅ Alchemy provider initialized`);
    console.log(`📄 Contract: ${CONTRACT_ADDRESS}`);
    console.log(`🏗️  Deployment Block: ${DEPLOYMENT_BLOCK.toLocaleString()}`);
    console.log('=' .repeat(60) + '\n');

    // Initialize database
    const dbPath = path.join(__dirname, '..', 'data', 'nft-snapshot.db');
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    console.log(`💾 Database: ${dbPath}\n`);

    this.progress = {
      currentBlock: DEPLOYMENT_BLOCK,
      targetBlock: 0,
      totalEvents: 0,
      totalChunks: 0,
      currentChunk: 0,
      startTime: Date.now(),
      lastProgressUpdate: Date.now()
    };
  }

  async initialize() {
    console.log('🔧 Initializing database schema...\n');

    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_number INTEGER NOT NULL,
        block_timestamp INTEGER NOT NULL,
        transaction_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        operator TEXT NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        token_id TEXT NOT NULL,
        amount TEXT NOT NULL,
        batch_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        contract_address TEXT DEFAULT '${CONTRACT_ADDRESS}',
        UNIQUE(transaction_hash, log_index)
      );

      CREATE INDEX IF NOT EXISTS idx_events_block ON events(block_number);
      CREATE INDEX IF NOT EXISTS idx_events_address_from ON events(from_address);
      CREATE INDEX IF NOT EXISTS idx_events_address_to ON events(to_address);
      CREATE INDEX IF NOT EXISTS idx_events_token ON events(token_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(block_timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
      CREATE INDEX IF NOT EXISTS idx_events_contract_block ON events(contract_address, block_number);

      CREATE TABLE IF NOT EXISTS current_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        holder_address TEXT NOT NULL,
        token_id TEXT NOT NULL,
        balance TEXT NOT NULL,
        last_updated_block INTEGER NOT NULL,
        last_updated_timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        contract_address TEXT DEFAULT '${CONTRACT_ADDRESS}',
        UNIQUE(holder_address, token_id, contract_address)
      );

      CREATE INDEX IF NOT EXISTS idx_state_holder ON current_state(holder_address);
      CREATE INDEX IF NOT EXISTS idx_state_token ON current_state(token_id);
      CREATE INDEX IF NOT EXISTS idx_state_balance ON current_state(balance);

      CREATE TABLE IF NOT EXISTS sync_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_synced_block INTEGER NOT NULL,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO sync_status (last_synced_block, status)
      VALUES (${DEPLOYMENT_BLOCK - 1}, 'initialized');
    `);

    console.log('✅ Database schema created\n');
  }

  async sync() {
    try {
      // Get current blockchain height
      const currentBlockNumber = await this.provider.getBlockNumber();
      this.progress.targetBlock = currentBlockNumber;

      const totalBlocks = this.progress.targetBlock - DEPLOYMENT_BLOCK + 1;
      this.progress.totalChunks = Math.ceil(totalBlocks / CHUNK_SIZE);

      console.log(`📊 Sync Plan:`);
      console.log(`   Start Block: ${DEPLOYMENT_BLOCK.toLocaleString()}`);
      console.log(`   End Block: ${this.progress.targetBlock.toLocaleString()}`);
      console.log(`   Total Blocks: ${totalBlocks.toLocaleString()}`);
      console.log(`   Chunk Size: ${CHUNK_SIZE.toLocaleString()} blocks`);
      console.log(`   Total Chunks: ${this.progress.totalChunks.toLocaleString()}\n`);

      console.log('🚀 Starting sync...\n');

      // Prepare insert statements
      const insertEvent = this.db.prepare(`
        INSERT OR IGNORE INTO events (
          block_number, block_timestamp, transaction_hash, log_index,
          event_type, operator, from_address, to_address, token_id, amount, batch_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertManyEvents = this.db.transaction((events: any[]) => {
        for (const event of events) {
          insertEvent.run(event);
        }
      });

      const updateSyncStatus = this.db.prepare(`
        UPDATE sync_status SET last_synced_block = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1
      `);

      // Process chunks
      let currentChunkStart = DEPLOYMENT_BLOCK;

      while (currentChunkStart <= this.progress.targetBlock) {
        this.progress.currentChunk++;
        const currentChunkEnd = Math.min(currentChunkStart + CHUNK_SIZE - 1, this.progress.targetBlock);

        await this.processChunk(currentChunkStart, currentChunkEnd, insertManyEvents);

        // Update sync status after each chunk
        updateSyncStatus.run(currentChunkEnd, 'syncing');

        currentChunkStart = currentChunkEnd + 1;
      }

      // Mark as complete
      updateSyncStatus.run(this.progress.targetBlock, 'completed');

      console.log('\n' + '='.repeat(60));
      console.log('✅ SYNC COMPLETED SUCCESSFULLY!\n');
      console.log(`📊 Final Statistics:`);
      console.log(`   Total Events: ${this.progress.totalEvents.toLocaleString()}`);
      console.log(`   Total Chunks: ${this.progress.totalChunks.toLocaleString()}`);
      console.log(`   Duration: ${this.formatDuration(Date.now() - this.progress.startTime)}`);
      console.log('='.repeat(60) + '\n');

      // Rebuild state
      console.log('🔧 Rebuilding current state from events...\n');
      const { execSync } = require('child_process');
      execSync('npx tsx scripts/rebuild-state.js', { stdio: 'inherit' });

    } catch (error: any) {
      console.error('\n❌ SYNC FAILED:', error.message);
      console.error(error);

      const updateSyncStatus = this.db.prepare(`
        UPDATE sync_status SET status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1
      `);
      updateSyncStatus.run('failed', error.message);

      throw error;
    }
  }

  private async processChunk(fromBlock: number, toBlock: number, insertManyEvents: any) {
    const chunkStart = Date.now();

    // Show progress
    const percentComplete = ((this.progress.currentChunk - 1) / this.progress.totalChunks * 100).toFixed(1);
    process.stdout.write(`\r⏳ Progress: ${percentComplete}% | Chunk ${this.progress.currentChunk}/${this.progress.totalChunks} | Block ${toBlock.toLocaleString()} | Events: ${this.progress.totalEvents.toLocaleString()}`);

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

      if (singleEvents.length === 0 && batchEvents.length === 0) {
        return; // No events in this chunk
      }

      // Get block timestamps (batch fetch for efficiency)
      const blockNumbers = new Set<number>();
      singleEvents.forEach(e => blockNumbers.add(e.blockNumber));
      batchEvents.forEach(e => blockNumbers.add(e.blockNumber));

      const blockTimestamps = new Map<number, number>();
      for (const blockNum of blockNumbers) {
        const block = await this.provider.getBlock(blockNum);
        blockTimestamps.set(blockNum, block!.timestamp);
      }

      // Process events
      const eventsToInsert: any[] = [];

      // Process TransferSingle events
      for (const event of singleEvents) {
        const args = (event as any).args;
        eventsToInsert.push([
          event.blockNumber,
          blockTimestamps.get(event.blockNumber)!,
          event.transactionHash,
          (event as any).index,
          'TransferSingle',
          args.operator.toLowerCase(),
          args.from.toLowerCase(),
          args.to.toLowerCase(),
          args.id.toString(),
          args.value.toString(),
          null
        ]);
      }

      // Process TransferBatch events
      for (const event of batchEvents) {
        const args = (event as any).args;
        const batchData = JSON.stringify({
          ids: args.ids.map((id: bigint) => id.toString()),
          values: args.values.map((v: bigint) => v.toString())
        });

        eventsToInsert.push([
          event.blockNumber,
          blockTimestamps.get(event.blockNumber)!,
          event.transactionHash,
          (event as any).index,
          'TransferBatch',
          args.operator.toLowerCase(),
          args.from.toLowerCase(),
          args.to.toLowerCase(),
          '0', // Placeholder for batch
          '0', // Placeholder for batch
          batchData
        ]);
      }

      // Insert events
      if (eventsToInsert.length > 0) {
        insertManyEvents(eventsToInsert);
        this.progress.totalEvents += eventsToInsert.length;
      }

    } catch (error: any) {
      console.error(`\n❌ Error processing chunk ${fromBlock}-${toBlock}:`, error.message);
      throw error;
    }
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  close() {
    this.db.close();
  }
}

async function main() {
  const syncer = new FullResync();

  try {
    await syncer.initialize();
    await syncer.sync();
    console.log('\n✅ Full resync completed successfully!\n');
  } catch (error) {
    console.error('\n❌ Full resync failed\n');
    process.exit(1);
  } finally {
    syncer.close();
  }
}

main();
