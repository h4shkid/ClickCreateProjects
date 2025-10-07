const { ethers } = require('ethers');
const Database = require('better-sqlite3');
require('dotenv').config({ path: '.env.local' });

const CONTRACT_ADDRESS = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';
const MISSING_BLOCK = 23481224;

async function fixMissingBlock() {
  console.log(`🔧 Fixing missing block ${MISSING_BLOCK} for contract ${CONTRACT_ADDRESS}\n`);

  // Initialize database
  const dbPath = process.env.DATABASE_PATH || './data/nft-snapshot.db';
  const db = new Database(dbPath);
  console.log(`✅ Connected to database: ${dbPath}`);

  // Initialize provider
  const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
  const provider = new ethers.JsonRpcProvider(alchemyUrl);
  console.log('✅ Connected to Alchemy\n');

  // ERC1155 TransferSingle event signature
  const transferSingleTopic = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';

  try {
    console.log(`📡 Fetching events for block ${MISSING_BLOCK}...`);

    const logs = await provider.getLogs({
      fromBlock: MISSING_BLOCK,
      toBlock: MISSING_BLOCK,
      address: CONTRACT_ADDRESS,
      topics: [transferSingleTopic]
    });

    console.log(`✅ Found ${logs.length} TransferSingle events\n`);

    if (logs.length === 0) {
      console.log('No events to process');
      return;
    }

    // Get block info
    const block = await provider.getBlock(MISSING_BLOCK);
    const blockTimestamp = block.timestamp;

    // Prepare insert statement
    const insertEvent = db.prepare(`
      INSERT OR IGNORE INTO events (
        block_number, transaction_hash, log_index, event_type,
        from_address, to_address, token_id, amount, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((events) => {
      for (const event of events) {
        insertEvent.run(event);
      }
    });

    // Process events
    const eventsToInsert = [];

    for (const log of logs) {
      // Decode TransferSingle event
      // event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
      const operator = '0x' + log.topics[1].slice(26);
      const from = '0x' + log.topics[2].slice(26);
      const to = '0x' + log.topics[3].slice(26);
      const tokenId = BigInt(log.data.slice(0, 66)).toString();
      const amount = BigInt('0x' + log.data.slice(66, 130)).toString();

      console.log(`  📝 Token #${tokenId}: ${from.slice(0, 8)}... → ${to.slice(0, 8)}... (${amount})`);

      eventsToInsert.push([
        log.blockNumber,
        log.transactionHash,
        log.logIndex,
        'TransferSingle',
        from.toLowerCase(),
        to.toLowerCase(),
        tokenId,
        amount,
        blockTimestamp
      ]);
    }

    // Insert events
    console.log(`\n💾 Inserting ${eventsToInsert.length} events into database...`);
    insertMany(eventsToInsert);
    console.log('✅ Events inserted successfully');

    // Rebuild state
    console.log('\n🔄 Rebuilding current state...');
    const { execSync } = require('child_process');
    execSync('npx tsx scripts/rebuild-state.js', { stdio: 'inherit' });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    db.close();
  }

  console.log('\n✅ Missing block fixed successfully!');
}

fixMissingBlock();
