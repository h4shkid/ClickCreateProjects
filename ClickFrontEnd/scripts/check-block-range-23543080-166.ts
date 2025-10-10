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

async function checkBlockRange() {
  const client = await pool.connect()

  try {
    const contractAddress = '0x33fd426905f149f8376e227d0c9d3340aad17af1'

    console.log('🔍 Checking blocks 23543080-23543166...\n')

    // Check if any events exist in this range
    const result = await client.query(`
      SELECT
        block_number,
        COUNT(*) as event_count
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
        AND block_number BETWEEN 23543080 AND 23543166
      GROUP BY block_number
      ORDER BY block_number
    `, [contractAddress.toLowerCase()])

    if (result.rows.length === 0) {
      console.log('❌ NO EVENTS found in blocks 23543080-23543166')
      console.log('   This means worker synced these blocks but ON CONFLICT skipped all of them')
      console.log('   OR these blocks had no transfer events at all\n')
    } else {
      console.log(`✅ Found ${result.rows.length} blocks with events:`)
      result.rows.forEach(row => {
        console.log(`   Block ${row.block_number}: ${row.event_count} events`)
      })
    }

    // Check blocks around the gap
    console.log('\n📊 Events around block 23543079:')
    const aroundResult = await client.query(`
      SELECT block_number, COUNT(*) as count
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
        AND block_number BETWEEN 23543070 AND 23543170
      GROUP BY block_number
      ORDER BY block_number DESC
      LIMIT 10
    `, [contractAddress.toLowerCase()])

    aroundResult.rows.forEach(row => {
      console.log(`   Block ${row.block_number}: ${row.count} events`)
    })

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

checkBlockRange().catch(console.error)
