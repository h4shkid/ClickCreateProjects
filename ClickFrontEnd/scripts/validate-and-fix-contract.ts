import { Pool } from 'pg'
import { ethers } from 'ethers'

const POSTGRES_URL = process.env.POSTGRES_URL || "postgres://ca4daf153803706ed28b7b0405128d5897c65b35d96487ed6b0363f56c8c17e6:sk_MLsMuw4nt6ywk9XN19QQw@db.prisma.io:5432/postgres?sslmode=require"
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "8_iY3mDKZOYuNM_fBzS-eIBMq9Sz1x-P"

interface ValidationIssue {
  type: 'missing_events' | 'duplicate_events' | 'state_mismatch' | 'supply_mismatch'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  count?: number
  details?: any
}

async function validateAndFixContract(contractAddress: string, autoFix: boolean = false) {
  const pool = new Pool({ connectionString: POSTGRES_URL })
  const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)

  console.log(`\n🔍 Validating contract: ${contractAddress}`)
  console.log(`   Auto-fix mode: ${autoFix ? 'ON' : 'OFF'}`)
  console.log('─'.repeat(80))

  const issues: ValidationIssue[] = []

  try {
    // 1. Get contract info
    const contractResult = await pool.query(
      'SELECT * FROM contracts WHERE LOWER(address) = LOWER($1)',
      [contractAddress]
    )

    if (contractResult.rows.length === 0) {
      console.log('❌ Contract not found in database')
      return
    }

    const contract = contractResult.rows[0]
    console.log(`\n📦 Contract: ${contract.name} (${contract.symbol})`)
    console.log(`   Type: ${contract.contract_type}`)
    console.log(`   Deployment Block: ${contract.deployment_block}`)

    // 2. Check for duplicate events
    console.log('\n🔍 Checking for duplicate events...')
    const duplicates = await pool.query(`
      SELECT transaction_hash, log_index, COUNT(*) as count
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
      GROUP BY transaction_hash, log_index
      HAVING COUNT(*) > 1
    `, [contractAddress])

    if (duplicates.rows.length > 0) {
      const totalDupes = duplicates.rows.reduce((sum, row) => sum + (parseInt(row.count) - 1), 0)
      issues.push({
        type: 'duplicate_events',
        severity: 'high',
        description: `Found ${totalDupes} duplicate events`,
        count: totalDupes,
        details: duplicates.rows
      })
      console.log(`❌ Found ${totalDupes} duplicate events`)

      if (autoFix) {
        console.log('   🔧 Removing duplicates...')
        await pool.query(`
          DELETE FROM events
          WHERE id IN (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (
                PARTITION BY transaction_hash, log_index
                ORDER BY id
              ) as rn
              FROM events
              WHERE LOWER(contract_address) = LOWER($1)
            ) t
            WHERE t.rn > 1
          )
        `, [contractAddress])
        console.log('   ✅ Duplicates removed')
      }
    } else {
      console.log('✅ No duplicate events found')
    }

    // 3. Check event gaps (missing blocks)
    console.log('\n🔍 Checking for event gaps...')
    const blockRange = await pool.query(`
      SELECT
        MIN(block_number) as first_block,
        MAX(block_number) as last_block,
        COUNT(DISTINCT block_number) as unique_blocks,
        MAX(block_number) - MIN(block_number) + 1 as expected_blocks
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
    `, [contractAddress])

    const { first_block, last_block, unique_blocks, expected_blocks } = blockRange.rows[0]
    const missingBlocks = parseInt(expected_blocks) - parseInt(unique_blocks)

    if (missingBlocks > expected_blocks * 0.01) { // More than 1% missing
      issues.push({
        type: 'missing_events',
        severity: 'high',
        description: `Potentially missing events in ${missingBlocks} blocks`,
        count: missingBlocks
      })
      console.log(`⚠️  Event coverage: ${unique_blocks}/${expected_blocks} blocks (${missingBlocks} missing)`)
    } else {
      console.log(`✅ Event coverage: ${unique_blocks}/${expected_blocks} blocks`)
    }

    // 4. Validate supply against blockchain
    console.log('\n🔍 Checking on-chain supply...')
    const dbSupply = await pool.query(`
      SELECT
        COUNT(DISTINCT token_id) FILTER (WHERE CAST(balance AS BIGINT) > 0) as unique_tokens,
        SUM(CAST(balance AS BIGINT)) FILTER (WHERE CAST(balance AS BIGINT) > 0) as total_supply
      FROM current_state
      WHERE LOWER(contract_address) = LOWER($1)
    `, [contractAddress])

    const dbUniqueTokens = parseInt(dbSupply.rows[0].unique_tokens || 0)
    const dbTotalSupply = BigInt(dbSupply.rows[0].total_supply || 0)

    console.log(`   Database: ${dbUniqueTokens} unique tokens, ${dbTotalSupply} total supply`)

    // Get on-chain supply (ERC721: totalSupply, ERC1155: harder to verify)
    if (contract.contract_type === 'ERC721') {
      try {
        const abi = ['function totalSupply() view returns (uint256)']
        const tokenContract = new ethers.Contract(contractAddress, abi, provider)
        const onChainSupply = await tokenContract.totalSupply()

        console.log(`   On-chain: ${onChainSupply} total supply`)

        const difference = Math.abs(Number(onChainSupply) - Number(dbTotalSupply))
        if (difference > 0) {
          issues.push({
            type: 'supply_mismatch',
            severity: difference > 10 ? 'high' : 'medium',
            description: `Supply mismatch: DB=${dbTotalSupply}, Chain=${onChainSupply}`,
            count: difference
          })
          console.log(`❌ Supply mismatch: ${difference} tokens difference`)
        } else {
          console.log('✅ Supply matches on-chain')
        }
      } catch (err) {
        console.log('⚠️  Could not verify on-chain supply (contract may not have totalSupply)')
      }
    }

    // 5. Check current_state consistency
    console.log('\n🔍 Checking current_state consistency...')
    const stateCheck = await pool.query(`
      WITH event_balances AS (
        SELECT
          to_address as address,
          token_id,
          SUM(CASE
            WHEN to_address != '0x0000000000000000000000000000000000000000' THEN CAST(amount AS BIGINT)
            ELSE 0
          END) - SUM(CASE
            WHEN from_address != '0x0000000000000000000000000000000000000000' THEN CAST(amount AS BIGINT)
            ELSE 0
          END) as calculated_balance
        FROM events
        WHERE LOWER(contract_address) = LOWER($1)
        GROUP BY to_address, token_id
      )
      SELECT COUNT(*) as mismatches
      FROM event_balances eb
      LEFT JOIN current_state cs ON
        LOWER(eb.address) = LOWER(cs.address) AND
        eb.token_id = cs.token_id AND
        LOWER(cs.contract_address) = LOWER($1)
      WHERE eb.calculated_balance != COALESCE(CAST(cs.balance AS BIGINT), 0)
        AND eb.calculated_balance > 0
    `, [contractAddress])

    const mismatches = parseInt(stateCheck.rows[0].mismatches)
    if (mismatches > 0) {
      issues.push({
        type: 'state_mismatch',
        severity: 'critical',
        description: `${mismatches} addresses have incorrect balances`,
        count: mismatches
      })
      console.log(`❌ Found ${mismatches} state mismatches`)

      if (autoFix) {
        console.log('   🔧 Rebuilding current_state from events...')

        // Delete existing state for this contract
        await pool.query(
          'DELETE FROM current_state WHERE LOWER(contract_address) = LOWER($1)',
          [contractAddress]
        )

        // Rebuild from events
        await pool.query(`
          INSERT INTO current_state (contract_address, address, token_id, balance, last_updated_block, updated_at)
          SELECT
            $1 as contract_address,
            holder_address as address,
            token_id,
            balance::text,
            MAX(block_number) as last_updated_block,
            NOW() as updated_at
          FROM (
            SELECT
              CASE
                WHEN to_address != '0x0000000000000000000000000000000000000000' THEN to_address
                ELSE from_address
              END as holder_address,
              token_id,
              block_number,
              SUM(
                CASE
                  WHEN to_address != '0x0000000000000000000000000000000000000000' THEN CAST(amount AS BIGINT)
                  ELSE -CAST(amount AS BIGINT)
                END
              ) OVER (
                PARTITION BY
                  CASE
                    WHEN to_address != '0x0000000000000000000000000000000000000000' THEN to_address
                    ELSE from_address
                  END,
                  token_id
                ORDER BY block_number, log_index
              ) as balance
            FROM events
            WHERE LOWER(contract_address) = LOWER($1)
          ) balances
          WHERE holder_address != '0x0000000000000000000000000000000000000000'
          GROUP BY holder_address, token_id, balance
          HAVING balance > 0
          ON CONFLICT (contract_address, token_id, address) DO UPDATE SET
            balance = EXCLUDED.balance,
            last_updated_block = EXCLUDED.last_updated_block,
            updated_at = EXCLUDED.updated_at
        `, [contractAddress])

        console.log('   ✅ Current state rebuilt')
      }
    } else {
      console.log('✅ Current state is consistent')
    }

    // 6. Summary
    console.log('\n' + '═'.repeat(80))
    console.log('📊 VALIDATION SUMMARY')
    console.log('═'.repeat(80))

    if (issues.length === 0) {
      console.log('✅ No issues found! Contract data is healthy.')
    } else {
      console.log(`Found ${issues.length} issue(s):\n`)
      issues.forEach((issue, i) => {
        const icon = issue.severity === 'critical' ? '🔴' : issue.severity === 'high' ? '🟠' : issue.severity === 'medium' ? '🟡' : '🟢'
        console.log(`${i + 1}. ${icon} [${issue.severity.toUpperCase()}] ${issue.description}`)
      })

      if (!autoFix) {
        console.log('\n💡 Run with --fix flag to automatically fix issues')
      }
    }

    // Final stats
    const finalStats = await pool.query(`
      SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT token_id) as unique_tokens,
        COUNT(DISTINCT CONCAT(address, token_id)) as unique_positions
      FROM current_state
      WHERE LOWER(contract_address) = LOWER($1)
        AND CAST(balance AS BIGINT) > 0
    `, [contractAddress])

    console.log('\n📈 Final Statistics:')
    console.log(`   Total Events: ${finalStats.rows[0].total_events}`)
    console.log(`   Unique Tokens: ${finalStats.rows[0].unique_tokens}`)
    console.log(`   Active Positions: ${finalStats.rows[0].unique_positions}`)

  } catch (error) {
    console.error('\n❌ Validation error:', error)
  } finally {
    await pool.end()
  }
}

// Run
const contractAddress = process.argv[2]
const autoFix = process.argv.includes('--fix')

if (!contractAddress) {
  console.log('Usage: npx tsx scripts/validate-and-fix-contract.ts <contract-address> [--fix]')
  console.log('\nExample:')
  console.log('  npx tsx scripts/validate-and-fix-contract.ts 0x059edd72cd353df5106d2b9cc5ab83a52287ac3a')
  console.log('  npx tsx scripts/validate-and-fix-contract.ts 0x059edd72cd353df5106d2b9cc5ab83a52287ac3a --fix')
  process.exit(1)
}

validateAndFixContract(contractAddress, autoFix)
