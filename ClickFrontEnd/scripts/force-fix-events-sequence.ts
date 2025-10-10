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

async function forceFixSequence() {
  const client = await pool.connect()

  try {
    console.log('🔧 Force fixing events_id_seq sequence...\n')

    // Get max ID
    const maxResult = await client.query('SELECT MAX(id) as max_id FROM events')
    const maxId = maxResult.rows[0]?.max_id || 0

    console.log(`📊 Max ID in events table: ${maxId}`)

    // Force set sequence to max ID
    console.log(`🔧 Setting sequence to ${maxId}...`)
    await client.query(`SELECT setval('events_id_seq', $1, true)`, [maxId])

    // Verify
    const verifyResult = await client.query('SELECT last_value FROM events_id_seq')
    const newValue = verifyResult.rows[0]?.last_value

    console.log(`✅ Sequence now set to: ${newValue}`)

    // Test nextval in a transaction
    await client.query('BEGIN')
    const nextResult = await client.query(`SELECT nextval('events_id_seq') as next_id`)
    const nextId = nextResult.rows[0]?.next_id
    console.log(`📊 Next ID will be: ${nextId}`)
    await client.query('ROLLBACK')

    // Check if next ID conflicts
    const conflictCheck = await client.query('SELECT id FROM events WHERE id = $1', [nextId])
    if (conflictCheck.rows.length > 0) {
      console.log(`❌ ERROR: Next ID ${nextId} still conflicts!`)
    } else {
      console.log(`✅ Next ID ${nextId} is available - sequence is fixed!`)
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

forceFixSequence().catch(console.error)
