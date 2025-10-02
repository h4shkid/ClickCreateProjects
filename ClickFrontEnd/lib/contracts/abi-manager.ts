/**
 * Dynamic ABI Management System
 * Handles standard and custom ABIs for different contract types
 */

import fs from 'fs'
import path from 'path'

// Standard ERC-721 ABI
export const ERC721_ABI = [
  // ERC165
  {
    inputs: [{ name: 'interfaceId', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  // ERC721 Core
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    name: 'transferFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'getApproved',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' }
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'operator', type: 'address' }
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  // ERC721 Metadata
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  // ERC721 Enumerable (optional)
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'index', type: 'uint256' }],
    name: 'tokenByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' }
    ],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' }
    ],
    name: 'Transfer',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'approved', type: 'address' },
      { indexed: true, name: 'tokenId', type: 'uint256' }
    ],
    name: 'Approval',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: true, name: 'operator', type: 'address' },
      { indexed: false, name: 'approved', type: 'bool' }
    ],
    name: 'ApprovalForAll',
    type: 'event'
  }
] as const

// Standard ERC-1155 ABI (existing)
export const ERC1155_ABI = [
  {
    inputs: [{ name: 'interfaceId', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'id', type: 'uint256' }
    ],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'accounts', type: 'address[]' },
      { name: 'ids', type: 'uint256[]' }
    ],
    name: 'balanceOfBatch',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'uri',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' }
    ],
    name: 'setApprovalForAll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' }
    ],
    name: 'isApprovedForAll',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'operator', type: 'address' },
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'id', type: 'uint256' },
      { indexed: false, name: 'value', type: 'uint256' }
    ],
    name: 'TransferSingle',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'operator', type: 'address' },
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
      { indexed: false, name: 'ids', type: 'uint256[]' },
      { indexed: false, name: 'values', type: 'uint256[]' }
    ],
    name: 'TransferBatch',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'value', type: 'string' },
      { indexed: true, name: 'id', type: 'uint256' }
    ],
    name: 'URI',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'account', type: 'address' },
      { indexed: true, name: 'operator', type: 'address' },
      { indexed: false, name: 'approved', type: 'bool' }
    ],
    name: 'ApprovalForAll',
    type: 'event'
  }
] as const

