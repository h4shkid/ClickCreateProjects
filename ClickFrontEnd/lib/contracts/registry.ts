/**
 * Contract Registry and Management System
 * Manages the database of contracts, metadata, and user associations
 */

import Database from 'better-sqlite3'
import path from 'path'
import { ContractDetector, ContractInfo } from './detector'

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
db.pragma('journal_mode = WAL')

export interface RegisteredContract {
  id: number
  address: string
  name?: string
  symbol?: string
  contractType: 'ERC721' | 'ERC1155'
  chainId: number
  creatorAddress?: string
  deploymentBlock?: number
  totalSupply?: string
  maxSupply?: string
  isVerified: boolean
  isActive: boolean
  description?: string
  websiteUrl?: string
  twitterUrl?: string
  discordUrl?: string
  metadataJson?: string
  addedByUserId?: number
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface ContractSearchResult {
  contracts: RegisteredContract[]
  totalCount: number
  hasMore: boolean
}

export interface ContractRegistrationResult {
  success: boolean
  contract?: RegisteredContract
  error?: string
  warnings?: string[]
}

export class ContractRegistry {
  private detector: ContractDetector

  constructor() {
    this.detector = new ContractDetector()
  }

  /**
   * Register a new contract in the system
   */
  async registerContract(
    address: string, 
    userId?: number, 
    chainId: number = 1,
    metadata?: {
      description?: string
      websiteUrl?: string
      twitterUrl?: string
      discordUrl?: string
    }
  ): Promise<ContractRegistrationResult> {
    try {
      // Normalize address
      const normalizedAddress = address.toLowerCase()

      // Check if contract already exists
      const existing = this.getContractByAddress(normalizedAddress)
      if (existing) {
        return {
          success: false,
          error: 'Contract already registered',
          contract: existing
        }
      }

      // Detect and validate contract
      const contractInfo = await this.detector.detectContract(address, chainId)
      
      if (!contractInfo.isValid) {
        return {
          success: false,
          error: contractInfo.error || 'Contract validation failed'
        }
      }

      // Insert into database
      const insertContract = db.prepare(`
        INSERT INTO contracts (
          address, name, symbol, contract_type, creator_address, deployment_block,
          total_supply, is_verified, description, website_url, twitter_url, 
          discord_url, metadata_json, added_by_user_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id
      `)

      const result = insertContract.get(
        normalizedAddress,
        contractInfo.name,
        contractInfo.symbol,
        contractInfo.contractType,
        null, // creatorAddress - to be detected later
        contractInfo.deploymentBlock,
        contractInfo.totalSupply || '0',
        0, // not verified by default
        metadata?.description,
        metadata?.websiteUrl,
        metadata?.twitterUrl,
        metadata?.discordUrl,
        JSON.stringify({
          features: contractInfo.features,
          detectedAt: new Date().toISOString(),
          chainId
        }),
        userId
      )

      const contractId = result.id

      // Initialize sync status
      const insertSyncStatus = db.prepare(`
        INSERT INTO contract_sync_status (
          contract_id, sync_type, start_block, end_block, current_block, status
        ) VALUES (?, 'initial', ?, ?, ?, 'pending')
      `)

      const currentBlock = contractInfo.deploymentBlock || 0
      insertSyncStatus.run(contractId, currentBlock, currentBlock, currentBlock)

      // Log user activity if user provided
      if (userId) {
        const logActivity = db.prepare(`
          INSERT INTO user_activity (user_id, activity_type, contract_id, metadata)
          VALUES (?, 'contract_added', ?, ?)
        `)

        logActivity.run(
          userId, 
          contractId, 
          JSON.stringify({ 
            contractAddress: normalizedAddress,
            contractType: contractInfo.contractType
          })
        )
      }

      // Get the complete registered contract
      const registeredContract = this.getContractById(contractId)
      
      const warnings: string[] = []
      if (!contractInfo.features.supportsMetadata) {
        warnings.push('Contract does not support metadata - NFT images may not be available')
      }
      if (!contractInfo.features.supportsInterface) {
        warnings.push('Contract does not implement ERC165 - detection reliability may be lower')
      }

      return {
        success: true,
        contract: registeredContract!,
        warnings: warnings.length > 0 ? warnings : undefined
      }

    } catch (error) {
      console.error('Contract registration failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      }
    }
  }

  /**
   * Get contract by address
   */
  getContractByAddress(address: string): RegisteredContract | null {
    const query = db.prepare(`
      SELECT * FROM contracts WHERE address = ? AND is_active = 1
    `)

    const result = query.get(address.toLowerCase())
    return result || null
  }

  /**
   * Get contract by ID
   */
  getContractById(id: number): RegisteredContract | null {
    const query = db.prepare(`
      SELECT * FROM contracts WHERE id = ? AND is_active = 1
    `)

    const result = query.get(id)
    return result || null
  }

  /**
   * Search contracts with filters and pagination
   */
  searchContracts(params: {
    query?: string
    contractType?: 'ERC721' | 'ERC1155'
    isVerified?: boolean
    sortBy?: 'usage' | 'name' | 'created' | 'holders'
    sortOrder?: 'asc' | 'desc'
    limit?: number
    offset?: number
  } = {}): ContractSearchResult {
    const {
      query = '',
      contractType,
      isVerified,
      sortBy = 'usage',
      sortOrder = 'desc',
      limit = 20,
      offset = 0
    } = params

    let whereClause = 'WHERE c.is_active = 1'
    const queryParams: any[] = []

    // Add search filters
    if (query) {
      whereClause += ` AND (
        c.name LIKE ? OR 
        c.symbol LIKE ? OR 
        c.address LIKE ? OR 
        c.description LIKE ?
      )`
      const searchPattern = `%${query}%`
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern)
    }

    if (contractType) {
      whereClause += ' AND c.contract_type = ?'
      queryParams.push(contractType)
    }

    if (isVerified !== undefined) {
      whereClause += ' AND c.is_verified = ?'
      queryParams.push(isVerified ? 1 : 0)
    }

    // Determine sort column
    let orderByClause = ''
    switch (sortBy) {
      case 'usage':
        orderByClause = `ORDER BY c.usage_count ${sortOrder.toUpperCase()}, c.name ASC`
        break
      case 'name':
        orderByClause = `ORDER BY c.name ${sortOrder.toUpperCase()}`
        break
      case 'created':
        orderByClause = `ORDER BY c.created_at ${sortOrder.toUpperCase()}`
        break
      case 'holders':
        orderByClause = `ORDER BY COALESCE(ca.total_holders, 0) ${sortOrder.toUpperCase()}, c.usage_count DESC`
        break
    }

    // Main query with analytics data
    const searchQuery = db.prepare(`
      SELECT 
        c.*,
        ca.total_holders,
        ca.total_supply as analytics_total_supply,
        ca.unique_tokens,
        ca.total_transfers,
        ca.gini_coefficient,
        ca.whale_concentration,
        COUNT(DISTINCT us.user_id) as unique_users,
        COUNT(us.id) as total_snapshots
      FROM contracts c
      LEFT JOIN contract_analytics ca ON c.id = ca.contract_id 
        AND ca.analysis_date = (
          SELECT MAX(analysis_date) 
          FROM contract_analytics 
          WHERE contract_id = c.id
        )
      LEFT JOIN user_snapshots us ON c.id = us.contract_id
      ${whereClause}
      GROUP BY c.id
      ${orderByClause}
      LIMIT ? OFFSET ?
    `)

    queryParams.push(limit, offset)
    const contracts = searchQuery.all(...queryParams)

    // Count total matching contracts
    const countQuery = db.prepare(`
      SELECT COUNT(DISTINCT c.id) as total
      FROM contracts c
      ${whereClause}
    `)

    const countParams = queryParams.slice(0, -2) // Remove limit and offset
    const { total: totalCount } = countQuery.get(...countParams)

    return {
      contracts: contracts.map(this.formatContract),
      totalCount,
      hasMore: offset + contracts.length < totalCount
    }
  }

