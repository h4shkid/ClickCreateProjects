/**
 * Export SQLite database to JSON files for Postgres migration
 *
 * This script exports all tables to JSON format so they can be imported into Postgres
 */

import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'nft-snapshot.db')
const EXPORT_DIR = path.join(process.cwd(), 'migrations', 'data-export')

// Create export directory
if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR, { recursive: true })
}

console.log('🚀 Starting SQLite to JSON export...')
console.log(`📂 Database: ${DB_PATH}`)
console.log(`📦 Export directory: ${EXPORT_DIR}`)

const db = new Database(DB_PATH, { readonly: true })

// Tables to export in order (respecting foreign key dependencies)
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

interface ExportStats {
  table: string
  rows: number
  fileSize: string
}

const stats: ExportStats[] = []

for (const table of TABLES) {
  try {
    console.log(`\n📊 Exporting table: ${table}`)

    // Get row count
    const countResult = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
    const rowCount = countResult.count

    if (rowCount === 0) {
      console.log(`  ⚠️  Table ${table} is empty, skipping...`)
      continue
    }

    console.log(`  📝 Found ${rowCount.toLocaleString()} rows`)

    // Export data
    const rows = db.prepare(`SELECT * FROM ${table}`).all()

    // Write to JSON file
    const filename = `${table}.json`
    const filepath = path.join(EXPORT_DIR, filename)

    fs.writeFileSync(filepath, JSON.stringify(rows, null, 2))

    // Get file size
    const fileStats = fs.statSync(filepath)
    const fileSizeMB = (fileStats.size / 1024 / 1024).toFixed(2)

    stats.push({
      table,
      rows: rowCount,
      fileSize: `${fileSizeMB} MB`
    })

    console.log(`  ✅ Exported to ${filename} (${fileSizeMB} MB)`)

  } catch (error) {
    console.error(`  ❌ Error exporting ${table}:`, error)
  }
}

db.close()

// Create export summary
const summary = {
  exportDate: new Date().toISOString(),
  totalTables: stats.length,
  totalRows: stats.reduce((sum, s) => sum + s.rows, 0),
  tables: stats
}

fs.writeFileSync(
  path.join(EXPORT_DIR, '_export_summary.json'),
  JSON.stringify(summary, null, 2)
)

console.log('\n' + '='.repeat(60))
console.log('📊 EXPORT SUMMARY')
console.log('='.repeat(60))
console.log(`Total tables exported: ${summary.totalTables}`)
console.log(`Total rows exported: ${summary.totalRows.toLocaleString()}`)
console.log('\nTable breakdown:')
stats.forEach(s => {
  console.log(`  • ${s.table.padEnd(25)} ${s.rows.toLocaleString().padStart(10)} rows  (${s.fileSize})`)
})
console.log('='.repeat(60))
console.log(`\n✅ Export complete! Files saved to: ${EXPORT_DIR}`)
console.log('\nNext step: Run the Postgres import script after setting up Vercel Postgres')
