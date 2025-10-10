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

async function checkLastBlock() {
  const client = await pool.connect()

  try {
    const contractAddress = '0x33fd426905f149f8376e227d0c9d3340aad17af1'

    console.log('🔍 Checking actual last synced block...\n')

    // Get max block from events
    const result = await client.query(`
      SELECT
        MAX(block_number) as max_block,
        COUNT(*) as total_events,
        MIN(block_number) as min_block
      FROM events
      WHERE LOWER(contract_address) = $1
    `, [contractAddress.toLowerCase()])

    const { max_block, total_events, min_block } = result.rows[0]

    console.log(`📊 Events for ${contractAddress}:`)
    console.log(`   Total events: ${total_events}`)
    console.log(`   First block: ${min_block}`)
    console.log(`   Last block: ${max_block}`)

    // Check for events in the "problematic" range
    const rangeCheck = await client.query(`
      SELECT
        block_number,
        COUNT(*) as event_count
      FROM events
      WHERE LOWER(contract_address) = $1
        AND block_number BETWEEN 23526505 AND 23532504
      GROUP BY block_number
      ORDER BY block_number
      LIMIT 20
    `, [contractAddress.toLowerCase()])

    if (rangeCheck.rows.length > 0) {
      console.log(`\n⚠️  Events already exist in sync range 23526505-23532504:`)
      rangeCheck.rows.forEach(row => {
        console.log(`   Block ${row.block_number}: ${row.event_count} events`)
      })
    } else {
      console.log(`\n✅ No events found in range 23526505-23532504`)
    }

    // Get sample events from the max block
    const sampleEvents = await client.query(`
      SELECT transaction_hash, log_index, block_number
      FROM events
      WHERE LOWER(contract_address) = $1
        AND block_number = $2
      LIMIT 5
    `, [contractAddress.toLowerCase(), max_block])

    console.log(`\n📋 Sample events from block ${max_block}:`)
    sampleEvents.rows.forEach(row => {
      console.log(`   ${row.transaction_hash} (log_index: ${row.log_index})`)
    })

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

checkLastBlock().catch(console.error)