  /**
   * Get trending contracts based on recent activity
   */
  getTrendingContracts(limit: number = 10): RegisteredContract[] {
    const query = db.prepare(`
      SELECT 
        c.*,
        COUNT(us.id) as recent_snapshots,
        COUNT(DISTINCT us.user_id) as recent_users
      FROM contracts c
      LEFT JOIN user_snapshots us ON c.id = us.contract_id 
        AND us.created_at > datetime('now', '-7 days')
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY (recent_snapshots * 2 + recent_users * 5 + c.usage_count) DESC
      LIMIT ?
    `)

    const results = query.all(limit)
    return results.map(this.formatContract)
  }

  /**
   * Get user's favorite contracts
   */
  getUserFavoriteContracts(userId: number): RegisteredContract[] {
    const query = db.prepare(`
      SELECT c.*
      FROM contracts c
      INNER JOIN user_favorites uf ON c.id = uf.contract_id
      WHERE uf.user_id = ? AND uf.favorite_type = 'contract' AND c.is_active = 1
      ORDER BY uf.created_at DESC
    `)

    const results = query.all(userId)
    return results.map(this.formatContract)
  }

  /**
   * Update contract metadata
   */
  updateContract(
    contractId: number, 
    updates: {
      name?: string
      symbol?: string
      description?: string
      websiteUrl?: string
      twitterUrl?: string
      discordUrl?: string
      isVerified?: boolean
    }
  ): boolean {
    const allowedFields = [
      'name', 'symbol', 'description', 'website_url', 
      'twitter_url', 'discord_url', 'is_verified'
    ]

    const updateFields: string[] = []
    const updateValues: any[] = []

    Object.entries(updates).forEach(([key, value]) => {
      const dbField = key === 'websiteUrl' ? 'website_url' :
                     key === 'twitterUrl' ? 'twitter_url' :
                     key === 'discordUrl' ? 'discord_url' :
                     key === 'isVerified' ? 'is_verified' : key

      if (allowedFields.includes(dbField) && value !== undefined) {
        updateFields.push(`${dbField} = ?`)
        updateValues.push(value)
      }
    })

    if (updateFields.length === 0) {
      return false
    }

    const updateQuery = db.prepare(`
      UPDATE contracts 
      SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    updateValues.push(contractId)
    const result = updateQuery.run(...updateValues)
    
    return result.changes > 0
  }

  /**
   * Increment contract usage count
   */
  incrementUsage(contractId: number): void {
    const query = db.prepare(`
      UPDATE contracts 
      SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)

    query.run(contractId)
  }

