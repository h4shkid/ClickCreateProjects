import { Client } from 'pg'

async function fixBalanceTypes() {
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

    console.log('🔧 Fixing balance and amount data types...')

    // Fix events table - convert amount to integer
    console.log('📝 Updating events.amount column...')
    await client.query(`
      UPDATE events
      SET amount = CAST(FLOOR(CAST(amount AS NUMERIC)) AS VARCHAR)
      WHERE amount ~ '^[0-9]+\\.0*$'
    `)
    console.log('✅ Events.amount fixed')

    // Fix current_state table - convert balance to integer
    console.log('📝 Updating current_state.balance column...')
    await client.query(`
      UPDATE current_state
      SET balance = CAST(FLOOR(CAST(balance AS NUMERIC)) AS VARCHAR)
      WHERE balance ~ '^[0-9]+\\.0*$'
    `)
    console.log('✅ Current_state.balance fixed')

    // Verify the fix
    console.log('\n🔍 Verifying fixes...')

    const sampleEvents = await client.query('SELECT amount FROM events LIMIT 5')
    console.log('Sample event amounts:', sampleEvents.rows.map(r => r.amount))

    const sampleState = await client.query('SELECT balance FROM current_state LIMIT 5')
    console.log('Sample balances:', sampleState.rows.map(r => r.balance))

    console.log('\n✅ Balance types fixed successfully!')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

fixBalanceTypes()
