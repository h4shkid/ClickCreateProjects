/**
 * Contract Detection and Validation System
 * Automatically detects ERC-721/ERC-1155 contracts and validates their implementation
 */

import { ethers } from 'ethers'
import { createPublicClient, http, getContract, Address, isAddress } from 'viem'
import { mainnet, polygon, arbitrum, base } from 'viem/chains'

// Standard interface IDs for ERC standards
const INTERFACE_IDS = {
  ERC165: '0x01ffc9a7',
  ERC721: '0x80ac58cd',
  ERC721_METADATA: '0x5b5e139f',
  ERC721_ENUMERABLE: '0x780e9d63',
  ERC1155: '0xd9b67a26',
  ERC1155_METADATA: '0x0e89341c',
  ERC2981_ROYALTIES: '0x2a55205a'
} as const

// Standard method signatures for contract detection
const METHOD_SIGNATURES = {
  // ERC721 methods
  balanceOf_721: '0x70a08231', // balanceOf(address)
  ownerOf: '0x6352211e', // ownerOf(uint256)
  transferFrom: '0x23b872dd', // transferFrom(address,address,uint256)
  tokenURI: '0xc87b56dd', // tokenURI(uint256)
  
  // ERC1155 methods
  balanceOf_1155: '0x00fdd58e', // balanceOf(address,uint256)
  balanceOfBatch: '0x4e1273f4', // balanceOfBatch(address[],uint256[])
  uri: '0x0e89341c', // uri(uint256)
  
  // Common methods
  supportsInterface: '0x01ffc9a7', // supportsInterface(bytes4)
  name: '0x06fdde03', // name()
  symbol: '0x95d89b41', // symbol()
  totalSupply: '0x18160ddd' // totalSupply()
} as const

export interface ContractInfo {
  address: string
  name?: string
  symbol?: string
  contractType: 'ERC721' | 'ERC1155' | 'UNKNOWN'
  isValid: boolean
  features: {
    supportsMetadata: boolean
    supportsEnumerable: boolean
    supportsRoyalties: boolean
    supportsInterface: boolean
  }
  deploymentBlock?: number
  totalSupply?: string
  error?: string
  chainId: number
}

export interface ValidationResult {
  isValid: boolean
  contractType: 'ERC721' | 'ERC1155' | 'UNKNOWN'
  confidence: number // 0-100
  features: string[]
  warnings: string[]
  errors: string[]
}

export class ContractDetector {
  private clients: Map<number, any> = new Map()
  
  constructor() {
    // Initialize clients for supported chains
    this.initializeClients()
  }

  private initializeClients() {
    const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    const quickNodeEndpoint = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT
    
    // Map chains to their Alchemy network names
    const alchemyUrls: Record<number, string> = {
      1: 'eth-mainnet',
      137: 'polygon-mainnet', 
      42161: 'arb-mainnet',
      8453: 'base-mainnet'
    }
    
    const chains = [
      { chain: mainnet, id: 1 },
      { chain: polygon, id: 137 },
      { chain: arbitrum, id: 42161 },
      { chain: base, id: 8453 }
    ]

    chains.forEach(({ chain, id }) => {
      let rpcUrl: string | undefined
      
      // Priority: QuickNode -> Alchemy -> Default
      if (id === 1 && quickNodeEndpoint) {
        // Use QuickNode for Ethereum mainnet
        rpcUrl = quickNodeEndpoint
        console.log(`Using QuickNode for chain ${id}: ${rpcUrl}`)
      } else if (alchemyKey && alchemyUrls[id]) {
        // Use Alchemy for other chains
        rpcUrl = `https://${alchemyUrls[id]}.g.alchemy.com/v2/${alchemyKey}`
        console.log(`Using Alchemy for chain ${id}: ${rpcUrl}`)
      } else {
        // Fallback to default public RPC
        console.log(`Using default RPC for chain ${id}`)
      }
      
      const client = createPublicClient({
        chain,
        transport: http(rpcUrl) // Will use default if rpcUrl is undefined
      })
      this.clients.set(id, client)
    })
  }

