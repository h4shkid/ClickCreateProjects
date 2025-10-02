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
   * Convert a date to approximate block number
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
      
      // Estimate target block
      const estimatedBlock = Math.max(1, currentBlock - estimatedBlockDiff)
      
      console.log(`📅 Date to block conversion:`)
      console.log(`   Target date: ${targetDate.toISOString()}`)
      console.log(`   Current block: ${currentBlock} (${new Date(currentTimestamp * 1000).toISOString()})`)
      console.log(`   Estimated block: ${estimatedBlock}`)
      console.log(`   Time difference: ${timeDiff} seconds (${Math.floor(timeDiff / 86400)} days)`)

      return estimatedBlock
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