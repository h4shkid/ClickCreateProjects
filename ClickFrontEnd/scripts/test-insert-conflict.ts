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

async function testInsert() {
  const client = await pool.connect()

  try {
    console.log('🧪 Testing INSERT with ON CONFLICT...\n')

    // Get an existing event
    const existing = await client.query(`
      SELECT * FROM events
      WHERE LOWER(contract_address) = $1
      LIMIT 1
    `, ['0x33fd426905f149f8376e227d0c9d3340aad17af1'])

    if (existing.rows.length === 0) {
      console.log('❌ No existing events found')
      return
    }

    const event = existing.rows[0]
    console.log('📋 Using existing event:')
    console.log(`   TX: ${event.transaction_hash}`)
    console.log(`   Log Index: ${event.log_index}`)
    console.log(`   Block: ${event.block_number}\n`)

    // Test 1: Try to insert duplicate with ON CONFLICT (transaction_hash, log_index)
    console.log('Test 1: ON CONFLICT (transaction_hash, log_index) DO NOTHING')
    try {
      await client.query(`
        INSERT INTO events (
          contract_address, event_type, operator, from_address, to_address,
          token_id, amount, block_number, block_timestamp, transaction_hash, log_index
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (transaction_hash, log_index) DO NOTHING
      `, [
        event.contract_address,
        event.event_type,
        event.operator,
        event.from_address,
        event.to_address,
        event.token_id,
        event.amount,
        event.block_number,
        event.block_timestamp,
        event.transaction_hash,
        event.log_index
      ])
      console.log('   ✅ Success - duplicate was silently ignored\n')
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}\n`)
    }

    // Test 2: Try with constraint name
    console.log('Test 2: ON CONFLICT ON CONSTRAINT events_transaction_hash_log_index_key DO NOTHING')
    try {
      await client.query(`
        INSERT INTO events (
          contract_address, event_type, operator, from_address, to_address,
          token_id, amount, block_number, block_timestamp, transaction_hash, log_index
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT ON CONSTRAINT events_transaction_hash_log_index_key DO NOTHING
      `, [
        event.contract_address,
        event.event_type,
        event.operator,
        event.from_address,
        event.to_address,
        event.token_id,
        event.amount,
        event.block_number,
        event.block_timestamp,
        event.transaction_hash,
        event.log_index
      ])
      console.log('   ✅ Success - duplicate was silently ignored\n')
    } catch (error: any) {
      console.log(`   ❌ Failed: ${error.message}\n`)
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

testInsert().catch(console.error)
