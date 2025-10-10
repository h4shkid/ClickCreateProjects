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

async function deepCheck() {
  const client = await pool.connect()

  try {
    console.log('🔍 Deep sequence investigation for events table...\n')

    // Check sequence details
    console.log('📊 Sequence status:')
    const seqDetail = await client.query(`
      SELECT
        last_value,
        log_cnt,
        is_called
      FROM events_id_seq
    `)
    console.log('   ', seqDetail.rows[0])

    // Check max ID in events
    console.log('\n📊 Events table stats:')
    const stats = await client.query(`
      SELECT
        COUNT(*) as total_rows,
        MIN(id) as min_id,
        MAX(id) as max_id
      FROM events
    `)
    console.log('   ', stats.rows[0])

    // Check for ID gaps
    console.log('\n📊 Checking for ID sequence gaps...')
    const gaps = await client.query(`
      SELECT
        id + 1 as gap_start,
        next_id - 1 as gap_end,
        next_id - id - 1 as gap_size
      FROM (
        SELECT id, LEAD(id) OVER (ORDER BY id) as next_id
        FROM events
      ) t
      WHERE next_id - id > 1
      LIMIT 10
    `)

    if (gaps.rows.length > 0) {
      console.log('   Found ID gaps:')
      gaps.rows.forEach(gap => {
        console.log(`   Gap from ${gap.gap_start} to ${gap.gap_end} (${gap.gap_size} IDs)`)
      })
    } else {
      console.log('   No ID gaps found (first 10 checked)')
    }

    // Try to get next ID value
    console.log('\n📊 Testing nextval():')
    await client.query('BEGIN')
    const nextVal = await client.query(`SELECT nextval('events_id_seq') as next_id`)
    console.log('   Next ID would be:', nextVal.rows[0].next_id)
    await client.query('ROLLBACK')

    // Check if that ID exists
    const existsCheck = await client.query(
      'SELECT id FROM events WHERE id = $1',
      [nextVal.rows[0].next_id]
    )
    if (existsCheck.rows.length > 0) {
      console.log('   ❌ CONFLICT! This ID already exists in the table!')
    } else {
      console.log('   ✅ This ID is available')
    }

    // Get sample of highest IDs
    console.log('\n📊 Highest IDs in events:')
    const highest = await client.query(`
      SELECT id, transaction_hash, block_number
      FROM events
      ORDER BY id DESC
      LIMIT 5
    `)
    highest.rows.forEach(row => {
      console.log(`   ID ${row.id}: Block ${row.block_number} - ${row.transaction_hash.substring(0, 10)}...`)
    })

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

deepCheck().catch(console.error)
