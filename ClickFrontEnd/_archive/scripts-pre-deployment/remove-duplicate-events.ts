#!/usr/bin/env npx tsx

/**
 * Remove Duplicate Events Script
 *
 * Finds and removes duplicate transfer events that were accidentally synced multiple times.
 * Keeps only one copy of each unique event based on (transaction_hash, log_index).
 */

import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
db.pragma('journal_mode = WAL')

console.log('🔍 Finding duplicate events...\n')

// Find duplicate events (same tx_hash + log_index)
const duplicates = db.prepare(`
  SELECT
    transaction_hash,
    log_index,
    contract_address,
    COUNT(*) as count,
    GROUP_CONCAT(rowid) as rowids
  FROM events
  WHERE contract_address = ? COLLATE NOCASE
  GROUP BY transaction_hash, log_index
  HAVING COUNT(*) > 1
`).all('0x33fd426905f149f8376e227d0c9d3340aad17af1') as any[]

if (duplicates.length === 0) {
  console.log('✅ No duplicates found!')
  db.close()
  process.exit(0)
}

console.log(`📊 Found ${duplicates.length} duplicate groups\n`)

let totalDuplicates = 0
let totalRemoved = 0

// Show summary
duplicates.slice(0, 10).forEach((dup, i) => {
  console.log(`${i + 1}. Tx ${dup.transaction_hash.substring(0, 10)}... LogIndex: ${dup.log_index}`)
  console.log(`   Count: ${dup.count} duplicates`)
  totalDuplicates += (dup.count - 1)
})

if (duplicates.length > 10) {
  console.log(`   ... and ${duplicates.length - 10} more duplicate groups`)
}

console.log(`\n📊 Total duplicate events to remove: ${totalDuplicates}`)
console.log(`\n🗑️  Removing duplicates (keeping earliest rowid)...\n`)

const deleteStmt = db.prepare('DELETE FROM events WHERE rowid = ?')

const transaction = db.transaction(() => {
  for (const dup of duplicates) {
    // Keep only the first occurrence, delete the rest
    const rowids = dup.rowids.split(',').map((id: string) => parseInt(id))
    const toDelete = rowids.slice(1) // Keep first, delete rest

    for (const rowid of toDelete) {
      deleteStmt.run(rowid)
      totalRemoved++
    }
  }
})

transaction()

console.log(`✅ Removed ${totalRemoved} duplicate events\n`)

// Verify
const remaining = db.prepare(`
  SELECT COUNT(*) as count
  FROM events
  WHERE contract_address = ? COLLATE NOCASE
`).get('0x33fd426905f149f8376e227d0c9d3340aad17af1') as any

console.log(`📊 Events remaining: ${remaining.count.toLocaleString()}`)

// Recalculate supply
const supply = db.prepare(`
  SELECT
    SUM(CASE WHEN from_address = '0x0000000000000000000000000000000000000000' THEN amount ELSE 0 END) as minted,
    SUM(CASE WHEN to_address = '0x0000000000000000000000000000000000000000' THEN amount ELSE 0 END) as burned
  FROM events
  WHERE contract_address = ? COLLATE NOCASE
`).get('0x33fd426905f149f8376e227d0c9d3340aad17af1') as any

const minted = parseInt(supply.minted || '0')
const burned = parseInt(supply.burned || '0')
const netSupply = minted - burned

console.log(`\n📈 NEW TOKEN SUPPLY:`)
console.log(`   Minted: ${minted.toLocaleString()}`)
console.log(`   Burned: ${burned.toLocaleString()}`)
console.log(`   Net Supply: ${netSupply.toLocaleString()}`)

// Update contracts table
db.prepare(`
  UPDATE contracts
  SET total_supply = ?, updated_at = CURRENT_TIMESTAMP
  WHERE address = ? COLLATE NOCASE
`).run(netSupply.toString(), '0x33fd426905f149f8376e227d0c9d3340aad17af1')

console.log(`\n✅ Done! Now run: npx tsx scripts/rebuild-state.js`)
console.log(`   This will update current_state table with correct balances.\n`)

db.close()
