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

async function fixAllSequences() {
  const client = await pool.connect()

  try {
    console.log('🔧 Fixing ALL Postgres sequences...\n')

    // All tables with SERIAL/BIGSERIAL primary keys
    const tables = [
      { table: 'events', sequence: 'events_id_seq' },
      { table: 'current_state', sequence: 'current_state_id_seq' },
      { table: 'contracts', sequence: 'contracts_id_seq' },
      { table: 'user_profiles', sequence: 'user_profiles_id_seq' },
      { table: 'nft_metadata', sequence: 'nft_metadata_id_seq' },
      { table: 'user_activity', sequence: 'user_activity_id_seq' },
      { table: 'user_snapshots', sequence: 'user_snapshots_id_seq' },
      { table: 'contract_sync_status', sequence: 'contract_sync_status_id_seq' },
      { table: 'blockchain_cache', sequence: 'blockchain_cache_id_seq' },
      { table: 'analytics_summary', sequence: 'analytics_summary_id_seq' },
      { table: 'sync_status', sequence: 'sync_status_id_seq' },
      { table: 'analytics_cache', sequence: 'analytics_cache_id_seq' },
      { table: 'merkle_trees', sequence: 'merkle_trees_id_seq' },
      { table: 'contract_analytics', sequence: 'contract_analytics_id_seq' }
    ]

    for (const { table, sequence } of tables) {
      try {
        console.log(`📊 Checking ${table}...`)

        // Get max ID from table
        const maxResult = await client.query(`SELECT MAX(id) as max_id FROM ${table}`)
        const maxId = maxResult.rows[0]?.max_id || 0

        if (maxId === null || maxId === 0) {
          console.log(`   ⏭️  Table is empty, skipping...\n`)
          continue
        }

        // Get current sequence value
        const seqResult = await client.query(`SELECT last_value FROM ${sequence}`)
        const currentSeq = seqResult.rows[0]?.last_value || 0

        console.log(`   Current sequence: ${currentSeq}`)
        console.log(`   Max ID in table: ${maxId}`)

        if (maxId > currentSeq) {
          console.log(`   ⚠️  Sequence is behind! Fixing...`)

          // Set sequence to max ID
          await client.query(`SELECT setval('${sequence}', $1, true)`, [maxId])

          const newSeqResult = await client.query(`SELECT last_value FROM ${sequence}`)
          const newSeq = newSeqResult.rows[0]?.last_value

          console.log(`   ✅ Updated sequence to: ${newSeq}\n`)
        } else {
          console.log(`   ✅ Sequence is correct\n`)
        }
      } catch (error: any) {
        console.log(`   ⚠️  Error with ${table}: ${error.message}\n`)
      }
    }

    console.log('✅ All sequences checked and fixed!')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

fixAllSequences().catch(console.error)
