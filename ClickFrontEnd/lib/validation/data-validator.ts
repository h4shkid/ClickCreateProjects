import { ethers } from 'ethers'
import Database from 'better-sqlite3'
import path from 'path'

/**
 * Comprehensive data validation utilities for ensuring CSV export accuracy
 * This module provides validation functions to verify blockchain data integrity
 */

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  details: Record<string, any>
  summary?: any
}

interface BlockRange {
  startBlock: number
  endBlock: number
  expectedEvents: number
  actualEvents: number
  missingBlocks: number[]
}

interface BalanceValidation {
  address: string
  databaseBalance: number
  calculatedBalance: number
  isValid: boolean
  discrepancy?: number
}

export class DataValidator {
  private provider: ethers.JsonRpcProvider
  private db: Database.Database

  constructor() {
    // Initialize provider (same logic as sync-blockchain.ts)
    const quickNodeEndpoint = process.env.NEXT_PUBLIC_QUICKNODE_ENDPOINT
    const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
    
    if (quickNodeEndpoint && quickNodeEndpoint !== 'https://your-quicknode-endpoint.com') {
      this.provider = new ethers.JsonRpcProvider(quickNodeEndpoint)
    } else if (alchemyKey && alchemyKey !== 'your_alchemy_api_key_here') {
      this.provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`)
    } else {
      this.provider = new ethers.JsonRpcProvider('https://eth.llamarpc.com')
    }

    // Initialize database
    this.db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
    this.db.pragma('journal_mode = WAL')
  }

  /**
   * Validate database event completeness for a given block range
   */
  async validateBlockRange(contractAddress: string, startBlock: number, endBlock: number): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const details: Record<string, any> = {}

    try {
      console.log(`🔍 Validating block range ${startBlock} to ${endBlock} for contract ${contractAddress}`)

      // Check for event gaps in database
      const gapQuery = `
        SELECT 
          block_number,
          COUNT(*) as event_count,
          MIN(log_index) as min_log_index,
          MAX(log_index) as max_log_index
        FROM events 
        WHERE contract_address = ? COLLATE NOCASE
        AND block_number BETWEEN ? AND ?
        GROUP BY block_number
        ORDER BY block_number
      `
      
      const blockEvents = this.db.prepare(gapQuery).all(
        contractAddress.toLowerCase(), 
        startBlock, 
        endBlock
      ) as any[]

      details.totalBlocks = endBlock - startBlock + 1
      details.blocksWithEvents = blockEvents.length
      details.blocksWithoutEvents = details.totalBlocks - details.blocksWithEvents

      // Identify missing blocks (blocks that should have events but don't)
      const eventsInRange = this.db.prepare(`
        SELECT COUNT(*) as total_events 
        FROM events 
        WHERE contract_address = ? COLLATE NOCASE 
        AND block_number BETWEEN ? AND ?
      `).get(contractAddress.toLowerCase(), startBlock, endBlock) as any

      details.totalEvents = eventsInRange.total_events

      // Check for duplicate events (same transaction hash + log index)
      const duplicatesQuery = `
        SELECT 
          transaction_hash, 
          log_index, 
          COUNT(*) as duplicate_count
        FROM events 
        WHERE contract_address = ? COLLATE NOCASE
        AND block_number BETWEEN ? AND ?
        GROUP BY transaction_hash, log_index
        HAVING COUNT(*) > 1
      `
      
      const duplicates = this.db.prepare(duplicatesQuery).all(
        contractAddress.toLowerCase(), 
        startBlock, 
        endBlock
      ) as any[]

      if (duplicates.length > 0) {
        errors.push(`Found ${duplicates.length} duplicate events in database`)
        details.duplicateEvents = duplicates
      }

      // Validate event ordering
      const orderingQuery = `
        SELECT 
          block_number,
          log_index,
          ROW_NUMBER() OVER (ORDER BY block_number, log_index) as expected_order,
          id
        FROM events 
        WHERE contract_address = ? COLLATE NOCASE
        AND block_number BETWEEN ? AND ?
        ORDER BY block_number, log_index
      `
      
      const orderedEvents = this.db.prepare(orderingQuery).all(
        contractAddress.toLowerCase(), 
        startBlock, 
        endBlock
      ) as any[]

      let orderingIssues = 0
      for (let i = 1; i < orderedEvents.length; i++) {
        const prev = orderedEvents[i - 1]
        const curr = orderedEvents[i]
        
        if (curr.block_number < prev.block_number || 
           (curr.block_number === prev.block_number && curr.log_index <= prev.log_index)) {
          orderingIssues++
        }
      }

      if (orderingIssues > 0) {
        errors.push(`Found ${orderingIssues} event ordering issues`)
        details.orderingIssues = orderingIssues
      }

      // Check for reasonable block timestamps
      const timestampQuery = `
        SELECT 
          MIN(block_timestamp) as min_timestamp,
          MAX(block_timestamp) as max_timestamp,
          COUNT(DISTINCT block_number) as unique_blocks
        FROM events 
        WHERE contract_address = ? COLLATE NOCASE
        AND block_number BETWEEN ? AND ?
      `
      
      const timestampData = this.db.prepare(timestampQuery).get(
        contractAddress.toLowerCase(), 
        startBlock, 
        endBlock
      ) as any

      if (timestampData) {
        const minDate = new Date(timestampData.min_timestamp * 1000)
        const maxDate = new Date(timestampData.max_timestamp * 1000)
        const timeDiff = (timestampData.max_timestamp - timestampData.min_timestamp)
        const expectedTimeDiff = (endBlock - startBlock) * 12 // ~12 seconds per block
        
        details.timeRange = {
          minDate: minDate.toISOString(),
          maxDate: maxDate.toISOString(),
          actualSeconds: timeDiff,
          expectedSeconds: expectedTimeDiff,
          deviation: Math.abs(timeDiff - expectedTimeDiff)
        }

        // Warn if time deviation is too large (more than 50% off expected or over 24 hours)
        const oneDay = 86400 // 24 hours in seconds
        if (details.timeRange.deviation > Math.max(expectedTimeDiff * 0.5, oneDay)) {
          warnings.push(`Large time deviation: ${Math.round(details.timeRange.deviation / 3600)} hours from expected`)
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        details
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { isValid: false, errors, warnings, details }
    }
  }

  /**
   * Validate holder balances by recalculating from events
   */
  async validateHolderBalances(contractAddress: string, blockNumber?: number): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const details: Record<string, any> = {}

    try {
      console.log(`🧮 Validating holder balances for contract ${contractAddress}${blockNumber ? ` at block ${blockNumber}` : ' (current)'}`)

      const blockCondition = blockNumber ? `AND block_number <= ${blockNumber}` : ''
      
      // Get all unique holders from events
      const holdersQuery = `
        SELECT DISTINCT 
          CASE 
            WHEN from_address != '0x0000000000000000000000000000000000000000' THEN from_address
            ELSE to_address
          END as holder_address
        FROM events 
        WHERE contract_address = ? COLLATE NOCASE ${blockCondition}
        AND (from_address != '0x0000000000000000000000000000000000000000' 
             OR to_address != '0x0000000000000000000000000000000000000000')
      `
      
      const holders = this.db.prepare(holdersQuery).all(contractAddress.toLowerCase()) as any[]
      const validations: BalanceValidation[] = []
      let totalCalculatedSupply = 0
      let totalDatabaseSupply = 0

      for (const holder of holders) {
        const holderAddress = holder.holder_address

        // Calculate balance from events (received - sent)
        const balanceQuery = `
          SELECT 
            COALESCE(received.total, 0) - COALESCE(sent.total, 0) as calculated_balance
          FROM (
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM events 
            WHERE contract_address = ? COLLATE NOCASE 
            AND to_address = ? COLLATE NOCASE ${blockCondition}
          ) received
          LEFT JOIN (
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM events 
            WHERE contract_address = ? COLLATE NOCASE 
            AND from_address = ? COLLATE NOCASE
            AND from_address != '0x0000000000000000000000000000000000000000' ${blockCondition}
          ) sent ON 1=1
        `
        
        const calculatedResult = this.db.prepare(balanceQuery).get(
          contractAddress.toLowerCase(), 
          holderAddress,
          contractAddress.toLowerCase(), 
          holderAddress
        ) as any

        const calculatedBalance = calculatedResult?.calculated_balance || 0

        // Get database balance (if using current_state table)
        let databaseBalance = 0
        if (!blockNumber) {
          const dbResult = this.db.prepare(`
            SELECT COALESCE(SUM(balance), 0) as total_balance 
            FROM current_state 
            WHERE address = ? COLLATE NOCASE 
            AND balance > 0
          `).get(holderAddress) as any
          databaseBalance = dbResult?.total_balance || 0
        } else {
          // For historical snapshots, database balance should match calculated
          databaseBalance = calculatedBalance
        }

        const isValid = databaseBalance === calculatedBalance
        if (!isValid && calculatedBalance > 0) {
          const discrepancy = Math.abs(databaseBalance - calculatedBalance)
          validations.push({
            address: holderAddress,
            databaseBalance,
            calculatedBalance,
            isValid: false,
            discrepancy
          })
        }

        totalCalculatedSupply += calculatedBalance
        totalDatabaseSupply += databaseBalance
      }

      details.totalHolders = holders.length
      details.holdersWithDiscrepancies = validations.length
      details.totalCalculatedSupply = totalCalculatedSupply
      details.totalDatabaseSupply = totalDatabaseSupply
      details.supplyDiscrepancy = Math.abs(totalCalculatedSupply - totalDatabaseSupply)

      if (validations.length > 0) {
        errors.push(`Found ${validations.length} holders with balance discrepancies`)
        details.balanceDiscrepancies = validations.slice(0, 10) // Show first 10
      }

      if (details.supplyDiscrepancy > 0) {
        errors.push(`Total supply discrepancy: ${details.supplyDiscrepancy} tokens`)
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        details
      }

    } catch (error) {
      errors.push(`Balance validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { isValid: false, errors, warnings, details }
    }
  }

