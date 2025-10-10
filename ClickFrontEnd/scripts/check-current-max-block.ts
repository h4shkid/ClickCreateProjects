import { Pool } from 'pg'

const POSTGRES_URL = process.env.POSTGRES_URL
if (!POSTGRES_URL) {
  console.error('❌ POSTGRES_URL environment variable is required')
  process.exit(1)
}

const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
})

async function checkCurrentMaxBlock() {
  const client = await pool.connect()

  try {
    const contractAddress = '0x33fd426905f149f8376e227d0c9d3340aad17af1'

    console.log('🔍 Checking current max block in Postgres...\n')

    // Check with exact query the API uses
    const result1 = await client.query(`
      SELECT
        COUNT(*) as total_events,
        MIN(block_number) as first_block,
        MAX(block_number) as last_block,
        MIN(block_timestamp) as first_timestamp,
        MAX(block_timestamp) as last_timestamp
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
    `, [contractAddress.toLowerCase()])

    console.log('📊 API Query Result (with LOWER):')
    console.log(result1.rows[0])

    // Check without LOWER
    const result2 = await client.query(`
      SELECT
        COUNT(*) as total_events,
        MAX(block_number) as last_block
      FROM events
      WHERE contract_address = $1
    `, [contractAddress.toLowerCase()])

    console.log('\n📊 Direct Query Result (without LOWER):')
    console.log(result2.rows[0])

    // Check what contract_address values actually exist
    const result3 = await client.query(`
      SELECT DISTINCT contract_address, COUNT(*) as count
      FROM events
      WHERE contract_address ILIKE $1
      GROUP BY contract_address
    `, [`%${contractAddress}%`])

    console.log('\n📊 Distinct contract_address values in DB:')
    result3.rows.forEach(row => {
      console.log(`   "${row.contract_address}" - ${row.count} events`)
    })

    // Get latest 5 events
    const result4 = await client.query(`
      SELECT block_number, transaction_hash, block_timestamp
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
      ORDER BY block_number DESC
      LIMIT 5
    `, [contractAddress.toLowerCase()])

    console.log('\n📊 Latest 5 events:')
    result4.rows.forEach(row => {
      const date = new Date(row.block_timestamp * 1000)
      console.log(`   Block ${row.block_number} - ${row.transaction_hash.substring(0, 10)}... (${date.toISOString()})`)
    })

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

checkCurrentMaxBlock().catch(console.error)
