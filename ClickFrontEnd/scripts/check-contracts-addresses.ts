import { Pool } from 'pg'

const POSTGRES_URL = "postgres://ca4daf153803706ed28b7b0405128d5897c65b35d96487ed6b0363f56c8c17e6:sk_MLsMuw4nt6ywk9XN19QQw@db.prisma.io:5432/postgres?sslmode=require"

async function checkContracts() {
  const pool = new Pool({ connectionString: POSTGRES_URL })

  try {
    console.log('📦 Contracts in database:')
    const contracts = await pool.query('SELECT id, address, name, is_active FROM contracts ORDER BY id')
    console.table(contracts.rows)

    console.log('\n🔍 Testing JOIN for each contract:')
    for (const contract of contracts.rows) {
      const stats = await pool.query(`
        SELECT
          COUNT(DISTINCT address) FILTER (WHERE CAST(balance AS BIGINT) > 0) as holderCount,
          COUNT(DISTINCT token_id) FILTER (WHERE CAST(balance AS BIGINT) > 0) as uniqueTokens,
          COALESCE(SUM(CAST(balance AS BIGINT)) FILTER (WHERE CAST(balance AS BIGINT) > 0), 0) as totalSupply
        FROM current_state
        WHERE LOWER(contract_address) = LOWER($1)
      `, [contract.address])

      console.log(`\n${contract.name} (${contract.address}):`)
      console.log(`  Holders: ${stats.rows[0].holdercount}`)
      console.log(`  Items: ${stats.rows[0].uniquetokens}`)
      console.log(`  Supply: ${stats.rows[0].totalsupply}`)
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await pool.end()
  }
}

checkContracts()