  /**
   * Get fallback RPC endpoints for a chain
   */
  private getFallbackEndpoints(chainId: number): string[] {
    const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    const quickNodeEndpoint = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT
    
    const endpoints: string[] = []
    
    if (chainId === 1) {
      // Ethereum mainnet fallbacks
      if (quickNodeEndpoint) endpoints.push(quickNodeEndpoint)
      if (alchemyKey) endpoints.push(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`)
      endpoints.push('https://eth.llamarpc.com')
      endpoints.push('https://rpc.ankr.com/eth')
      endpoints.push('https://ethereum.publicnode.com')
    } else if (chainId === 137) {
      // Polygon fallbacks
      if (alchemyKey) endpoints.push(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`)
      endpoints.push('https://polygon.llamarpc.com')
      endpoints.push('https://rpc.ankr.com/polygon')
    } else if (chainId === 42161) {
      // Arbitrum fallbacks
      if (alchemyKey) endpoints.push(`https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`)
      endpoints.push('https://arbitrum.llamarpc.com')
      endpoints.push('https://rpc.ankr.com/arbitrum')
    } else if (chainId === 8453) {
      // Base fallbacks
      if (alchemyKey) endpoints.push(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`)
      endpoints.push('https://base.llamarpc.com')
      endpoints.push('https://rpc.ankr.com/base')
    }
    
    return endpoints
  }

  /**
   * Detect and validate a contract address
   */
  async detectContract(address: string, chainId: number = 1): Promise<ContractInfo> {
    try {
      // Basic address validation
      if (!isAddress(address)) {
        return {
          address,
          contractType: 'UNKNOWN',
          isValid: false,
          features: {
            supportsMetadata: false,
            supportsEnumerable: false,
            supportsRoyalties: false,
            supportsInterface: false
          },
          error: 'Invalid Ethereum address format',
          chainId
        }
      }

      const client = this.clients.get(chainId)
      if (!client) {
        return {
          address,
          contractType: 'UNKNOWN',
          isValid: false,
          features: {
            supportsMetadata: false,
            supportsEnumerable: false,
            supportsRoyalties: false,
            supportsInterface: false
          },
          error: `Unsupported chain ID: ${chainId}`,
          chainId
        }
      }

      // Check if address has contract code with fallback
      let code: string | undefined
      let lastError: any = null
      
      try {
        code = await client.getBytecode({ address: address as Address })
      } catch (error) {
        lastError = error
        console.warn(`Primary RPC failed for ${address}, trying fallback...`)
        
        // Try fallback endpoints
        const fallbackEndpoints = this.getFallbackEndpoints(chainId)
        
        for (const endpoint of fallbackEndpoints) {
          try {
            const fallbackClient = createPublicClient({
              chain: [mainnet, polygon, arbitrum, base].find(c => c.id === chainId) || mainnet,
              transport: http(endpoint)
            })
            code = await fallbackClient.getBytecode({ address: address as Address })
            console.log(`Fallback RPC succeeded with ${endpoint}`)
            break // Success, exit loop
          } catch (fallbackError) {
            console.warn(`Fallback RPC failed: ${endpoint}`)
            lastError = fallbackError
          }
        }
        
        // If all endpoints failed
        if (!code) {
          return {
            address,
            contractType: 'UNKNOWN',
            isValid: false,
            features: {
              supportsMetadata: false,
              supportsEnumerable: false,
              supportsRoyalties: false,
              supportsInterface: false
            },
            error: `All RPC endpoints failed. Last error: ${lastError instanceof Error ? lastError.message : 'Network error'}`,
            chainId
          }
        }
      }
      
      if (!code || code === '0x') {
        return {
          address,
          contractType: 'UNKNOWN',
          isValid: false,
          features: {
            supportsMetadata: false,
            supportsEnumerable: false,
            supportsRoyalties: false,
            supportsInterface: false
          },
          error: 'Address is not a contract (no bytecode)',
          chainId
        }
      }

      // Detect contract type and features
      const validation = await this.validateContract(address as Address, client)
      
      // Get basic contract info
      const basicInfo = await this.getBasicContractInfo(address as Address, client, validation.contractType)
      
      // Get deployment block (if possible)
      const deploymentBlock = await this.getDeploymentBlock(address as Address, client)

      return {
        address,
        name: basicInfo.name,
        symbol: basicInfo.symbol,
        contractType: validation.contractType,
        isValid: validation.isValid,
        features: {
          supportsMetadata: validation.features.includes('metadata'),
          supportsEnumerable: validation.features.includes('enumerable'),
          supportsRoyalties: validation.features.includes('royalties'),
          supportsInterface: validation.features.includes('supportsInterface')
        },
        deploymentBlock,
        totalSupply: basicInfo.totalSupply,
        chainId,
        ...(validation.errors.length > 0 && { error: validation.errors.join('; ') })
      }

    } catch (error) {
      console.error('Contract detection failed:', error)
      return {
        address,
        contractType: 'UNKNOWN',
        isValid: false,
        features: {
          supportsMetadata: false,
          supportsEnumerable: false,
          supportsRoyalties: false,
          supportsInterface: false
        },
        error: error instanceof Error ? error.message : 'Unknown error during detection',
        chainId
      }
    }
  }

  /**
   * Validate contract implementation
   */
  private async validateContract(address: Address, client: any): Promise<ValidationResult> {
    const features: string[] = []
    const warnings: string[] = []
    const errors: string[] = []
    let contractType: 'ERC721' | 'ERC1155' | 'UNKNOWN' = 'UNKNOWN'
    let confidence = 0

    try {
      // Check for ERC165 support first
      const supportsERC165 = await this.checkSupportsInterface(address, client, INTERFACE_IDS.ERC165)
      if (supportsERC165) {
        features.push('supportsInterface')
        confidence += 20
      }

      // Check for ERC721 support
      const supportsERC721 = await this.checkSupportsInterface(address, client, INTERFACE_IDS.ERC721)
      if (supportsERC721) {
        contractType = 'ERC721'
        confidence += 40
        
        // Check ERC721 metadata extension
        const supportsMetadata = await this.checkSupportsInterface(address, client, INTERFACE_IDS.ERC721_METADATA)
        if (supportsMetadata) {
          features.push('metadata')
          confidence += 10
        }

        // Check ERC721 enumerable extension
        const supportsEnumerable = await this.checkSupportsInterface(address, client, INTERFACE_IDS.ERC721_ENUMERABLE)
        if (supportsEnumerable) {
          features.push('enumerable')
          confidence += 10
        }
      }

      // Check for ERC1155 support (might also support ERC721, but ERC1155 takes precedence)
      const supportsERC1155 = await this.checkSupportsInterface(address, client, INTERFACE_IDS.ERC1155)
      if (supportsERC1155) {
        contractType = 'ERC1155'
        confidence += 40

        // Check ERC1155 metadata extension
        const supportsMetadata = await this.checkSupportsInterface(address, client, INTERFACE_IDS.ERC1155_METADATA)
        if (supportsMetadata) {
          features.push('metadata')
          confidence += 10
        }
      }

      // Check for ERC2981 royalties support
      const supportsRoyalties = await this.checkSupportsInterface(address, client, INTERFACE_IDS.ERC2981_ROYALTIES)
      if (supportsRoyalties) {
        features.push('royalties')
        confidence += 5
      }

      // If no interface support detected, try method-based detection
      if (contractType === 'UNKNOWN') {
        const methodDetection = await this.detectByMethods(address, client)
        contractType = methodDetection.type
        confidence += methodDetection.confidence
        features.push(...methodDetection.features)
        warnings.push(...methodDetection.warnings)
      }

      // Final validation
      const isValid = contractType !== 'UNKNOWN' && confidence >= 40

      if (!isValid) {
        if (contractType === 'UNKNOWN') {
          errors.push('Contract does not implement ERC721 or ERC1155 standards')
        }
        if (confidence < 40) {
          warnings.push('Low confidence in contract standard detection')
        }
      }

      return {
        isValid,
        contractType,
        confidence: Math.min(confidence, 100),
        features,
        warnings,
        errors
      }

    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return {
        isValid: false,
        contractType: 'UNKNOWN',
        confidence: 0,
        features,
        warnings,
        errors
      }
    }
  }

  /**
   * Check if contract supports a specific interface
   */
  private async checkSupportsInterface(address: Address, client: any, interfaceId: string): Promise<boolean> {
    try {
      const result = await client.readContract({
        address,
        abi: [
          {
            inputs: [{ name: 'interfaceId', type: 'bytes4' }],
            name: 'supportsInterface',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'view',
            type: 'function'
          }
        ],
        functionName: 'supportsInterface',
        args: [interfaceId]
      })
      return Boolean(result)
    } catch (error) {
      return false
    }
  }

  /**
   * Detect contract type by checking method signatures
   */
  private async detectByMethods(address: Address, client: any): Promise<{
    type: 'ERC721' | 'ERC1155' | 'UNKNOWN'
    confidence: number
    features: string[]
    warnings: string[]
  }> {
    const features: string[] = []
    const warnings: string[] = []
    let confidence = 0
    let type: 'ERC721' | 'ERC1155' | 'UNKNOWN' = 'UNKNOWN'

    try {
      // Check for ERC721 methods
      const hasOwnerOf = await this.checkMethodExists(address, client, 'ownerOf', ['uint256'], ['address'])
      const hasTransferFrom = await this.checkMethodExists(address, client, 'transferFrom', ['address', 'address', 'uint256'], [])
      const hasTokenURI = await this.checkMethodExists(address, client, 'tokenURI', ['uint256'], ['string'])

      if (hasOwnerOf && hasTransferFrom) {
        type = 'ERC721'
        confidence += 30
        if (hasTokenURI) {
          features.push('metadata')
          confidence += 10
        }
        warnings.push('Detected ERC721 by method signatures (supportsInterface not implemented)')
      }

      // Check for ERC1155 methods
      const hasBalanceOfBatch = await this.checkMethodExists(address, client, 'balanceOfBatch', ['address[]', 'uint256[]'], ['uint256[]'])
      const hasURI = await this.checkMethodExists(address, client, 'uri', ['uint256'], ['string'])

      if (hasBalanceOfBatch) {
        type = 'ERC1155'
        confidence += 30
        if (hasURI) {
          features.push('metadata')
          confidence += 10
        }
        warnings.push('Detected ERC1155 by method signatures (supportsInterface not implemented)')
      }

      return { type, confidence, features, warnings }

    } catch (error) {
      warnings.push('Method-based detection failed')
      return { type: 'UNKNOWN', confidence: 0, features, warnings }
    }
  }

  /**
   * Check if a method exists by attempting to call it with safe parameters
   */
  private async checkMethodExists(
    address: Address, 
    client: any, 
    methodName: string, 
    inputs: string[], 
    outputs: string[]
  ): Promise<boolean> {
    try {
      const abi = [{
        inputs: inputs.map((type, index) => ({ name: `param${index}`, type })),
        name: methodName,
        outputs: outputs.map((type, index) => ({ name: `output${index}`, type })),
        stateMutability: 'view',
        type: 'function'
      }]

      // Use safe test parameters
      const testArgs = inputs.map(type => {
        if (type === 'uint256') return BigInt(1)
        if (type === 'address') return '0x0000000000000000000000000000000000000001'
        if (type === 'address[]') return ['0x0000000000000000000000000000000000000001']
        if (type === 'uint256[]') return [BigInt(1)]
        return null
      })

      await client.readContract({
        address,
        abi,
        functionName: methodName,
        args: testArgs
      })

      return true
    } catch (error) {
      // Method exists if we get any error other than method not found
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : ''
      return !errorMessage.includes('function') && 
             !errorMessage.includes('method') && 
             !errorMessage.includes('abi')
    }
  }

  /**
   * Get basic contract information
   */
  private async getBasicContractInfo(
    address: Address, 
    client: any, 
    contractType: 'ERC721' | 'ERC1155' | 'UNKNOWN'
  ): Promise<{ name?: string; symbol?: string; totalSupply?: string }> {
    const info: { name?: string; symbol?: string; totalSupply?: string } = {}

    try {
      // Get name
      try {
        const name = await client.readContract({
          address,
          abi: [
            {
              inputs: [],
              name: 'name',
              outputs: [{ name: '', type: 'string' }],
              stateMutability: 'view',
              type: 'function'
            }
          ],
          functionName: 'name'
        })
        info.name = String(name)
      } catch (error) {
        // Name not available
      }

      // Get symbol
      try {
        const symbol = await client.readContract({
          address,
          abi: [
            {
              inputs: [],
              name: 'symbol',
              outputs: [{ name: '', type: 'string' }],
              stateMutability: 'view',
              type: 'function'
            }
          ],
          functionName: 'symbol'
        })
        info.symbol = String(symbol)
      } catch (error) {
        // Symbol not available
      }

      // Get total supply (for ERC721 enumerable or simple contracts)
      if (contractType === 'ERC721') {
        try {
          const totalSupply = await client.readContract({
            address,
            abi: [
              {
                inputs: [],
                name: 'totalSupply',
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
                type: 'function'
              }
            ],
            functionName: 'totalSupply'
          })
          info.totalSupply = String(totalSupply)
        } catch (error) {
          // Total supply not available
        }
      }

      return info
    } catch (error) {
      return info
    }
  }

  /**
   * Get contract deployment block (approximate)
   */
  private async getDeploymentBlock(address: Address, client: any): Promise<number | undefined> {
    try {
      // Binary search for deployment block
      const latestBlock = await client.getBlockNumber()
      let low = BigInt(0)
      let high = latestBlock
      let deploymentBlock: bigint | undefined

      // Simplified binary search (max 20 iterations to avoid too many RPC calls)
      for (let i = 0; i < 20 && low <= high; i++) {
        const mid = (low + high) / BigInt(2)

        try {
          const code = await client.getBytecode({
            address,
            blockNumber: mid
          })

          if (code && code !== '0x') {
            // Contract exists at this block, search earlier
            deploymentBlock = mid
            high = mid - BigInt(1)
          } else {
            // Contract doesn't exist, search later
            low = mid + BigInt(1)
          }
        } catch (error) {
          // If we can't get block, break
          break
        }
      }

      return deploymentBlock ? Number(deploymentBlock) : undefined
    } catch (error) {
      return undefined
    }
  }

  /**
   * Batch detect multiple contracts
   */
  async detectContracts(addresses: string[], chainId: number = 1): Promise<ContractInfo[]> {
    const results = await Promise.allSettled(
      addresses.map(address => this.detectContract(address, chainId))
    )

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          address: addresses[index],
          contractType: 'UNKNOWN' as const,
          isValid: false,
          features: {
            supportsMetadata: false,
            supportsEnumerable: false,
            supportsRoyalties: false,
            supportsInterface: false
          },
          error: `Detection failed: ${result.reason}`,
          chainId
        }
      }
    })
  }
}