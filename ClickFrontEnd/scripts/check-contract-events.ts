import { Client } from 'pg'

async function checkContractEvents() {
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
    await client.connect()
    console.log('✅ Connected to Postgres\n')

    // Check all contracts
    const contracts = await client.query(`
      SELECT id, address, name, symbol, added_by_user_id
      FROM contracts
    `)

    console.log(`📊 Found ${contracts.rows.length} contracts:\n`)

    for (const contract of contracts.rows) {
      console.log(`📝 Contract: ${contract.name} (${contract.symbol})`)
      console.log(`   Address: ${contract.address}`)
      console.log(`   ID: ${contract.id}`)
      console.log(`   Added by user: ${contract.added_by_user_id}`)

      // Check events for this contract
      const events = await client.query(`
        SELECT COUNT(*) as count
        FROM events
        WHERE contract_address = $1
      `, [contract.address])

      const eventsLowercase = await client.query(`
        SELECT COUNT(*) as count
        FROM events
        WHERE LOWER(contract_address) = LOWER($1)
      `, [contract.address])

      console.log(`   Events (exact): ${events.rows[0].count}`)
      console.log(`   Events (case-insensitive): ${eventsLowercase.rows[0].count}`)

      // Check current_state for this contract
      const currentState = await client.query(`
        SELECT COUNT(*) as count
        FROM current_state
        WHERE contract_address = $1
      `, [contract.address])

      const currentStateLowercase = await client.query(`
        SELECT COUNT(*) as count
        FROM current_state
        WHERE LOWER(contract_address) = LOWER($1)
      `, [contract.address])

      console.log(`   Current state (exact): ${currentState.rows[0].count}`)
      console.log(`   Current state (case-insensitive): ${currentStateLowercase.rows[0].count}`)

      // Check analytics
      const analytics = await client.query(`
        SELECT COUNT(*) as count
        FROM contract_analytics
        WHERE contract_id = $1
      `, [contract.id])

      console.log(`   Analytics records: ${analytics.rows[0].count}`)
      console.log('')
    }

    // Check total events
    const totalEvents = await client.query('SELECT COUNT(*) as count FROM events')
    console.log(`\n📊 Total events in database: ${totalEvents.rows[0].count}`)

    // Check sample events
    const sampleEvents = await client.query(`
      SELECT contract_address, COUNT(*) as count
      FROM events
      GROUP BY contract_address
      LIMIT 10
    `)

    console.log('\n📊 Events by contract_address:')
    sampleEvents.rows.forEach((row: any) => {
      console.log(`   ${row.contract_address}: ${row.count} events`)
    })

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await client.end()
  }
}

checkContractEvents()
