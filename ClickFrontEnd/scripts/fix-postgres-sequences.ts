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

async function fixSequences() {
  const client = await pool.connect()

  try {
    console.log('🔧 Fixing Postgres sequences...\n')

    // Tables with BIGSERIAL/SERIAL primary keys
    const tables = [
      { table: 'events', idColumn: 'id', sequence: 'events_id_seq' },
      { table: 'current_state', idColumn: 'id', sequence: 'current_state_id_seq' },
      { table: 'contracts', idColumn: 'id', sequence: 'contracts_id_seq' },
      { table: 'user_profiles', idColumn: 'id', sequence: 'user_profiles_id_seq' },
      { table: 'nft_metadata', idColumn: 'id', sequence: 'nft_metadata_id_seq' }
    ]

    for (const { table, idColumn, sequence } of tables) {
      console.log(`📊 Checking ${table}...`)

      // Get current sequence value
      const seqResult = await client.query(`SELECT last_value FROM ${sequence}`)
      const currentSeq = seqResult.rows[0]?.last_value || 0

      // Get max ID from table
      const maxResult = await client.query(`SELECT MAX(${idColumn}) as max_id FROM ${table}`)
      const maxId = maxResult.rows[0]?.max_id || 0

      console.log(`   Current sequence: ${currentSeq}`)
      console.log(`   Max ID in table: ${maxId}`)

      if (maxId > currentSeq) {
        console.log(`   ⚠️  Sequence is behind! Fixing...`)

        // Set sequence to max ID + 1
        await client.query(`SELECT setval('${sequence}', ${maxId}, true)`)

        const newSeqResult = await client.query(`SELECT last_value FROM ${sequence}`)
        const newSeq = newSeqResult.rows[0]?.last_value

        console.log(`   ✅ Updated sequence to: ${newSeq}\n`)
      } else {
        console.log(`   ✅ Sequence is correct\n`)
      }
    }

    console.log('✅ All sequences fixed!')

  } catch (error: any) {
    console.error('❌ Error fixing sequences:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixSequences().catch(console.error)
