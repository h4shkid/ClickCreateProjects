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

async function debugMaxBlock() {
  const client = await pool.connect()

  try {
    const contractAddress = '0x33fd426905f149f8376e227d0c9d3340aad17af1'

    console.log('🔍 Debugging MAX(block_number) query...\n')

    // This is what the worker uses
    console.log('📊 Worker query (with LOWER):')
    const workerQuery = await client.query(
      'SELECT MAX(block_number) as last_block FROM events WHERE LOWER(contract_address) = $1',
      [contractAddress]
    )
    console.log('   Result:', workerQuery.rows[0])

    // Try without LOWER
    console.log('\n📊 Query without LOWER:')
    const noLowerQuery = await client.query(
      'SELECT MAX(block_number) as last_block FROM events WHERE contract_address = $1',
      [contractAddress]
    )
    console.log('   Result:', noLowerQuery.rows[0])

    // Check actual contract_address values in DB
    console.log('\n📊 Distinct contract_address values:')
    const distinctQuery = await client.query(`
      SELECT DISTINCT contract_address, COUNT(*) as count
      FROM events
      WHERE contract_address ILIKE $1
      GROUP BY contract_address
    `, [`%${contractAddress}%`])
    distinctQuery.rows.forEach(row => {
      console.log(`   "${row.contract_address}" (${row.count} events)`)
    })

    // Check case sensitivity
    console.log('\n📊 Testing case variations:')
    const variations = [
      contractAddress.toLowerCase(),
      contractAddress.toUpperCase(),
      contractAddress
    ]

    for (const variation of variations) {
      const result = await client.query(
        'SELECT COUNT(*) as count, MAX(block_number) as max_block FROM events WHERE contract_address = $1',
        [variation]
      )
      console.log(`   ${variation}: ${result.rows[0].count} events, max block ${result.rows[0].max_block}`)
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

debugMaxBlock().catch(console.error)
