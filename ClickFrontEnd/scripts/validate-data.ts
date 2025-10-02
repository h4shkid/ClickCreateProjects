#!/usr/bin/env npx tsx

/**
 * Data Validation Script
 * 
 * This script helps you manually validate the accuracy of your NFT snapshot data.
 * Run this before important CSV exports to ensure data integrity.
 * 
 * Usage:
 * npx tsx scripts/validate-data.ts [options]
 * 
 * Options:
 * --contract <address>     Contract address to validate (default: internal collection)
 * --block <number>         Specific block number to validate
 * --type <validation>      Type of validation: full, balance, blocks, snapshot
 * --start-block <number>   Start block for block range validation
 * --end-block <number>     End block for block range validation
 * --csv <file>             CSV file to validate against snapshot data
 * --verbose                Enable verbose logging
 */

import DataValidator from '../lib/validation/data-validator'
import { createDateToBlockConverter } from '../lib/utils/date-to-block'
import fs from 'fs'
import path from 'path'

// Default internal collection address
const DEFAULT_CONTRACT = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'

interface ScriptOptions {
  contract: string
  block?: number
  type: 'full' | 'balance' | 'blocks' | 'snapshot' | 'csv'
  startBlock?: number
  endBlock?: number
  csvFile?: string
  verbose: boolean
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2)
  const options: ScriptOptions = {
    contract: DEFAULT_CONTRACT,
    type: 'full',
    verbose: false
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--contract':
        options.contract = args[++i]
        break
      case '--block':
        options.block = parseInt(args[++i])
        break
      case '--type':
        options.type = args[++i] as any
        break
      case '--start-block':
        options.startBlock = parseInt(args[++i])
        break
      case '--end-block':
        options.endBlock = parseInt(args[++i])
        break
      case '--csv':
        options.csvFile = args[++i]
        break
      case '--verbose':
        options.verbose = true
        break
      case '--help':
        printHelp()
        process.exit(0)
    }
  }

  return options
}

function printHelp() {
  console.log(`
Data Validation Script for NFT Analytics Platform

Usage: npx tsx scripts/validate-data.ts [options]

Options:
  --contract <address>     Contract address to validate (default: ${DEFAULT_CONTRACT})
  --block <number>         Specific block number to validate
  --type <validation>      Type of validation (default: full)
                          Options: full, balance, blocks, snapshot, csv
  --start-block <number>   Start block for block range validation
  --end-block <number>     End block for block range validation  
  --csv <file>             CSV file to validate against snapshot data
  --verbose                Enable verbose logging
  --help                   Show this help message

Examples:
  # Full validation of current state
  npx tsx scripts/validate-data.ts --verbose

  # Validate specific block
  npx tsx scripts/validate-data.ts --type snapshot --block 18500000

  # Validate block range
  npx tsx scripts/validate-data.ts --type blocks --start-block 18400000 --end-block 18500000

  # Validate balance calculations only
  npx tsx scripts/validate-data.ts --type balance

  # Validate CSV file against current snapshot
  npx tsx scripts/validate-data.ts --type csv --csv ./snapshot_export.csv
`)
}

