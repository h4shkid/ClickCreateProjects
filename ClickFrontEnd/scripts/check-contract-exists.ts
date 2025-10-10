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

async function checkContract() {
  const client = await pool.connect()

  try {
    const contractAddress = '0x0000000222d40f1ae80791fdc42fa6eb5da6f80b'

    console.log(`🔍 Checking if contract ${contractAddress} exists...\n`)

    // Check in contracts table
    const result = await client.query(`
      SELECT *
      FROM contracts
      WHERE LOWER(address) = LOWER($1)
    `, [contractAddress])

    if (result.rows.length > 0) {
      console.log('✅ Contract FOUND in database:')
      console.log(result.rows[0])
    } else {
      console.log('❌ Contract NOT FOUND in database')
      console.log('   This contract can be added')
    }

    // Check all contracts with similar addresses
    const similarResult = await client.query(`
      SELECT address, name, symbol, contract_type
      FROM contracts
      WHERE LOWER(address) LIKE LOWER($1)
    `, [`%${contractAddress.substring(2, 10)}%`])

    if (similarResult.rows.length > 0) {
      console.log('\n📋 Similar addresses found:')
      similarResult.rows.forEach(row => {
        console.log(`   ${row.address} - ${row.name} (${row.contract_type})`)
      })
    }

    // List all contracts
    console.log('\n📊 All contracts in database:')
    const allContracts = await client.query(`
      SELECT address, name, symbol, contract_type, created_at
      FROM contracts
      ORDER BY created_at DESC
    `)

    allContracts.rows.forEach(row => {
      console.log(`   ${row.address} - ${row.name || 'Unknown'} (${row.symbol || 'N/A'}) - ${row.contract_type}`)
    })

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

checkContract().catch(console.error)
