import { Client } from 'pg'

async function verifyData() {
  const postgresUrl = process.env.POSTGRES_URL

  if (!postgresUrl) {
    console.error('❌ POSTGRES_URL environment variable is required')
    process.exit(1)
  }

  const client = new Client({
    connectionString: postgresUrl,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('🔌 Connecting to Postgres...')
    await client.connect()
    console.log('✅ Connected to Postgres\n')

    // Check contracts
    const contracts = await client.query('SELECT id, address, name, symbol, contract_type FROM contracts')
    console.log('📊 Contracts table:')
    console.log(`   Total contracts: ${contracts.rows.length}`)
    contracts.rows.forEach((row: any) => {
      console.log(`   - ${row.name} (${row.symbol}) - ${row.address}`)
    })
    console.log('')

    // Check events count
    const eventsCount = await client.query('SELECT COUNT(*) as count FROM events')
    console.log('📊 Events table:')
    console.log(`   Total events: ${eventsCount.rows[0].count}`)
    console.log('')

    // Check current_state count
    const stateCount = await client.query('SELECT COUNT(*) as count FROM current_state')
    console.log('📊 Current_state table:')
    console.log(`   Total records: ${stateCount.rows[0].count}`)
    console.log('')

    // Check holders per contract
    for (const contract of contracts.rows) {
      const holders = await client.query(
        `SELECT COUNT(DISTINCT address) as holder_count
         FROM current_state
         WHERE contract_address = $1 AND CAST(balance AS INTEGER) > 0`,
        [contract.address.toLowerCase()]
      )
      console.log(`   ${contract.name}: ${holders.rows[0].holder_count} holders`)
    }
    console.log('')

    // Check user profiles
    const users = await client.query('SELECT COUNT(*) as count FROM user_profiles')
    console.log('📊 User_profiles table:')
    console.log(`   Total users: ${users.rows[0].count}`)
    console.log('')

    console.log('✅ Data verification complete!')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

verifyData()
