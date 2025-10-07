import { ethers } from 'ethers'

/**
 * Convert date to approximate Ethereum block number
 * Uses Ethereum's ~12 second block time for estimation
 */
export class DateToBlockConverter {
  private provider: ethers.JsonRpcProvider
  
  constructor() {
    // Use the same provider creation logic as sync
    const quickNodeEndpoint = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT
    const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    
    if (quickNodeEndpoint) {
      this.provider = new ethers.JsonRpcProvider(quickNodeEndpoint)
    } else if (alchemyKey) {
      this.provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`)
    } else {
      this.provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com')
    }
  }

  /**
   * Convert a date to the closest block number using binary search
   */
  async dateToBlock(targetDate: Date): Promise<number> {
    try {
      // Get current block and timestamp for reference
      const currentBlock = await this.provider.getBlockNumber()
      const currentBlockData = await this.provider.getBlock(currentBlock)

      if (!currentBlockData) {
        throw new Error('Could not fetch current block data')
      }

      const currentTimestamp = currentBlockData.timestamp
      const targetTimestamp = Math.floor(targetDate.getTime() / 1000)

      // If target date is in the future, return current block
      if (targetTimestamp >= currentTimestamp) {
        return currentBlock
      }

      // Calculate time difference in seconds
      const timeDiff = currentTimestamp - targetTimestamp

      // Ethereum average block time is ~12 seconds
      const AVERAGE_BLOCK_TIME = 12
      const estimatedBlockDiff = Math.floor(timeDiff / AVERAGE_BLOCK_TIME)

      // Initial estimate
      let estimatedBlock = Math.max(1, currentBlock - estimatedBlockDiff)

      console.log(`📅 Date to block conversion (binary search):`)
      console.log(`   Target date: ${targetDate.toISOString()}`)
      console.log(`   Target timestamp: ${targetTimestamp}`)
      console.log(`   Current block: ${currentBlock} (${new Date(currentTimestamp * 1000).toISOString()})`)
      console.log(`   Initial estimate: ${estimatedBlock}`)

      // Binary search for the closest block
      let low = Math.max(1, estimatedBlock - 50000) // Search ±50k blocks (~7 days)
      let high = Math.min(currentBlock, estimatedBlock + 50000)
      let closestBlock = estimatedBlock
      let closestDiff = Infinity

      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        const blockData = await this.provider.getBlock(mid)

        if (!blockData) {
          // If block not found, narrow search
          high = mid - 1
          continue
        }

        const blockTimestamp = blockData.timestamp
        const diff = Math.abs(blockTimestamp - targetTimestamp)

        // Update closest block if this is closer
        if (diff < closestDiff) {
          closestDiff = diff
          closestBlock = mid
        }

        // Binary search logic
        if (blockTimestamp < targetTimestamp) {
          low = mid + 1
        } else if (blockTimestamp > targetTimestamp) {
          high = mid - 1
        } else {
          // Exact match found
          closestBlock = mid
          break
        }
      }

      const finalBlockData = await this.provider.getBlock(closestBlock)
      console.log(`   ✅ Found closest block: ${closestBlock}`)
      console.log(`   Actual timestamp: ${finalBlockData ? new Date(finalBlockData.timestamp * 1000).toISOString() : 'unknown'}`)
      console.log(`   Time difference: ${closestDiff} seconds (${Math.round(closestDiff / 3600 * 10) / 10} hours)`)

      return closestBlock
    } catch (error) {
      console.error('Error converting date to block:', error)
      throw new Error('Failed to convert date to block number')
    }
  }

  /**
   * Convert block number to date
   */
  async blockToDate(blockNumber: number): Promise<Date> {
    try {
      const block = await this.provider.getBlock(blockNumber)
      
      if (!block) {
        throw new Error(`Block ${blockNumber} not found`)
      }

      return new Date(block.timestamp * 1000)
    } catch (error) {
      console.error('Error converting block to date:', error)
      throw new Error('Failed to convert block number to date')
    }
  }

  /**
   * Get a date range in block numbers
   */
  async dateRangeToBlocks(startDate: Date, endDate: Date): Promise<{ startBlock: number; endBlock: number }> {
    const [startBlock, endBlock] = await Promise.all([
      this.dateToBlock(startDate),
      this.dateToBlock(endDate)
    ])

    // Ensure correct order (earlier date = lower block number)
    return {
      startBlock: Math.min(startBlock, endBlock),
      endBlock: Math.max(startBlock, endBlock)
    }
  }
}

/**
 * Utility function to create converter instance
 */
export function createDateToBlockConverter(): DateToBlockConverter {
  return new DateToBlockConverter()
}