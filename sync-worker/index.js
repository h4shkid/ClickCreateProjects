import express from 'express'
import pg from 'pg'
import { ethers } from 'ethers'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pg
const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3001

// Postgres connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
})

// In-memory job queue
const jobQueue = []
let isProcessing = false

// ERC-721 Transfer event signature
const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
// ERC-1155 TransferSingle event signature
const TRANSFER_SINGLE_SIGNATURE = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62'
// ERC-1155 TransferBatch event signature
const TRANSFER_BATCH_SIGNATURE = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb'

console.log('🚀 ClickCreate Sync Worker Starting...')
console.log('📊 Postgres URL:', process.env.POSTGRES_URL ? 'Connected' : 'Missing!')
console.log('🔗 RPC URL:', process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ? 'Connected' : 'Missing!')

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    queueLength: jobQueue.length,
    isProcessing,
    timestamp: new Date().toISOString()
  })
})

// Trigger sync endpoint
app.post('/sync', async (req, res) => {
  const { contractAddress, fromBlock, toBlock } = req.body

  if (!contractAddress) {
    return res.status(400).json({ success: false, error: 'Contract address required' })
  }

  // Add job to queue
  const jobId = `sync-${contractAddress}-${Date.now()}`
  jobQueue.push({
    id: jobId,
    contractAddress: contractAddress.toLowerCase(),
    fromBlock: fromBlock || 'auto',
    toBlock: toBlock || 'latest',
    status: 'queued',
    createdAt: new Date()
  })

  console.log(`✅ Job queued: ${jobId}`)

  // Start processing if not already running
  if (!isProcessing) {
    processQueue()
  }

  res.json({
    success: true,
    jobId,
    message: 'Sync job queued',
    position: jobQueue.length
  })
})

// Get job status endpoint
app.get('/status/:jobId', (req, res) => {
  const job = jobQueue.find(j => j.id === req.params.jobId)

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' })
  }

  res.json({ success: true, job })
})

// Process queue
async function processQueue() {
  if (isProcessing || jobQueue.length === 0) return

  isProcessing = true
  const job = jobQueue[0]

  console.log(`\n🔄 Processing job: ${job.id}`)
  console.log(`📍 Contract: ${job.contractAddress}`)

  try {
    job.status = 'processing'
    job.startedAt = new Date()

    await syncContract(job)

    job.status = 'completed'
    job.completedAt = new Date()
    console.log(`✅ Job completed: ${job.id}`)

  } catch (error) {
    job.status = 'failed'
    job.error = error.message
    job.failedAt = new Date()
    console.error(`❌ Job failed: ${job.id}`, error.message)

  } finally {
    // Remove from queue after 5 minutes
    setTimeout(() => {
      const index = jobQueue.findIndex(j => j.id === job.id)
      if (index > -1) jobQueue.splice(index, 1)
    }, 5 * 60 * 1000)

    jobQueue.shift() // Remove current job
    isProcessing = false

    // Process next job
    if (jobQueue.length > 0) {
      setTimeout(processQueue, 1000)
    }
  }
}

