import { Pool } from 'pg'

const POSTGRES_URL = process.env.POSTGRES_URL || "postgres://ca4daf153803706ed28b7b0405128d5897c65b35d96487ed6b0363f56c8c17e6:sk_MLsMuw4nt6ywk9XN19QQw@db.prisma.io:5432/postgres?sslmode=require"

async function rebuildAllContracts() {
  const pool = new Pool({ connectionString: POSTGRES_URL })

  console.log(`\n🔧 Rebuilding current_state for ALL contracts`)
  console.log('═'.repeat(80))

  try {
    // Get all active contracts
    const contracts = await pool.query('SELECT address, name, symbol FROM contracts WHERE is_active = true ORDER BY id')

    console.log(`\nFound ${contracts.rows.length} active contracts\n`)

    for (const contract of contracts.rows) {
      console.log(`\n${'─'.repeat(80)}`)
      console.log(`📦 ${contract.name} (${contract.symbol})`)
      console.log(`   Address: ${contract.address}`)

      // Delete existing state
      await pool.query(
        'DELETE FROM current_state WHERE LOWER(contract_address) = LOWER($1)',
        [contract.address]
      )

      // Rebuild from events
      const result = await pool.query(`
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
        RETURNING 1
      `, [contract.address])

      // Get stats
      const stats = await pool.query(`
        SELECT
          COUNT(*) as total_positions,
          COUNT(DISTINCT address) as unique_holders,
          COUNT(DISTINCT token_id) as unique_tokens,
          SUM(CAST(balance AS BIGINT)) as total_supply
        FROM current_state
        WHERE LOWER(contract_address) = LOWER($1)
          AND CAST(balance AS BIGINT) > 0
      `, [contract.address])

      const s = stats.rows[0]
      console.log(`   ✅ Rebuilt: ${s.unique_holders} holders, ${s.unique_tokens} tokens, ${s.total_supply} supply`)
    }

    console.log(`\n${'═'.repeat(80)}`)
    console.log(`✅ All contracts rebuilt successfully!`)

  } catch (error) {
    console.error('\n❌ Error:', error)
  } finally {
    await pool.end()
  }
}

rebuildAllContracts()
