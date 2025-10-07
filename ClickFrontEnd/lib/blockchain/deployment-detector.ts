import { ethers } from 'ethers'
import axios from 'axios'

export interface DeploymentInfo {
  blockNumber: number
  transactionHash: string
  method: 'etherscan' | 'binary-search' | 'cached'
}

/**
 * Detects the deployment block of a contract using multiple methods
 */
export class DeploymentDetector {
  private provider: ethers.JsonRpcProvider
  private etherscanApiKey: string | undefined
  private chainId: number | undefined

  constructor(provider: ethers.JsonRpcProvider, chainId?: number) {
    this.provider = provider
    this.chainId = chainId
    this.etherscanApiKey = process.env.ETHERSCAN_API_KEY
  }

  /**
   * Main method to detect deployment block with fallbacks
   */
  async detectDeploymentBlock(contractAddress: string): Promise<DeploymentInfo | null> {
    console.log(`🔍 Detecting deployment block for contract: ${contractAddress}`)

    // Method 1: Try blockchain explorer API (fastest and most reliable)
    try {
      const explorerResult = await this.detectViaExplorer(contractAddress)
      if (explorerResult) {
        console.log(`✅ Explorer detected deployment at block ${explorerResult.blockNumber}`)
        return explorerResult
      }
    } catch (error) {
      console.warn('❌ Explorer detection failed:', error)
    }

    // Method 2: Fallback to binary search
    try {
      const binarySearchResult = await this.detectViaBinarySearch(contractAddress)
      if (binarySearchResult) {
        console.log(`✅ Binary search detected deployment at block ${binarySearchResult.blockNumber}`)
        return binarySearchResult
      }
    } catch (error) {
      console.warn('❌ Binary search detection failed:', error)
    }

    console.log(`❌ Could not detect deployment block for ${contractAddress}`)
    return null
  }

  /**
   * Detect deployment block using blockchain explorer APIs (Etherscan, Basescan, etc.)
   */
  private async detectViaExplorer(contractAddress: string): Promise<DeploymentInfo | null> {
    const explorerConfig = this.getExplorerConfig()
    
    if (!explorerConfig) {
      console.log('⚠️  No explorer API configuration found')
      return null
    }

    try {
      const url = `${explorerConfig.baseUrl}/api?module=contract&action=getcontractcreation&contractaddresses=${contractAddress}&apikey=${explorerConfig.apiKey}`
      
      console.log(`🌐 Calling ${explorerConfig.name} API for contract creation info...`)
      const response = await axios.get(url, { timeout: 10000 })
      
      if (response.data.status === '1' && response.data.result && response.data.result.length > 0) {
        const creation = response.data.result[0]
        
        // Get transaction receipt to get block number
        const txHash = creation.txHash
        const receipt = await this.provider.getTransactionReceipt(txHash)
        
        if (receipt) {
          return {
            blockNumber: receipt.blockNumber,
            transactionHash: txHash,
            method: explorerConfig.name.toLowerCase() as 'etherscan' | 'binary-search' | 'cached'
          }
        }
      } else {
        console.warn(`${explorerConfig.name} API returned no creation data`)
        return null
      }
    } catch (error) {
      console.error(`${explorerConfig.name} API error:`, error)
      throw error
    }

    return null
  }

  /**
   * Get explorer configuration for Ethereum mainnet only
   */
  private getExplorerConfig(): { name: string; baseUrl: string; apiKey: string } | null {
    if (!this.etherscanApiKey) {
      return null
    }

    // Only support Ethereum mainnet (chain ID 1)
    if (this.chainId === 1) {
      return {
        name: 'Etherscan',
        baseUrl: 'https://api.etherscan.io',
        apiKey: this.etherscanApiKey
      }
    }
    
    console.log(`⚠️  Chain ID ${this.chainId} not supported - only Ethereum mainnet (1) is supported`)
    return null
  }

  /**
   * Detect deployment block using binary search with getCode
   */
  private async detectViaBinarySearch(contractAddress: string): Promise<DeploymentInfo | null> {
    try {
      console.log(`🔎 Starting binary search for contract deployment...`)
      
      const currentBlock = await this.provider.getBlockNumber()
      let low = 1
      let high = currentBlock
      let deploymentBlock: number | null = null

      // Binary search for first block where contract exists
      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        
        try {
          const code = await this.provider.getCode(contractAddress, mid)
          
          if (code === '0x') {
            // Contract doesn't exist at this block, search higher
            low = mid + 1
          } else {
            // Contract exists, this could be deployment block or later
            deploymentBlock = mid
            high = mid - 1
          }
        } catch (error) {
          // If we get an error, try to continue
          console.warn(`⚠️  Error checking block ${mid}, continuing...`)
          low = mid + 1
        }
      }

      if (deploymentBlock) {
        // Try to find the exact deployment transaction in this block
        try {
          const block = await this.provider.getBlock(deploymentBlock, true)
          if (block && block.transactions) {
            // Look for contract creation transaction
            for (const tx of block.transactions) {
              if (typeof tx === 'object' && tx !== null && 'to' in tx && 'hash' in tx) {
                const txObj = tx as any
                if (txObj.to === null) {
                  // This might be a contract creation transaction
                  const receipt = await this.provider.getTransactionReceipt(txObj.hash)
                  if (receipt?.contractAddress?.toLowerCase() === contractAddress.toLowerCase()) {
                    return {
                      blockNumber: deploymentBlock,
                      transactionHash: txObj.hash,
                      method: 'binary-search'
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn('Could not find deployment transaction, using block number only')
        }

        // Return deployment block even if we couldn't find the exact transaction
        return {
          blockNumber: deploymentBlock,
          transactionHash: '', // Unknown transaction hash
          method: 'binary-search'
        }
      }

      return null
    } catch (error) {
      console.error('Binary search error:', error)
      throw error
    }
  }

  /**
   * Quick validation - check if a contract exists at a given block
   */
  async contractExistsAtBlock(contractAddress: string, blockNumber: number): Promise<boolean> {
    try {
      const code = await this.provider.getCode(contractAddress, blockNumber)
      return code !== '0x'
    } catch (error) {
      console.warn(`Error checking contract at block ${blockNumber}:`, error)
      return false
    }
  }
}

/**
 * Utility function to create a deployment detector with default provider
 */
export function createDeploymentDetector(): DeploymentDetector {
  // Create provider with same logic as sync route
  const quickNodeEndpoint = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  
  let provider: ethers.JsonRpcProvider
  
  if (quickNodeEndpoint) {
    provider = new ethers.JsonRpcProvider(quickNodeEndpoint)
  } else if (alchemyKey) {
    provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`)
  } else {
    provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com')
  }

  return new DeploymentDetector(provider)
}