#!/usr/bin/env npx tsx

import { ethers } from 'ethers';
import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const CONTRACT_ADDRESS = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';
const TARGET_BLOCK = 23480200; // 0x1664788
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const ERC1155_ABI = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
];

async function fetchSpecificBlock() {
  console.log(`🎯 Fetching events for block ${TARGET_BLOCK}\n`);

  // Initialize provider
  const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
  const provider = new ethers.JsonRpcProvider(alchemyUrl);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_ABI, provider);

  // Initialize database
  const dbPath = path.join(__dirname, '..', 'data', 'nft-snapshot.db');
  const db = new Database(dbPath);

  try {
    // Fetch events
    console.log('📡 Fetching TransferSingle events...');
    const singleEvents = await contract.queryFilter(
      contract.filters.TransferSingle(),
      TARGET_BLOCK,
      TARGET_BLOCK
    );

    console.log(`✅ Found ${singleEvents.length} TransferSingle events\n`);

    if (singleEvents.length === 0) {
      console.log('No events found in this block');
      return;
    }

    // Get block info
    const block = await provider.getBlock(TARGET_BLOCK);
    const blockTimestamp = block!.timestamp;

    // Prepare insert
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO events (
        block_number, block_timestamp, transaction_hash, log_index, event_type,
        operator, from_address, to_address, token_id, amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((events: any[]) => {
      for (const event of events) {
        insertStmt.run(event);
      }
    });

    // Process events
    const eventsToInsert: any[] = [];

    for (const event of singleEvents) {
      const args = (event as any).args;
      const operator = args.operator.toLowerCase();
      const tokenId = args.id.toString();
      const amount = args.value.toString();
      const from = args.from.toLowerCase();
      const to = args.to.toLowerCase();

      console.log(`  📝 Token #${tokenId}: ${from.slice(0, 8)}... → ${to.slice(0, 8)}... (${amount})`);

      eventsToInsert.push([
        event.blockNumber,
        blockTimestamp,
        event.transactionHash,
        (event as any).index,
        'TransferSingle',
        operator,
        from,
        to,
        tokenId,
        amount
      ]);
    }

    // Insert
    console.log(`\n💾 Inserting ${eventsToInsert.length} events...`);
    insertMany(eventsToInsert);
    console.log('✅ Events inserted successfully!');

    // Rebuild state
    console.log('\n🔄 Rebuilding state...');
    const { execSync } = require('child_process');
    execSync('npx tsx scripts/rebuild-state.js', { stdio: 'inherit' });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    db.close();
  }
}

fetchSpecificBlock();
