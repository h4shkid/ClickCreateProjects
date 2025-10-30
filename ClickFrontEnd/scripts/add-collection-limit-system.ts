/**
 * Migration Script: Add Collection Limit System
 *
 * Creates tables for tracking:
 * 1. wallet_new_syncs - Track user's NEW collection syncs (limit: 2)
 * 2. ip_wallet_binding - Enforce 1 wallet per IP
 *
 * Updates:
 * - contracts table with first_synced_by_wallet, first_synced_at, total_users
 */

import { createDatabaseAdapter } from '../lib/database/adapter'

async function runMigration() {
  console.log('🚀 Starting Collection Limit System Migration...\n')

  const db = createDatabaseAdapter()
  const isPostgres = !!process.env.POSTGRES_URL

  try {
    // ========================================
    // 1. CREATE wallet_new_syncs TABLE
    // ========================================
    console.log('📋 Creating wallet_new_syncs table...')

    if (isPostgres) {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS wallet_new_syncs (
          id SERIAL PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          contract_address TEXT NOT NULL,
          sync_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sync_completed_at TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          UNIQUE(wallet_address, contract_address)
        )
      `).run()

      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_wallet_syncs
        ON wallet_new_syncs(wallet_address, is_active)
      `).run()

      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_contract_syncs
        ON wallet_new_syncs(contract_address)
      `).run()
    } else {
      // SQLite
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS wallet_new_syncs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          wallet_address TEXT NOT NULL,
          contract_address TEXT NOT NULL,
          sync_started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sync_completed_at DATETIME,
          is_active BOOLEAN DEFAULT 1,
          UNIQUE(wallet_address, contract_address)
        )
      `).run()

      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_wallet_syncs
        ON wallet_new_syncs(wallet_address, is_active)
      `).run()

      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_contract_syncs
        ON wallet_new_syncs(contract_address)
      `).run()
    }

    console.log('✅ wallet_new_syncs table created\n')

    // ========================================
    // 2. CREATE ip_wallet_binding TABLE
    // ========================================
    console.log('📋 Creating ip_wallet_binding table...')

    if (isPostgres) {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS ip_wallet_binding (
          ip_address TEXT PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP
        )
      `).run()

      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_wallet_ip
        ON ip_wallet_binding(wallet_address)
      `).run()
    } else {
      // SQLite
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS ip_wallet_binding (
          ip_address TEXT PRIMARY KEY,
          wallet_address TEXT NOT NULL,
          first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME
        )
      `).run()

      await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_wallet_ip
        ON ip_wallet_binding(wallet_address)
      `).run()
    }

    console.log('✅ ip_wallet_binding table created\n')

    // ========================================
    // 3. ALTER contracts TABLE
    // ========================================
    console.log('📋 Updating contracts table...')

    try {
      // Check if columns already exist
      const testQuery = isPostgres
        ? `SELECT first_synced_by_wallet FROM contracts LIMIT 1`
        : `SELECT first_synced_by_wallet FROM contracts LIMIT 1`

      await db.prepare(testQuery).get()
      console.log('⚠️  Columns already exist, skipping ALTER TABLE')
    } catch (error) {
      // Columns don't exist, add them
      if (isPostgres) {
        await db.prepare(`
          ALTER TABLE contracts
          ADD COLUMN IF NOT EXISTS first_synced_by_wallet TEXT
        `).run()

        await db.prepare(`
          ALTER TABLE contracts
          ADD COLUMN IF NOT EXISTS first_synced_at TIMESTAMP
        `).run()

        await db.prepare(`
          ALTER TABLE contracts
          ADD COLUMN IF NOT EXISTS total_users INTEGER DEFAULT 0
        `).run()
      } else {
        // SQLite doesn't support multiple ALTER in one statement
        await db.prepare(`
          ALTER TABLE contracts ADD COLUMN first_synced_by_wallet TEXT
        `).run()

        await db.prepare(`
          ALTER TABLE contracts ADD COLUMN first_synced_at DATETIME
        `).run()

        await db.prepare(`
          ALTER TABLE contracts ADD COLUMN total_users INTEGER DEFAULT 0
        `).run()
      }

      console.log('✅ contracts table updated with new columns\n')
    }

    // ========================================
    // 4. MIGRATE EXISTING DATA
    // ========================================
    console.log('📋 Migrating existing contracts to wallet_new_syncs...')

    // Get all existing contracts
    const existingContracts = await db.prepare(`
      SELECT address, added_by_user_id, created_at
      FROM contracts
    `).all() as any[]

    console.log(`Found ${existingContracts.length} existing contracts`)

    // For each contract, check if it was added by a user
    let migratedCount = 0
    for (const contract of existingContracts) {
      if (contract.added_by_user_id) {
        // Get user's wallet address
        const user = await db.prepare(`
          SELECT wallet_address FROM user_profiles WHERE id = ?
        `).get(contract.added_by_user_id) as any

        if (user) {
          // Add to wallet_new_syncs
          try {
            await db.prepare(`
              INSERT INTO wallet_new_syncs
              (wallet_address, contract_address, sync_started_at, is_active)
              VALUES (?, ?, ?, ?)
            `).run(
              user.wallet_address.toLowerCase(),
              contract.address.toLowerCase(),
              contract.created_at,
              1 // active
            )

            // Update contracts table
            await db.prepare(`
              UPDATE contracts
              SET first_synced_by_wallet = ?,
                  first_synced_at = ?,
                  total_users = 1
              WHERE address = ?
            `).run(
              user.wallet_address.toLowerCase(),
              contract.created_at,
              contract.address.toLowerCase()
            )

            migratedCount++
          } catch (error) {
            // Duplicate entry, skip
            console.log(`   Skipped duplicate: ${contract.address}`)
          }
        }
      } else {
        // Contract added without user tracking, mark as system collection
        await db.prepare(`
          UPDATE contracts
          SET first_synced_by_wallet = 'system',
              first_synced_at = ?,
              total_users = 0
          WHERE address = ?
        `).run(contract.created_at, contract.address.toLowerCase())
      }
    }

    console.log(`✅ Migrated ${migratedCount} contracts to wallet_new_syncs\n`)

    // ========================================
    // 5. SUMMARY
    // ========================================
    console.log('\n🎉 Migration Complete!\n')
    console.log('Summary:')
    console.log('  ✅ wallet_new_syncs table created')
    console.log('  ✅ ip_wallet_binding table created')
    console.log('  ✅ contracts table updated')
    console.log(`  ✅ ${migratedCount} existing contracts migrated`)
    console.log('\nNew Features:')
    console.log('  • Users can sync max 2 NEW collections')
    console.log('  • Existing collections can be added without limit')
    console.log('  • 1 wallet per IP address enforcement')
    console.log('  • Snapshots/exports remain unlimited\n')

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('✅ Migration script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error)
    process.exit(1)
  })