// Sync contract function
async function syncContract(job) {
  const { contractAddress, fromBlock, toBlock } = job
  const client = await pool.connect()

  try {
    // Get contract info
    const contractResult = await client.query(
      'SELECT * FROM contracts WHERE LOWER(address) = $1',
      [contractAddress]
    )

    if (contractResult.rows.length === 0) {
      throw new Error('Contract not found in database')
    }

    const contract = contractResult.rows[0]
    console.log(`📝 Contract: ${contract.name} (${contract.symbol})`)

    // Determine block range
    let startBlock
    if (fromBlock === 'auto') {
      // Get last synced block from events table
      const lastBlockResult = await client.query(
        'SELECT MAX(block_number) as last_block FROM events WHERE LOWER(contract_address) = $1',
        [contractAddress]
      )
      const lastBlock = lastBlockResult.rows[0]?.last_block

      if (lastBlock) {
        startBlock = parseInt(lastBlock) + 1 // Start from next block
        console.log(`🔄 Resuming sync from block ${startBlock} (last synced: ${lastBlock})`)
      } else {
        startBlock = contract.deployment_block
        console.log(`🆕 Starting initial sync from deployment block ${startBlock}`)
      }
    } else {
      startBlock = parseInt(fromBlock)
    }

    let endBlock = toBlock === 'latest' ? null : parseInt(toBlock)

    // Get current blockchain height if endBlock is latest
    const provider = new ethers.JsonRpcProvider(
      `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
    )

    if (!endBlock) {
      endBlock = await provider.getBlockNumber()
    }

    console.log(`📦 Syncing blocks ${startBlock} to ${endBlock}`)

    // Fetch logs in chunks
    const CHUNK_SIZE = 2000
    let currentBlock = startBlock
    let totalEvents = 0

    while (currentBlock <= endBlock) {
      const chunkEnd = Math.min(currentBlock + CHUNK_SIZE - 1, endBlock)

      console.log(`🔍 Fetching blocks ${currentBlock} to ${chunkEnd}...`)

      const logs = await provider.getLogs({
        address: contractAddress,
        fromBlock: currentBlock,
        toBlock: chunkEnd,
        topics: [
          [TRANSFER_EVENT_SIGNATURE, TRANSFER_SINGLE_SIGNATURE, TRANSFER_BATCH_SIGNATURE]
        ]
      })

      if (logs.length > 0) {
        console.log(`   Found ${logs.length} events`)

        // Process and insert events
        for (const log of logs) {
          await insertEvent(client, contract, log)
          totalEvents++
        }
      }

      currentBlock = chunkEnd + 1

      // Update job progress
      job.progress = Math.round(((currentBlock - startBlock) / (endBlock - startBlock)) * 100)
      job.eventsProcessed = totalEvents
    }

    // Rebuild current_state
    console.log('🔨 Rebuilding current_state...')
    await rebuildCurrentState(client, contractAddress)

    console.log(`✅ Sync complete! Processed ${totalEvents} events`)

  } finally {
    client.release()
  }
}

// Insert event into database
async function insertEvent(client, contract, log) {
  const block = await log.getBlock()

  // Parse event based on signature
  let fromAddress, toAddress, tokenId, value, operator

  if (log.topics[0] === TRANSFER_EVENT_SIGNATURE) {
    // ERC-721 Transfer
    fromAddress = '0x' + log.topics[1].slice(26)
    toAddress = '0x' + log.topics[2].slice(26)
    tokenId = BigInt(log.topics[3]).toString()
    value = '1'
    operator = fromAddress // ERC-721 doesn't have operator, use from_address
  } else if (log.topics[0] === TRANSFER_SINGLE_SIGNATURE) {
    // ERC-1155 TransferSingle
    operator = '0x' + log.topics[1].slice(26)
    fromAddress = '0x' + log.topics[2].slice(26)
    toAddress = '0x' + log.topics[3].slice(26)
    const data = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'uint256'], log.data)
    tokenId = data[0].toString()
    value = data[1].toString()
  } else {
    // Skip TransferBatch for now (complex)
    return
  }

  await client.query(`
    INSERT INTO events (
      contract_address, event_type, operator, from_address, to_address,
      token_id, amount, block_number, block_timestamp, transaction_hash, log_index
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (transaction_hash, log_index) DO NOTHING
  `, [
    contract.address.toLowerCase(),
    'Transfer',
    operator.toLowerCase(),
    fromAddress.toLowerCase(),
    toAddress.toLowerCase(),
    tokenId,
    value,
    log.blockNumber,
    block.timestamp,
    log.transactionHash,
    log.index
  ])
}

// Rebuild current_state table
async function rebuildCurrentState(client, contractAddress) {
  await client.query(`
    DELETE FROM current_state WHERE LOWER(contract_address) = $1
  `, [contractAddress])

  await client.query(`
    INSERT INTO current_state (contract_address, token_id, address, balance, last_updated_block)
    SELECT
      contract_address,
      token_id,
      address,
      SUM(balance_change) as balance,
      MAX(block_number) as last_updated_block
    FROM (
      SELECT
        contract_address,
        token_id,
        to_address as address,
        CAST(amount AS BIGINT) as balance_change,
        block_number
      FROM events
      WHERE LOWER(contract_address) = $1

      UNION ALL

      SELECT
        contract_address,
        token_id,
        from_address as address,
        -CAST(amount AS BIGINT) as balance_change,
        block_number
      FROM events
      WHERE LOWER(contract_address) = $1
        AND from_address != '0x0000000000000000000000000000000000000000'
    ) t
    GROUP BY contract_address, token_id, address
    HAVING SUM(balance_change) > 0
  `, [contractAddress])
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Sync Worker running on port ${PORT}`)
  console.log(`📊 Health check: http://localhost:${PORT}/health`)
  console.log(`🔄 Sync endpoint: POST http://localhost:${PORT}/sync`)
})
