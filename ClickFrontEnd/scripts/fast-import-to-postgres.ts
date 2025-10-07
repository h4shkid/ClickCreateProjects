import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

const EXPORT_DIR = path.join(__dirname, '..', 'migrations', 'data-export')

const POSTGRES_URL = process.env.POSTGRES_URL
if (!POSTGRES_URL) {
  console.error('❌ POSTGRES_URL environment variable is required')
  process.exit(1)
}

const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 20 // Increase pool size
})

async function fastImportTable(tableName: string): Promise<void> {
  const filepath = path.join(EXPORT_DIR, `${tableName}.json`)

  if (!fs.existsSync(filepath)) {
    console.log(`  ⚠️  File ${tableName}.json not found, skipping...`)
    return
  }

  console.log(`\n📊 Importing table: ${tableName}`)

  const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'))

  if (!Array.isArray(data) || data.length === 0) {
    console.log(`  ⚠️  No data to import`)
    return
  }

  console.log(`  📝 Found ${data.length.toLocaleString()} rows`)

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Get column names
    const columns = Object.keys(data[0])

    const BATCH_SIZE = 1000 // Much larger batches
    let imported = 0

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE)

      // Build multi-row insert
      const valueGroups: string[] = []
      const allValues: any[] = []
      let paramIndex = 1

      for (const row of batch) {
        const placeholders: string[] = []

        for (const col of columns) {
          placeholders.push(`$${paramIndex++}`)
          const value = row[col]
          allValues.push(
            typeof value === 'object' && value !== null
              ? JSON.stringify(value)
              : value
          )
        }

        valueGroups.push(`(${placeholders.join(', ')})`)
      }

      const insertQuery = `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES ${valueGroups.join(', ')}
        ON CONFLICT DO NOTHING
      `

      await client.query(insertQuery, allValues)
      imported += batch.length

      const progress = Math.min(i + BATCH_SIZE, data.length)
      const percent = ((progress / data.length) * 100).toFixed(1)
      console.log(`  📥 Progress: ${progress.toLocaleString()}/${data.length.toLocaleString()} (${percent}%)`)
    }

    await client.query('COMMIT')
    console.log(`  ✅ Successfully imported ${imported.toLocaleString()} rows`)

  } catch (error: any) {
    await client.query('ROLLBACK')
    console.error(`  ❌ Failed to import ${tableName}:`, error.message)
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  console.log('🚀 Starting FAST Postgres import...')
  console.log(`📂 Import directory: ${EXPORT_DIR}`)

  const TABLES = [
    'contracts',
    'user_profiles',
    'sync_status',
    'contract_sync_status',
    'user_activity',
    'events',           // Large table (387K rows)
    'current_state',    // Large table (130K rows)
    'nft_metadata',
    'user_snapshots',
    'blockchain_cache',
    'analytics_summary',
    'analytics_cache',
    'merkle_trees',
    'contract_analytics'
  ]

  const startTime = Date.now()

  for (const table of TABLES) {
    await fastImportTable(table)
  }

  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(2)

  console.log(`\n✅ All data imported successfully in ${duration} minutes!`)
  await pool.end()
}

main().catch(error => {
  console.error('❌ Import failed:', error)
  process.exit(1)
})
