/**
 * Import JSON data into Postgres database
 *
 * This script imports the exported SQLite data into Vercel Postgres
 * Run this AFTER setting up your Vercel Postgres database and running the schema migration
 */

import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

const EXPORT_DIR = path.join(process.cwd(), 'migrations', 'data-export')

// Check for Postgres connection string
const connectionString = process.env.POSTGRES_URL
if (!connectionString) {
  console.error('❌ POSTGRES_URL environment variable not found!')
  console.error('Please set it in your .env.local or Vercel environment variables')
  process.exit(1)
}

console.log('🚀 Starting Postgres import...')
console.log(`📂 Import directory: ${EXPORT_DIR}`)

const pool = new Pool({
  connectionString,
  max: 10,
})

// Tables to import in order (respecting foreign key dependencies)
const TABLES = [
  'contracts',
  'user_profiles',
  'events',
  'current_state',
  'nft_metadata',
  'contract_sync_status',
  'user_snapshots',
  'blockchain_cache',
  'analytics_summary',
  'sync_status',
  'analytics_cache',
  'merkle_trees',
  'contract_analytics',
  'user_activity'
]

interface ImportStats {
  table: string
  rows: number
  status: 'success' | 'failed' | 'skipped'
  error?: string
}

const stats: ImportStats[] = []

async function importTable(tableName: string): Promise<void> {
  const filepath = path.join(EXPORT_DIR, `${tableName}.json`)

  // Check if file exists
  if (!fs.existsSync(filepath)) {
    console.log(`  ⚠️  File ${tableName}.json not found, skipping...`)
    stats.push({ table: tableName, rows: 0, status: 'skipped' })
    return
  }

  console.log(`\n📊 Importing table: ${tableName}`)

  try {
    // Read JSON data
    const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'))

    if (!Array.isArray(data) || data.length === 0) {
      console.log(`  ⚠️  No data to import`)
      stats.push({ table: tableName, rows: 0, status: 'skipped' })
      return
    }

    console.log(`  📝 Found ${data.length.toLocaleString()} rows`)

    // Get column names from first row
    const columns = Object.keys(data[0])
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')

    const insertQuery = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT DO NOTHING
    `

    const client = await pool.connect()

    try {
      // Begin transaction
      await client.query('BEGIN')

      let imported = 0
      const batchSize = 100

      // Import in batches
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize)

        for (const row of batch) {
          const values = columns.map(col => {
            const value = row[col]

            // Handle JSON columns
            if (typeof value === 'object' && value !== null) {
              return JSON.stringify(value)
            }

            return value
          })

          try {
            await client.query(insertQuery, values)
            imported++
          } catch (err: any) {
            // Skip duplicate key violations
            if (!err.message.includes('duplicate key')) {
              throw err
            }
          }
        }

        // Progress update
        const progress = Math.min(i + batchSize, data.length)
        const percent = ((progress / data.length) * 100).toFixed(1)
        console.log(`  📥 Progress: ${progress.toLocaleString()}/${data.length.toLocaleString()} (${percent}%)`)
      }

      // Commit transaction
      await client.query('COMMIT')

      console.log(`  ✅ Successfully imported ${imported.toLocaleString()} rows`)
      stats.push({ table: tableName, rows: imported, status: 'success' })

      // Reset sequences for SERIAL columns
      try {
        await client.query(`
          SELECT setval(pg_get_serial_sequence('${tableName}', 'id'),
            COALESCE((SELECT MAX(id) FROM ${tableName}), 1),
            true)
        `)
      } catch (err) {
        // Ignore if table doesn't have id column
      }

    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

  } catch (error: any) {
    console.error(`  ❌ Error importing ${tableName}:`, error.message)
    stats.push({
      table: tableName,
      rows: 0,
      status: 'failed',
      error: error.message
    })
  }
}

async function main() {
  try {
    // Test connection
    console.log('🔌 Testing Postgres connection...')
    const client = await pool.connect()
    const result = await client.query('SELECT NOW()')
    console.log(`✅ Connected to Postgres (${result.rows[0].now})`)
    client.release()

    // Import all tables
    for (const table of TABLES) {
      await importTable(table)
    }

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 IMPORT SUMMARY')
    console.log('='.repeat(60))

    const successful = stats.filter(s => s.status === 'success')
    const failed = stats.filter(s => s.status === 'failed')
    const skipped = stats.filter(s => s.status === 'skipped')

    console.log(`✅ Successful: ${successful.length}`)
    console.log(`❌ Failed: ${failed.length}`)
    console.log(`⚠️  Skipped: ${skipped.length}`)
    console.log(`\nTotal rows imported: ${successful.reduce((sum, s) => sum + s.rows, 0).toLocaleString()}`)

    if (failed.length > 0) {
      console.log('\n⚠️  Failed tables:')
      failed.forEach(s => console.log(`  • ${s.table}: ${s.error}`))
    }

    console.log('='.repeat(60))
    console.log('\n✅ Import complete!')

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