// Common interface for royalties (ERC2981)
export const ERC2981_ABI = [
  {
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'salePrice', type: 'uint256' }
    ],
    name: 'royaltyInfo',
    outputs: [
      { name: 'receiver', type: 'address' },
      { name: 'royaltyAmount', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const

export interface AbiFunction {
  inputs: Array<{ name: string; type: string }>
  name: string
  outputs: Array<{ name: string; type: string }>
  stateMutability: 'view' | 'pure' | 'nonpayable' | 'payable'
  type: 'function'
}

export interface AbiEvent {
  anonymous: boolean
  inputs: Array<{ indexed: boolean; name: string; type: string }>
  name: string
  type: 'event'
}

export type AbiItem = AbiFunction | AbiEvent

export interface ContractAbi {
  contractAddress: string
  contractType: 'ERC721' | 'ERC1155' | 'CUSTOM'
  abi: AbiItem[]
  functions: string[]
  events: string[]
  isStandard: boolean
  customFeatures?: string[]
}

export class AbiManager {
  private customAbis: Map<string, ContractAbi> = new Map()
  private abiCache: Map<string, AbiItem[]> = new Map()

  /**
   * Get ABI for a contract address
   */
  getContractAbi(
    contractAddress: string, 
    contractType: 'ERC721' | 'ERC1155',
    customAbi?: AbiItem[]
  ): ContractAbi {
    const normalizedAddress = contractAddress.toLowerCase()

    // Check for custom ABI first
    if (customAbi) {
      return this.processCustomAbi(normalizedAddress, customAbi)
    }

    // Check cache
    const cached = this.customAbis.get(normalizedAddress)
    if (cached) {
      return cached
    }

    // Return standard ABI
    return this.getStandardAbi(normalizedAddress, contractType)
  }

  /**
   * Get standard ABI for contract type
   */
  private getStandardAbi(contractAddress: string, contractType: 'ERC721' | 'ERC1155'): ContractAbi {
    const abi = contractType === 'ERC721' ? ERC721_ABI : ERC1155_ABI
    
    const functions = abi
      .filter(item => item.type === 'function')
      .map(item => item.name)

    const events = abi
      .filter(item => item.type === 'event')
      .map(item => item.name)

    return {
      contractAddress,
      contractType,
      abi: abi as unknown as AbiItem[],
      functions,
      events,
      isStandard: true
    }
  }

  /**
   * Process and validate custom ABI
   */
  private processCustomAbi(contractAddress: string, customAbi: AbiItem[]): ContractAbi {
    // Validate ABI structure
    const validatedAbi = this.validateAbi(customAbi)
    
    const functions = validatedAbi
      .filter(item => item.type === 'function')
      .map(item => item.name)

    const events = validatedAbi
      .filter(item => item.type === 'event')
      .map(item => item.name)

    // Detect contract type from ABI
    const contractType = this.detectContractTypeFromAbi(validatedAbi)
    
    // Detect custom features
    const customFeatures = this.detectCustomFeatures(validatedAbi)

    const contractAbi: ContractAbi = {
      contractAddress,
      contractType: contractType || 'CUSTOM',
      abi: validatedAbi,
      functions,
      events,
      isStandard: false,
      customFeatures
    }

    // Cache the custom ABI
    this.customAbis.set(contractAddress, contractAbi)

    return contractAbi
  }

  /**
   * Validate ABI structure
   */
  private validateAbi(abi: any[]): AbiItem[] {
    const validatedAbi: AbiItem[] = []

    for (const item of abi) {
      try {
        if (item.type === 'function') {
          // Validate function structure
          if (typeof item.name === 'string' && Array.isArray(item.inputs) && Array.isArray(item.outputs)) {
            validatedAbi.push({
              inputs: item.inputs.map((input: any) => ({
                name: input.name || '',
                type: input.type || 'bytes'
              })),
              name: item.name,
              outputs: item.outputs.map((output: any) => ({
                name: output.name || '',
                type: output.type || 'bytes'
              })),
              stateMutability: item.stateMutability || 'view',
              type: 'function'
            })
          }
        } else if (item.type === 'event') {
          // Validate event structure
          if (typeof item.name === 'string' && Array.isArray(item.inputs)) {
            validatedAbi.push({
              anonymous: Boolean(item.anonymous),
              inputs: item.inputs.map((input: any) => ({
                indexed: Boolean(input.indexed),
                name: input.name || '',
                type: input.type || 'bytes'
              })),
              name: item.name,
              type: 'event'
            })
          }
        }
      } catch (error) {
        console.warn('Invalid ABI item skipped:', item)
      }
    }

    return validatedAbi
  }

  /**
   * Detect contract type from ABI
   */
  private detectContractTypeFromAbi(abi: AbiItem[]): 'ERC721' | 'ERC1155' | null {
    const functionNames = abi
      .filter(item => item.type === 'function')
      .map(item => item.name)

    // ERC721 indicators
    const hasOwnerOf = functionNames.includes('ownerOf')
    const hasTokenURI = functionNames.includes('tokenURI')
    const hasTransferFrom = functionNames.includes('transferFrom')

    if (hasOwnerOf && hasTransferFrom) {
      return 'ERC721'
    }

    // ERC1155 indicators
    const hasBalanceOfBatch = functionNames.includes('balanceOfBatch')
    const hasURI = functionNames.includes('uri')
    const hasTransferSingle = abi.some(item => 
      item.type === 'event' && item.name === 'TransferSingle'
    )

    if (hasBalanceOfBatch || (hasURI && hasTransferSingle)) {
      return 'ERC1155'
    }

    return null
  }

  /**
   * Detect custom features from ABI
   */
  private detectCustomFeatures(abi: AbiItem[]): string[] {
    const features: string[] = []
    const functionNames = abi
      .filter(item => item.type === 'function')
      .map(item => item.name)

    // Common custom features
    if (functionNames.includes('mint')) {
      features.push('minting')
    }

    if (functionNames.includes('burn')) {
      features.push('burning')
    }

    if (functionNames.includes('pause') || functionNames.includes('unpause')) {
      features.push('pausable')
    }

    if (functionNames.includes('royaltyInfo')) {
      features.push('royalties')
    }

    if (functionNames.includes('setBaseURI') || functionNames.includes('setTokenURI')) {
      features.push('mutable-metadata')
    }

    if (functionNames.some(name => name.includes('reveal'))) {
      features.push('reveal-mechanism')
    }

    if (functionNames.some(name => name.includes('whitelist') || name.includes('allowlist'))) {
      features.push('allowlist')
    }

    if (functionNames.includes('stake') || functionNames.includes('unstake')) {
      features.push('staking')
    }

    return features
  }

  /**
   * Get minimal ABI for basic operations
   */
  getMinimalAbi(contractType: 'ERC721' | 'ERC1155'): AbiItem[] {
    if (contractType === 'ERC721') {
      return ERC721_ABI.filter(item => 
        item.type === 'event' || 
        (item.type === 'function' && [
          'balanceOf', 'ownerOf', 'tokenURI', 'name', 'symbol', 'totalSupply'
        ].includes(item.name))
      ) as AbiItem[]
    } else {
      return ERC1155_ABI.filter(item =>
        item.type === 'event' ||
        (item.type === 'function' && [
          'balanceOf', 'balanceOfBatch', 'uri'
        ].includes(item.name))
      ) as AbiItem[]
    }
  }

  /**
   * Merge standard ABI with custom extensions
   */
  mergeAbis(standardType: 'ERC721' | 'ERC1155', customAbi: AbiItem[]): AbiItem[] {
    const standardAbi = standardType === 'ERC721' ? ERC721_ABI : ERC1155_ABI
    const merged = [...standardAbi as AbiItem[]]

    // Add custom functions and events that don't conflict
    for (const customItem of customAbi) {
      const exists = merged.some(standardItem => 
        standardItem.name === customItem.name && standardItem.type === customItem.type
      )

      if (!exists) {
        merged.push(customItem)
      }
    }

    return merged
  }

  /**
   * Store custom ABI for a contract
   */
  storeCustomAbi(contractAddress: string, abi: AbiItem[]): void {
    const contractAbi = this.processCustomAbi(contractAddress.toLowerCase(), abi)
    this.customAbis.set(contractAddress.toLowerCase(), contractAbi)
  }

  /**
   * Get all stored custom ABIs
   */
  getCustomAbis(): Map<string, ContractAbi> {
    return new Map(this.customAbis)
  }

  /**
   * Remove custom ABI for a contract
   */
  removeCustomAbi(contractAddress: string): boolean {
    return this.customAbis.delete(contractAddress.toLowerCase())
  }

  /**
   * Get ABI for specific function
   */
  getFunctionAbi(contractAddress: string, functionName: string): AbiFunction | null {
    const contractAbi = this.customAbis.get(contractAddress.toLowerCase())
    
    if (contractAbi) {
      const func = contractAbi.abi.find(item => 
        item.type === 'function' && item.name === functionName
      ) as AbiFunction
      return func || null
    }

    // Check standard ABIs
    const erc721Func = ERC721_ABI.find(item => 
      item.type === 'function' && item.name === functionName
    ) as AbiFunction

    if (erc721Func) return erc721Func

    const erc1155Func = ERC1155_ABI.find(item => 
      item.type === 'function' && item.name === functionName
    ) as AbiFunction

    return erc1155Func || null
  }

  /**
   * Get ABI for specific event
   */
  getEventAbi(contractAddress: string, eventName: string): AbiEvent | null {
    const contractAbi = this.customAbis.get(contractAddress.toLowerCase())
    
    if (contractAbi) {
      const event = contractAbi.abi.find(item => 
        item.type === 'event' && item.name === eventName
      ) as AbiEvent
      return event || null
    }

    // Check standard ABIs
    const erc721Event = ERC721_ABI.find(item => 
      item.type === 'event' && item.name === eventName
    ) as AbiEvent

    if (erc721Event) return erc721Event

    const erc1155Event = ERC1155_ABI.find(item => 
      item.type === 'event' && item.name === eventName
    ) as AbiEvent

    return erc1155Event || null
  }
}