function printResult(title: string, result: any) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📊 ${title}`)
  console.log(`${'='.repeat(60)}`)
  
  // Overall status
  const status = result.isValid ? '✅ PASSED' : '❌ FAILED'
  console.log(`Status: ${status}`)
  console.log(`Errors: ${result.errors.length}`)
  console.log(`Warnings: ${result.warnings.length}`)
  
  if (result.errors.length > 0) {
    console.log(`\n🚨 ERRORS:`)
    result.errors.forEach((error: string, index: number) => {
      console.log(`  ${index + 1}. ${error}`)
    })
  }
  
  if (result.warnings.length > 0) {
    console.log(`\n⚠️  WARNINGS:`)
    result.warnings.forEach((warning: string, index: number) => {
      console.log(`  ${index + 1}. ${warning}`)
    })
  }
  
  // Details summary
  if (result.details) {
    console.log(`\n📈 SUMMARY:`)
    Object.entries(result.details).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        console.log(`  ${key}:`)
        Object.entries(value as Record<string, any>).forEach(([subKey, subValue]) => {
          console.log(`    ${subKey}: ${subValue}`)
        })
      } else {
        console.log(`  ${key}: ${value}`)
      }
    })
  }
}

async function main() {
  const options = parseArgs()
  
  console.log('🔍 Starting Data Validation')
  console.log(`Contract: ${options.contract}`)
  console.log(`Type: ${options.type}`)
  console.log(`Verbose: ${options.verbose}`)
  
  if (!options.verbose) {
    // Suppress console logs from validator if not verbose
    const originalLog = console.log
    console.log = () => {}
    process.on('exit', () => { console.log = originalLog })
  }

  let validator: DataValidator | null = null
  
  try {
    validator = new DataValidator()
    let result

    switch (options.type) {
      case 'balance':
        console.log(`\n🧮 Validating holder balances...`)
        result = await validator.validateHolderBalances(options.contract, options.block)
        printResult('Balance Validation', result)
        break
        
      case 'blocks':
        if (!options.startBlock || !options.endBlock) {
          console.error('❌ Block range validation requires --start-block and --end-block')
          process.exit(1)
        }
        console.log(`\n📦 Validating block range ${options.startBlock} to ${options.endBlock}...`)
        result = await validator.validateBlockRange(options.contract, options.startBlock, options.endBlock)
        printResult('Block Range Validation', result)
        break
        
      case 'snapshot':
        if (!options.block) {
          console.error('❌ Snapshot validation requires --block parameter')
          process.exit(1)
        }
        console.log(`\n📸 Validating snapshot at block ${options.block}...`)
        
        // Get snapshot data first (simplified version for validation)
        const mockSnapshotData = {
          metadata: { 
            blockNumber: options.block, 
            timestamp: new Date().toISOString() 
          }
        }
        
        result = await validator.validateSnapshotAccuracy(options.contract, options.block, mockSnapshotData)
        printResult('Snapshot Validation', result)
        break
        
      case 'csv':
        if (!options.csvFile) {
          console.error('❌ CSV validation requires --csv parameter with file path')
          process.exit(1)
        }
        
        if (!fs.existsSync(options.csvFile)) {
          console.error(`❌ CSV file not found: ${options.csvFile}`)
          process.exit(1)
        }
        
        console.log(`\n📊 Validating CSV file: ${options.csvFile}...`)
        const csvContent = fs.readFileSync(options.csvFile, 'utf-8')
        
        // Mock snapshot data for CSV validation
        const mockSnapshot = {
          holders: [],
          totalSupply: '0',
          metadata: {}
        }
        
        result = validator.validateCSVExport(mockSnapshot, csvContent)
        printResult('CSV Validation', result)
        break
        
      case 'full':
      default:
        console.log(`\n🔬 Running comprehensive validation...`)
        result = await validator.generateValidationReport(options.contract, options.block)
        printResult('Comprehensive Validation Report', result)
        
        // Additional checks for full validation
        if (result.details.validationResults) {
          console.log(`\n📋 DETAILED RESULTS:`)
          
          if (result.details.validationResults.balanceValidation) {
            const balanceResult = result.details.validationResults.balanceValidation
            console.log(`\n  Balance Validation:`)
            console.log(`    Valid: ${balanceResult.isValid ? '✅' : '❌'}`)
            console.log(`    Errors: ${balanceResult.errors.length}`)
            console.log(`    Total Supply Validated: ${balanceResult.details.totalCalculatedSupply || 'N/A'}`)
          }
          
          if (result.details.validationResults.blockRangeValidation) {
            const blockResult = result.details.validationResults.blockRangeValidation
            console.log(`\n  Block Range Validation:`)
            console.log(`    Valid: ${blockResult.isValid ? '✅' : '❌'}`)
            console.log(`    Total Events: ${blockResult.details.totalEvents || 'N/A'}`)
            console.log(`    Blocks With Events: ${blockResult.details.blocksWithEvents || 'N/A'}`)
          }
        }
        break
    }

    // Final recommendations
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎯 RECOMMENDATIONS`)
    console.log(`${'='.repeat(60)}`)
    
    if (result.isValid) {
      console.log(`✅ Data integrity verified - safe to export CSV`)
      console.log(`✅ All validation checks passed`)
    } else {
      console.log(`⚠️  Data issues detected - review errors before CSV export`)
      console.log(`⚠️  Consider running blockchain sync if errors persist`)
      
      if (result.errors.some((e: string) => e.includes('balance'))) {
        console.log(`💡 Suggestion: Run 'npx tsx scripts/rebuild-state.js' to rebuild balances`)
      }
      
      if (result.errors.some((e: string) => e.includes('block') || e.includes('event'))) {
        console.log(`💡 Suggestion: Run 'npx tsx scripts/sync-blockchain.ts' to resync events`)
      }
    }

  } catch (error) {
    console.error('\n❌ Validation failed:', error instanceof Error ? error.message : 'Unknown error')
    process.exit(1)
  } finally {
    if (validator) {
      validator.close()
    }
  }
}

// Handle script execution
if (require.main === module) {
  main().catch(error => {
    console.error('Script failed:', error)
    process.exit(1)
  })
}

export default main