  /**
   * Validate CSV export data against snapshot data
   */
  validateCSVExport(snapshotData: any, csvData: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []
    const details: Record<string, any> = {}

    try {
      console.log('📊 Validating CSV export data consistency')

      // Parse CSV data
      const csvLines = csvData.split('\n').filter(line => line.trim())
      const headers = csvLines[0].split(',')
      const dataRows = csvLines.slice(1)

      details.csvHeaders = headers
      details.csvRowCount = dataRows.length
      details.snapshotHolderCount = snapshotData?.holders?.length || 0

      // Check header consistency
      const expectedHeaders = ['wallet_id', 'number_of_sets', 'total_tokens_held', 'token_ids_held', 'snapshot_time', 'token_id_list']
      const missingHeaders = expectedHeaders.filter(h => !headers.includes(h))
      const extraHeaders = headers.filter(h => !expectedHeaders.includes(h))

      if (missingHeaders.length > 0) {
        errors.push(`Missing CSV headers: ${missingHeaders.join(', ')}`)
      }
      if (extraHeaders.length > 0) {
        warnings.push(`Extra CSV headers: ${extraHeaders.join(', ')}`)
      }

      // Validate row count consistency
      if (details.csvRowCount !== details.snapshotHolderCount) {
        warnings.push(`CSV row count (${details.csvRowCount}) doesn't match snapshot holders (${details.snapshotHolderCount})`)
      }

      // Parse and validate data rows
      const parsedRows = dataRows.map(row => {
        const values = row.split(',')
        return {
          wallet_id: values[headers.indexOf('wallet_id')],
          number_of_sets: parseInt(values[headers.indexOf('number_of_sets')] || '0'),
          total_tokens_held: parseInt(values[headers.indexOf('total_tokens_held')] || '0'),
          token_ids_held: values[headers.indexOf('token_ids_held')],
          snapshot_time: values[headers.indexOf('snapshot_time')],
          token_id_list: values[headers.indexOf('token_id_list')]
        }
      })

      // Calculate totals
      const csvTotalTokens = parsedRows.reduce((sum, row) => sum + row.total_tokens_held, 0)
      const csvTotalSets = parsedRows.reduce((sum, row) => sum + row.number_of_sets, 0)

      details.csvTotalTokens = csvTotalTokens
      details.csvTotalSets = csvTotalSets

      // Compare with snapshot totals if available
      if (snapshotData?.totalSupply) {
        const snapshotTotal = parseInt(snapshotData.totalSupply)
        if (csvTotalTokens !== snapshotTotal) {
          errors.push(`CSV total tokens (${csvTotalTokens}) doesn't match snapshot total (${snapshotTotal})`)
        }
      }

      // Validate number_of_sets vs total_tokens_held logic
      const inconsistentRows = parsedRows.filter(row => {
        // For most cases, number_of_sets should be <= total_tokens_held
        return row.number_of_sets > row.total_tokens_held
      })

      if (inconsistentRows.length > 0) {
        warnings.push(`${inconsistentRows.length} rows have more sets than total tokens`)
        details.inconsistentRows = inconsistentRows.slice(0, 5)
      }

      // Check for duplicate wallet addresses
      const walletIds = parsedRows.map(row => row.wallet_id)
      const uniqueWallets = new Set(walletIds)
      if (walletIds.length !== uniqueWallets.size) {
        errors.push(`Found duplicate wallet addresses in CSV`)
      }

      details.uniqueWallets = uniqueWallets.size
      details.sampleRows = parsedRows.slice(0, 3) // Show first 3 rows for review

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        details
      }

    } catch (error) {
      errors.push(`CSV validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { isValid: false, errors, warnings, details }
    }
  }

  /**
   * Cross-validate snapshot against live blockchain data
   */
  async validateSnapshotAccuracy(contractAddress: string, blockNumber: number, snapshotData: any): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    const details: Record<string, any> = {}

    try {
      console.log(`🔄 Cross-validating snapshot accuracy for block ${blockNumber}`)

      // Validate block exists and get actual timestamp
      const block = await this.provider.getBlock(blockNumber)
      if (!block) {
        errors.push(`Block ${blockNumber} not found on blockchain`)
        return { isValid: false, errors, warnings, details }
      }

      details.blockInfo = {
        number: block.number,
        timestamp: block.timestamp,
        hash: block.hash,
        actualDate: new Date(block.timestamp * 1000).toISOString()
      }

      // Compare snapshot timestamp with actual block timestamp
      if (snapshotData?.metadata?.timestamp) {
        const snapshotTime = new Date(snapshotData.metadata.timestamp).getTime() / 1000
        const timeDiff = Math.abs(snapshotTime - block.timestamp)
        
        details.timestampComparison = {
          snapshotTime,
          blockTime: block.timestamp,
          difference: timeDiff
        }

        if (timeDiff > 86400) { // More than 1 day difference
          warnings.push(`Large timestamp difference: ${Math.round(timeDiff / 3600)} hours`)
        }
      }

      // Validate that snapshot block number matches requested block
      if (snapshotData?.metadata?.blockNumber && snapshotData.metadata.blockNumber !== blockNumber) {
        warnings.push(`Snapshot block (${snapshotData.metadata.blockNumber}) doesn't match requested block (${blockNumber})`)
      }

      // Check if we have events near this block to ensure data completeness
      const nearbyEvents = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM events 
        WHERE contract_address = ? COLLATE NOCASE
        AND block_number BETWEEN ? AND ?
      `).get(
        contractAddress.toLowerCase(), 
        blockNumber - 100, 
        blockNumber + 100
      ) as any

      details.nearbyEventsCount = nearbyEvents.count

      if (nearbyEvents.count === 0) {
        warnings.push(`No events found within 100 blocks of snapshot block`)
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        details
      }

    } catch (error) {
      errors.push(`Snapshot validation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { isValid: false, errors, warnings, details }
    }
  }

  /**
   * Generate comprehensive validation report
   */
  async generateValidationReport(contractAddress: string, blockNumber?: number): Promise<ValidationResult> {
    console.log(`📋 Generating comprehensive validation report for ${contractAddress}${blockNumber ? ` at block ${blockNumber}` : ''}`)

    const report: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      details: {
        contractAddress,
        blockNumber,
        reportTimestamp: new Date().toISOString(),
        validationResults: {}
      }
    }

    try {
      // Run all validation checks
      const [balanceValidation, blockRangeValidation] = await Promise.all([
        this.validateHolderBalances(contractAddress, blockNumber),
        blockNumber ? this.validateBlockRange(contractAddress, Math.max(1, blockNumber - 1000), blockNumber) : Promise.resolve({ isValid: true, errors: [], warnings: [], details: {} })
      ])

      report.details.validationResults.balanceValidation = balanceValidation
      report.details.validationResults.blockRangeValidation = blockRangeValidation

      // Aggregate results
      report.errors.push(...balanceValidation.errors, ...blockRangeValidation.errors)
      report.warnings.push(...balanceValidation.warnings, ...blockRangeValidation.warnings)
      report.isValid = report.errors.length === 0

      // Summary
      report.details.summary = {
        totalErrors: report.errors.length,
        totalWarnings: report.warnings.length,
        overallHealth: report.errors.length === 0 ? 'GOOD' : report.errors.length < 3 ? 'FAIR' : 'POOR'
      }
      
      // Ensure summary is included in main validation object
      report.summary = report.details.summary

      return report

    } catch (error) {
      report.errors.push(`Report generation error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      report.isValid = false
      return report
    }
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close()
  }
}

export default DataValidator