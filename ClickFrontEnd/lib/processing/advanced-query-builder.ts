/**
 * Advanced Query Builder
 * Build complex snapshot queries for artists' use cases:
 * - Airdrop campaigns
 * - Whitelist generation
 * - Holder analysis
 * - Token combination queries
 */

import Database from 'better-sqlite3'
import { getDatabase } from '../database/init'

export interface TokenSelection {
  mode: 'exact' | 'any' | 'all' | 'range' | 'custom'
  tokenIds?: string[]
  range?: { start: number; end: number }
  excludeTokens?: string[]
}

export interface HolderFilters {
  minBalance?: number
  maxBalance?: number
  minTokenCount?: number  // Minimum number of different tokens
  maxTokenCount?: number
  hasCompleteSets?: boolean  // Must own complete set of specified tokens
  minSetsCount?: number  // Minimum number of complete sets
}

export interface TimeFrame {
  type: 'current' | 'historical' | 'comparison'
  date?: string  // YYYY-MM-DD
  blockNumber?: number
  startDate?: string
  endDate?: string
  startBlock?: number
  endBlock?: number
}

export interface SnapshotQuery {
  contractAddress: string
  tokenSelection: TokenSelection
  holderFilters?: HolderFilters
  timeFrame?: TimeFrame
  sortBy?: 'balance' | 'tokenCount' | 'address'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface QueryResult {
  holders: Array<{
    address: string
    totalBalance: string
    tokenCount: number
    tokens: Array<{
      tokenId: string
      balance: string
    }>
    completeSets?: number
    percentage?: number
    rank?: number
  }>
  metadata: {
    query: SnapshotQuery
    totalHolders: number
    totalSupply: string
    uniqueTokens: number
    timestamp: string
    blockNumber?: number
  }
}

export class AdvancedQueryBuilder {
  private db: Database.Database

  constructor() {
    const dbManager = getDatabase()
    this.db = dbManager.getDb()
  }

  /**
   * Execute advanced snapshot query
   */
  async executeQuery(query: SnapshotQuery): Promise<QueryResult> {
    console.log('🔍 Executing advanced query...')
    console.log('Query:', JSON.stringify(query, null, 2))

    // Build SQL query
    const sql = this.buildSQL(query)
    console.log('📊 SQL Query:', sql.query)

    // Execute query
    const results = this.db.prepare(sql.query).all(...sql.params) as any[]
    console.log(`✅ Found ${results.length} holders`)

    // Process and format results
    return this.formatResults(results, query)
  }

  /**
   * Build SQL query from query object
   */
  private buildSQL(query: SnapshotQuery): { query: string; params: any[] } {
    const contractAddress = query.contractAddress.toLowerCase()
    const params: any[] = [contractAddress]

    // Build token filter
    const tokenFilter = this.buildTokenFilter(query.tokenSelection, params)

    // Build holder filters
    const holderFilter = this.buildHolderFilter(query.holderFilters, query.tokenSelection)

    // Build time filter
    const timeFilter = this.buildTimeFilter(query.timeFrame)

    // Build sort clause
    const sortClause = this.buildSortClause(query.sortBy, query.sortOrder)

    // Build pagination
    const pagination = this.buildPagination(query.limit, query.offset)

    // Main query with subquery for holder aggregation
    const sqlQuery = `
      SELECT
        holder_data.address,
        holder_data.total_balance,
        holder_data.token_count,
        holder_data.token_list,
        holder_data.balance_list
      FROM (
        SELECT
          address,
          SUM(CAST(balance AS INTEGER)) as total_balance,
          COUNT(DISTINCT token_id) as token_count,
          GROUP_CONCAT(token_id) as token_list,
          GROUP_CONCAT(balance) as balance_list
        FROM current_state
        WHERE contract_address = ? COLLATE NOCASE
        ${tokenFilter}
        ${timeFilter}
        AND CAST(balance AS INTEGER) > 0
        GROUP BY address
      ) as holder_data
      ${holderFilter}
      ${sortClause}
      ${pagination}
    `

    return { query: sqlQuery, params }
  }