  /**
   * Get contract analytics summary
   */
  getContractAnalytics(contractId: number): any {
    const query = db.prepare(`
      SELECT 
        ca.*,
        c.name,
        c.symbol,
        c.contract_type
      FROM contract_analytics ca
      JOIN contracts c ON ca.contract_id = c.id
      WHERE ca.contract_id = ?
      ORDER BY ca.analysis_date DESC
      LIMIT 1
    `)

    return query.get(contractId)
  }

  /**
   * Get contracts requiring sync
   */
  getContractsRequiringSync(): RegisteredContract[] {
    const query = db.prepare(`
      SELECT c.*
      FROM contracts c
      LEFT JOIN contract_sync_status css ON c.id = css.contract_id
      WHERE c.is_active = 1 
      AND (
        css.status = 'pending' OR 
        css.status = 'failed' OR
        css.status IS NULL OR
        css.completed_at < datetime('now', '-1 day')
      )
      ORDER BY c.usage_count DESC, c.created_at ASC
    `)

    const results = query.all()
    return results.map(this.formatContract)
  }

  /**
   * Get all contracts
   */
  getAllContracts(): RegisteredContract[] {
    const query = db.prepare(`
      SELECT * FROM contracts 
      ORDER BY created_at DESC
    `)

    const results = query.all()
    return results.map(this.formatContract)
  }

  /**
   * Format contract for API response
   */
  private formatContract(contract: any): RegisteredContract {
    return {
      id: contract.id,
      address: contract.address,
      name: contract.name,
      symbol: contract.symbol,
      contractType: contract.contract_type,
      chainId: contract.chain_id || 1, // Default to Ethereum if not specified
      creatorAddress: contract.creator_address,
      deploymentBlock: contract.deployment_block,
      totalSupply: contract.total_supply,
      maxSupply: contract.max_supply,
      isVerified: Boolean(contract.is_verified),
      isActive: Boolean(contract.is_active),
      description: contract.description,
      websiteUrl: contract.website_url,
      twitterUrl: contract.twitter_url,
      discordUrl: contract.discord_url,
      metadataJson: contract.metadata_json,
      addedByUserId: contract.added_by_user_id,
      usageCount: contract.usage_count || 0,
      createdAt: contract.created_at,
      updatedAt: contract.updated_at
    }
  }
}