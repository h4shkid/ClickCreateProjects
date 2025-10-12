import { Pool } from 'pg'

const POSTGRES_URL = "postgres://ca4daf153803706ed28b7b0405128d5897c65b35d96487ed6b0363f56c8c17e6:sk_MLsMuw4nt6ywk9XN19QQw@db.prisma.io:5432/postgres?sslmode=require"

async function createCheckpointTable() {
  const pool = new Pool({ connectionString: POSTGRES_URL })

  try {
    console.log('Creating sync_checkpoints table...')

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sync_checkpoints (
        contract_address VARCHAR(42) PRIMARY KEY,
        last_block BIGINT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_checkpoints_updated ON sync_checkpoints(updated_at DESC)
    `)

    console.log('✅ Checkpoint table created successfully!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

createCheckpointTable()