  /**
   * Build token filter SQL
   */
  private buildTokenFilter(selection: TokenSelection, params: any[]): string {
    switch (selection.mode) {
      case 'all':
        // No filter - all tokens
        return ''

      case 'exact':
        // Exact tokens only (will be validated in holder filter)
        if (!selection.tokenIds || selection.tokenIds.length === 0) {
          return ''
        }
        const exactPlaceholders = selection.tokenIds.map(() => '?').join(',')
        params.push(...selection.tokenIds)
        return `AND token_id IN (${exactPlaceholders})`

      case 'any':
        // Any of the specified tokens
        if (!selection.tokenIds || selection.tokenIds.length === 0) {
          return ''
        }
        const anyPlaceholders = selection.tokenIds.map(() => '?').join(',')
        params.push(...selection.tokenIds)
        return `AND token_id IN (${anyPlaceholders})`

      case 'range':
        // Token ID range
        if (!selection.range) {
          return ''
        }
        const rangeTokens = Array.from(
          { length: selection.range.end - selection.range.start + 1 },
          (_, i) => selection.range!.start + i
        )
        const filtered = rangeTokens.filter(
          t => !selection.excludeTokens?.includes(String(t))
        )
        const rangePlaceholders = filtered.map(() => '?').join(',')
        params.push(...filtered.map(String))
        return `AND token_id IN (${rangePlaceholders})`

      case 'custom':
        // Custom logic - combine multiple conditions
        if (selection.tokenIds) {
          const customPlaceholders = selection.tokenIds.map(() => '?').join(',')
          params.push(...selection.tokenIds)
          let filter = `AND token_id IN (${customPlaceholders})`

          if (selection.excludeTokens && selection.excludeTokens.length > 0) {
            const excludePlaceholders = selection.excludeTokens.map(() => '?').join(',')
            params.push(...selection.excludeTokens)
            filter += ` AND token_id NOT IN (${excludePlaceholders})`
          }

          return filter
        }
        return ''

      default:
        return ''
    }
  }

