import { ethers } from 'ethers'
import { createDatabaseAdapter } from '../database/adapter'

// Minimal ABIs - only Transfer event
const ERC721_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)'
]

const ERC1155_ABI = [
  'event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)',
  'event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)'
]

export interface SyncOptions {
  contractAddress: string
  fromBlock: number | string
  toBlock: number | string
  chainId?: number
}

/**
 * Sync contract events from blockchain to database
 * This is a fallback sync method when worker is not available
 */
export async function syncContractEvents(options: SyncOptions) {
  const { contractAddress, fromBlock, toBlock, chainId = 1 } = options

  console.log(`🔄 Starting local sync for ${contractAddress}`)
  console.log(`📊 From block: ${fromBlock}, To block: ${toBlock}`)

  try {
    // Get RPC provider
    const rpcUrl = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT ||
                   (process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
                     ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
                     : 'https://eth.llamarpc.com')

    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Get contract type from database
    const db = createDatabaseAdapter()
    const contract = await db.prepare(`
      SELECT contract_type, deployment_block
      FROM contracts
      WHERE LOWER(address) = LOWER(?)
    `).get(contractAddress.toLowerCase()) as any

    if (!contract) {
      throw new Error('Contract not found in database')
    }

    // Determine ABI based on contract type
    const abi = contract.contract_type === 'ERC721' ? ERC721_ABI : ERC1155_ABI
    const contractInstance = new ethers.Contract(contractAddress, abi, provider)

    // Resolve block numbers
    const currentBlock = await provider.getBlockNumber()
    const fromBlockNum = fromBlock === 'auto'
      ? contract.deployment_block
      : (typeof fromBlock === 'string' && fromBlock === 'latest' ? currentBlock : Number(fromBlock))
    const toBlockNum = toBlock === 'latest' ? currentBlock : Number(toBlock)

    console.log(`📡 Scanning blocks ${fromBlockNum} to ${toBlockNum}`)

    // Fetch Transfer events in chunks to avoid RPC limits
    const CHUNK_SIZE = 2000
    let processedEvents = 0

    for (let start = fromBlockNum; start <= toBlockNum; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, toBlockNum)

      console.log(`🔍 Fetching events from block ${start} to ${end}`)

      const filter = contractInstance.filters.Transfer()
      const events = await contractInstance.queryFilter(filter, start, end)

      console.log(`📦 Found ${events.length} events in this chunk`)

      // Process events into database
      for (const log of events) {
        if (!('args' in log)) continue // Skip if not EventLog

        const event = log as ethers.EventLog
        const block = await event.getBlock()

        // Insert event into database
        await db.prepare(`
          INSERT OR IGNORE INTO events (
            contract_address, event_type, from_address, to_address,
            token_id, amount, block_number, block_timestamp, transaction_hash, log_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          contractAddress.toLowerCase(),
          'Transfer',
          event.args[0]?.toLowerCase() || '',
          event.args[1]?.toLowerCase() || '',
          event.args[2]?.toString() || '0',
          event.args[3]?.toString() || '1', // Amount for ERC1155, 1 for ERC721
          event.blockNumber,
          block.timestamp,
          event.transactionHash,
          event.index
        )

        processedEvents++
      }

      console.log(`✅ Processed ${processedEvents} events so far`)
    }

    console.log(`🎉 Local sync complete! Processed ${processedEvents} events`)

    return {
      success: true,
      eventsProcessed: processedEvents,
      fromBlock: fromBlockNum,
      toBlock: toBlockNum
    }

  } catch (error: any) {
    console.error('❌ Local sync error:', error)
    throw error
  }
}
