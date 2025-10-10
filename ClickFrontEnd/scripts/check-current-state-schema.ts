import { Pool } from 'pg'

const POSTGRES_URL = "postgres://ca4daf153803706ed28b7b0405128d5897c65b35d96487ed6b0363f56c8c17e6:sk_MLsMuw4nt6ywk9XN19QQw@db.prisma.io:5432/postgres?sslmode=require"

async function checkSchema() {
  const pool = new Pool({ connectionString: POSTGRES_URL })

  try {
    // Check current_state table structure
    console.log('📋 Current State Table Structure:')
    const schema = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'current_state'
      ORDER BY ordinal_position
    `)
    console.table(schema.rows)

    // Check sample data
    console.log('\n📊 Sample current_state data (first 5 rows):')
    const sample = await pool.query('SELECT * FROM current_state LIMIT 5')
    console.table(sample.rows)

    // Check if contract_address column exists
    console.log('\n🔍 Checking for contract_address column...')
    const hasColumn = schema.rows.find(r => r.column_name === 'contract_address')
    if (hasColumn) {
      console.log('✅ contract_address column exists')

      // Check distinct contract addresses
      const contracts = await pool.query('SELECT DISTINCT contract_address FROM current_state')
      console.log(`\n📦 Found ${contracts.rows.length} distinct contract addresses:`)
      contracts.rows.forEach(r => console.log(`  - ${r.contract_address}`))
    } else {
      console.log('❌ contract_address column MISSING!')
    }

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await pool.end()
  }
}

checkSchema()