  /**
   * Build holder filter SQL (HAVING clause)
   */
  private buildHolderFilter(
    filters: HolderFilters | undefined,
    tokenSelection: TokenSelection
  ): string {
    if (!filters) {
      return ''
    }

    const conditions: string[] = []

    // Minimum balance filter
    if (filters.minBalance !== undefined) {
      conditions.push(`total_balance >= ${filters.minBalance}`)
    }

    // Maximum balance filter
    if (filters.maxBalance !== undefined) {
      conditions.push(`total_balance <= ${filters.maxBalance}`)
    }

    // Minimum token count filter
    if (filters.minTokenCount !== undefined) {
      conditions.push(`token_count >= ${filters.minTokenCount}`)
    }

    // Maximum token count filter
    if (filters.maxTokenCount !== undefined) {
      conditions.push(`token_count <= ${filters.maxTokenCount}`)
    }

    // Complete set filter (must own ALL specified tokens)
    if (filters.hasCompleteSets && tokenSelection.tokenIds) {
      const requiredCount = tokenSelection.tokenIds.length
      conditions.push(`token_count >= ${requiredCount}`)
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  }

  /**
   * Build time filter SQL
   */
  private buildTimeFilter(timeFrame: TimeFrame | undefined): string {
    // For now, we only support current state
    // Historical queries will be implemented separately
    return ''
  }

  /**
   * Build sort clause
   */
  private buildSortClause(sortBy?: string, sortOrder?: string): string {
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC'

    switch (sortBy) {
      case 'balance':
        return `ORDER BY total_balance ${order}`
      case 'tokenCount':
        return `ORDER BY token_count ${order}, total_balance DESC`
      case 'address':
        return `ORDER BY address ${order}`
      default:
        return 'ORDER BY total_balance DESC'
    }
  }

  /**
   * Build pagination clause
   */
  private buildPagination(limit?: number, offset?: number): string {
    if (limit === undefined) {
      return ''
    }
    const offsetClause = offset ? ` OFFSET ${offset}` : ''
    return `LIMIT ${limit}${offsetClause}`
  }

  /**
   * Format query results
   */
  private formatResults(results: any[], query: SnapshotQuery): QueryResult {
    let totalSupply = BigInt(0)
    const tokenSet = new Set<string>()

    const holders = results.map((row, index) => {
      const tokenList = row.token_list ? row.token_list.split(',') : []
      const balanceList = row.balance_list ? row.balance_list.split(',') : []

      const tokens = tokenList.map((tokenId: string, i: number) => {
        tokenSet.add(tokenId)
        return {
          tokenId,
          balance: balanceList[i] || '0'
        }
      })

      const totalBalance = BigInt(row.total_balance || 0)
      totalSupply += totalBalance

      // Calculate complete sets if applicable
      let completeSets: number | undefined
      if (query.tokenSelection.tokenIds && query.holderFilters?.hasCompleteSets) {
        const tokenBalances = tokens.reduce((acc: Record<string, bigint>, t: any) => {
          acc[t.tokenId] = BigInt(t.balance)
          return acc
        }, {} as Record<string, bigint>)

        const setBalances = query.tokenSelection.tokenIds
          .map(tokenId => tokenBalances[tokenId] || BigInt(0))
          .filter(b => b > 0)

        if (setBalances.length === query.tokenSelection.tokenIds.length) {
          completeSets = Number(setBalances.reduce((min, b) => b < min ? b : min))
        }
      }

      return {
        address: row.address,
        totalBalance: row.total_balance.toString(),
        tokenCount: row.token_count,
        tokens,
        completeSets,
        rank: index + 1
      }
    })

    // Calculate percentages
    holders.forEach((holder: any) => {
      if (totalSupply > 0) {
        holder.percentage = Number(
          (BigInt(holder.totalBalance) * BigInt(10000) / totalSupply)
        ) / 100
      }
    })

    return {
      holders,
      metadata: {
        query,
        totalHolders: holders.length,
        totalSupply: totalSupply.toString(),
        uniqueTokens: tokenSet.size,
        timestamp: new Date().toISOString(),
        blockNumber: undefined  // Will be added for historical queries
      }
    }
  }

  /**
   * Validate query before execution
   */
  validateQuery(query: SnapshotQuery): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate contract address
    if (!query.contractAddress || !/^0x[a-fA-F0-9]{40}$/.test(query.contractAddress)) {
      errors.push('Invalid contract address')
    }

    // Validate token selection
    if (query.tokenSelection.mode === 'exact' && !query.tokenSelection.tokenIds?.length) {
      errors.push('Exact mode requires at least one token ID')
    }

    if (query.tokenSelection.mode === 'range' && !query.tokenSelection.range) {
      errors.push('Range mode requires range definition')
    }

    // Validate filters
    if (query.holderFilters) {
      if (query.holderFilters.minBalance !== undefined && query.holderFilters.minBalance < 0) {
        errors.push('Minimum balance cannot be negative')
      }

      if (
        query.holderFilters.minBalance !== undefined &&
        query.holderFilters.maxBalance !== undefined &&
        query.holderFilters.minBalance > query.holderFilters.maxBalance
      ) {
        errors.push('Minimum balance cannot be greater than maximum balance')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get query statistics without full execution (for preview)
   */
  async getQueryStatistics(query: SnapshotQuery): Promise<{
    estimatedHolders: number
    estimatedTokens: number
    totalSupply: string
  }> {
    const sql = this.buildSQL(query)

    // Count query (without pagination)
    const countQuery = `
      SELECT COUNT(*) as count
      FROM (
        ${sql.query.replace(/LIMIT \d+( OFFSET \d+)?$/, '')}
      )
    `

    const result = this.db.prepare(countQuery).get(...sql.params) as any

    // Get token count
    const contractAddress = query.contractAddress.toLowerCase()
    const tokenCountResult = this.db.prepare(`
      SELECT COUNT(DISTINCT token_id) as token_count
      FROM current_state
      WHERE contract_address = ? COLLATE NOCASE
      AND CAST(balance AS INTEGER) > 0
    `).get(contractAddress) as any

    // Get total supply
    const supplyResult = this.db.prepare(`
      SELECT SUM(CAST(balance AS INTEGER)) as total_supply
      FROM current_state
      WHERE contract_address = ? COLLATE NOCASE
      AND CAST(balance AS INTEGER) > 0
    `).get(contractAddress) as any

    return {
      estimatedHolders: result?.count || 0,
      estimatedTokens: tokenCountResult?.token_count || 0,
      totalSupply: supplyResult?.total_supply?.toString() || '0'
    }
  }
}
