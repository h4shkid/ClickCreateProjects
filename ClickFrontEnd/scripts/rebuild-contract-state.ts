import { Pool } from 'pg'

const POSTGRES_URL = process.env.POSTGRES_URL || "postgres://ca4daf153803706ed28b7b0405128d5897c65b35d96487ed6b0363f56c8c17e6:sk_MLsMuw4nt6ywk9XN19QQw@db.prisma.io:5432/postgres?sslmode=require"

async function rebuildContractState(contractAddress: string) {
  const pool = new Pool({ connectionString: POSTGRES_URL })

  console.log(`\n🔧 Rebuilding current_state for: ${contractAddress}`)
  console.log('─'.repeat(80))

  try {
    // Step 1: Get contract info
    const contractResult = await pool.query(
      'SELECT name, symbol FROM contracts WHERE LOWER(address) = LOWER($1)',
      [contractAddress]
    )

    if (contractResult.rows.length === 0) {
      console.log('❌ Contract not found')
      return
    }

    const contract = contractResult.rows[0]
    console.log(`📦 Contract: ${contract.name} (${contract.symbol})`)

    // Step 2: Check current state
    const beforeStats = await pool.query(`
      SELECT
        COUNT(*) as total_positions,
        COUNT(DISTINCT address) as unique_holders,
        COUNT(DISTINCT token_id) as unique_tokens
      FROM current_state
      WHERE LOWER(contract_address) = LOWER($1)
        AND CAST(balance AS BIGINT) > 0
    `, [contractAddress])

    console.log(`\n📊 Before rebuild:`)
    console.log(`   Positions: ${beforeStats.rows[0].total_positions}`)
    console.log(`   Holders: ${beforeStats.rows[0].unique_holders}`)
    console.log(`   Tokens: ${beforeStats.rows[0].unique_tokens}`)

    // Step 3: Delete existing state
    console.log(`\n🗑️  Deleting old state...`)
    await pool.query(
      'DELETE FROM current_state WHERE LOWER(contract_address) = LOWER($1)',
      [contractAddress]
    )
    console.log('   ✅ Deleted')

    // Step 4: Rebuild from events using proper balance calculation
    console.log(`\n🔄 Rebuilding state from events...`)

    await pool.query(`
      INSERT INTO current_state (contract_address, address, token_id, balance, last_updated_block, updated_at)
      WITH balance_changes AS (
        SELECT
          from_address as holder,
          token_id,
          block_number,
          log_index,
          -CAST(amount AS BIGINT) as amount_change
        FROM events
        WHERE LOWER(contract_address) = LOWER($1)
          AND from_address != '0x0000000000000000000000000000000000000000'

        UNION ALL

        SELECT
          to_address as holder,
          token_id,
          block_number,
          log_index,
          CAST(amount AS BIGINT) as amount_change
        FROM events
        WHERE LOWER(contract_address) = LOWER($1)
          AND to_address != '0x0000000000000000000000000000000000000000'
      ),
      final_balances AS (
        SELECT
          holder as address,
          token_id,
          SUM(amount_change) as final_balance,
          MAX(block_number) as last_block
        FROM balance_changes
        GROUP BY holder, token_id
        HAVING SUM(amount_change) > 0
      )
      SELECT
        $1 as contract_address,
        address,
        token_id,
        final_balance::text as balance,
        last_block as last_updated_block,
        NOW() as updated_at
      FROM final_balances
    `, [contractAddress])

    console.log('   ✅ State rebuilt')

    // Step 5: Show new state
    const afterStats = await pool.query(`
      SELECT
        COUNT(*) as total_positions,
        COUNT(DISTINCT address) as unique_holders,
        COUNT(DISTINCT token_id) as unique_tokens,
        SUM(CAST(balance AS BIGINT)) as total_supply
      FROM current_state
      WHERE LOWER(contract_address) = LOWER($1)
        AND CAST(balance AS BIGINT) > 0
    `, [contractAddress])

    console.log(`\n📊 After rebuild:`)
    console.log(`   Positions: ${afterStats.rows[0].total_positions}`)
    console.log(`   Holders: ${afterStats.rows[0].unique_holders}`)
    console.log(`   Tokens: ${afterStats.rows[0].unique_tokens}`)
    console.log(`   Total Supply: ${afterStats.rows[0].total_supply}`)

    const diff = parseInt(afterStats.rows[0].total_positions) - parseInt(beforeStats.rows[0].total_positions)
    if (diff > 0) {
      console.log(`\n✅ Fixed! Added ${diff} missing positions`)
    } else if (diff < 0) {
      console.log(`\n✅ Cleaned! Removed ${Math.abs(diff)} incorrect positions`)
    } else {
      console.log(`\n✅ No changes needed`)
    }

  } catch (error) {
    console.error('\n❌ Error:', error)
  } finally {
    await pool.end()
  }
}

// Run
const contractAddress = process.argv[2]

if (!contractAddress) {
  console.log('Usage: npx tsx scripts/rebuild-contract-state.ts <contract-address>')
  console.log('\nExample:')
  console.log('  npx tsx scripts/rebuild-contract-state.ts 0xb8ea78fcacef50d41375e44e6814ebba36bb33c4')
  process.exit(1)
}

rebuildContractState(contractAddress)
