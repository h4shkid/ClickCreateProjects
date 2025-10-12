import { Pool } from 'pg'

const POSTGRES_URL = process.env.POSTGRES_URL!

async function main() {
  const pool = new Pool({ connectionString: POSTGRES_URL })

  const result = await pool.query(`
    SELECT address, name, contract_type, deployment_block, is_active
    FROM contracts
    ORDER BY is_active DESC, id DESC
  `)

  console.log('All Contracts:')
  for (const row of result.rows) {
    console.log(`  ${row.is_active ? '✓' : '✗'} ${row.address} - ${row.name} (${row.contract_type}) - Block: ${row.deployment_block}`)
  }

  await pool.end()
}

main().catch(console.error)
