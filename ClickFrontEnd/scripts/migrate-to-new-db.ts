import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

const OLD_DB = "postgres://4a19748bd89c5611c016aaa027d3ac32d517833ab46e1c08f23b5f8a710b0a56:sk_-hLlPVbV73iiRW67YAwC1@db.prisma.io:5432/postgres?sslmode=require"
const NEW_DB = "postgres://ca4daf153803706ed28b7b0405128d5897c65b35d96487ed6b0363f56c8c17e6:sk_MLsMuw4nt6ywk9XN19QQw@db.prisma.io:5432/postgres?sslmode=require"

const oldPool = new Pool({ connectionString: OLD_DB, ssl: { rejectUnauthorized: false } })
const newPool = new Pool({ connectionString: NEW_DB, ssl: { rejectUnauthorized: false } })

async function migrate() {
  console.log('🚀 Starting database migration...\n')

  try {
    // Step 1: Check if schema exists, create if needed
    console.log('📋 Step 1/4: Checking schema...')
    const tableCheck = await newPool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'contracts'
    `)

    if (tableCheck.rows.length === 0) {
      console.log('   Creating schema in new database...')
      const schemaSQL = fs.readFileSync(path.join(process.cwd(), 'migrations/001_initial_postgres_schema.sql'), 'utf8')
      await newPool.query(schemaSQL)
      console.log('✅ Schema created\n')
    } else {
      console.log('✅ Schema already exists\n')
    }

    // Step 2: Migrate contracts
    console.log('📦 Step 2/4: Migrating contracts...')
    const contracts = await oldPool.query('SELECT * FROM contracts ORDER BY id')
    if (contracts.rows.length > 0) {
      for (const row of contracts.rows) {
        await newPool.query(`
          INSERT INTO contracts (
            id, address, name, symbol, contract_type, chain_id, deployment_block,
            total_supply, is_verified, is_active, description, website_url, twitter_url,
            discord_url, image_url, banner_image_url, metadata_json, added_by_user_id,
            usage_count, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (address) DO NOTHING
        `, [
          row.id, row.address, row.name, row.symbol, row.contract_type, row.chain_id,
          row.deployment_block, row.total_supply, row.is_verified, row.is_active,
          row.description, row.website_url, row.twitter_url, row.discord_url,
          row.image_url, row.banner_image_url, row.metadata_json, row.added_by_user_id,
          row.usage_count, row.created_at, row.updated_at
        ])
      }
      // Fix sequence
      await newPool.query(`SELECT setval('contracts_id_seq', (SELECT MAX(id) FROM contracts), true)`)
    }
    console.log(`✅ Migrated ${contracts.rows.length} contracts\n`)

    // Step 3: Migrate events (in batches)
    console.log('📦 Step 3/4: Migrating events (this may take a while)...')
    const eventCount = await oldPool.query('SELECT COUNT(*) FROM events')
    const total = parseInt(eventCount.rows[0].count)
    console.log(`   Total events: ${total}`)

    const BATCH_SIZE = 5000
    let migrated = 0

    while (migrated < total) {
      const events = await oldPool.query(`SELECT * FROM events ORDER BY id LIMIT ${BATCH_SIZE} OFFSET ${migrated}`)

      if (events.rows.length === 0) break

      // Build bulk insert query
      const values: any[] = []
      const placeholders: string[] = []
      let paramIndex = 1

      for (const row of events.rows) {
        placeholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10}, $${paramIndex+11}, $${paramIndex+12})`)
        values.push(
          row.id, row.contract_address, row.event_type, row.operator, row.from_address,
          row.to_address, row.token_id, row.amount, row.block_number, row.block_timestamp,
          row.transaction_hash, row.log_index, row.created_at
        )
        paramIndex += 13
      }

      // Single bulk insert
      await newPool.query(`
        INSERT INTO events (
          id, contract_address, event_type, operator, from_address, to_address,
          token_id, amount, block_number, block_timestamp, transaction_hash, log_index, created_at
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (transaction_hash, log_index) DO NOTHING
      `, values)

      migrated += events.rows.length
      console.log(`   Progress: ${migrated}/${total} (${Math.round(migrated/total*100)}%)`)
    }

    // Fix sequence
    await newPool.query(`SELECT setval('events_id_seq', (SELECT MAX(id) FROM events), true)`)
    console.log(`✅ Migrated ${total} events\n`)

    // Step 4: Migrate current_state
    console.log('📦 Step 4/4: Migrating current_state...')
    const stateCount = await oldPool.query('SELECT COUNT(*) FROM current_state')
    const totalStates = parseInt(stateCount.rows[0].count)
    console.log(`   Total current_state: ${totalStates}`)

    let migratedStates = 0

    while (migratedStates < totalStates) {
      const states = await oldPool.query(`SELECT * FROM current_state ORDER BY id LIMIT ${BATCH_SIZE} OFFSET ${migratedStates}`)

      if (states.rows.length === 0) break

      // Build bulk insert query
      const values: any[] = []
      const placeholders: string[] = []
      let paramIndex = 1

      for (const row of states.rows) {
        placeholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6})`)
        values.push(
          row.id, row.contract_address, row.token_id, row.address,
          row.balance, row.last_updated_block, row.updated_at
        )
        paramIndex += 7
      }

      // Single bulk insert
      await newPool.query(`
        INSERT INTO current_state (
          id, contract_address, token_id, address, balance, last_updated_block, updated_at
        ) VALUES ${placeholders.join(', ')}
        ON CONFLICT (contract_address, token_id, address) DO UPDATE SET
          balance = EXCLUDED.balance,
          last_updated_block = EXCLUDED.last_updated_block,
          updated_at = EXCLUDED.updated_at
      `, values)

      migratedStates += states.rows.length
      console.log(`   Progress: ${migratedStates}/${totalStates} (${Math.round(migratedStates/totalStates*100)}%)`)
    }

    // Fix sequence
    if (totalStates > 0) {
      await newPool.query(`SELECT setval('current_state_id_seq', (SELECT MAX(id) FROM current_state), true)`)
    }
    console.log(`✅ Migrated ${totalStates} current_state records\n`)

    // Verification
    console.log('🔍 Verifying migration...')
    const newContracts = await newPool.query('SELECT COUNT(*) FROM contracts')
    const newEvents = await newPool.query('SELECT COUNT(*) FROM events')
    const newStates = await newPool.query('SELECT COUNT(*) FROM current_state')
    
    console.log(`   Contracts: ${newContracts.rows[0].count}`)
    console.log(`   Events: ${newEvents.rows[0].count}`)
    console.log(`   Current State: ${newStates.rows[0].count}`)
    
    console.log('\n✅ Migration completed successfully!')
    console.log('\n📝 Next steps:')
    console.log('1. Update POSTGRES_URL in Vercel environment variables')
    console.log('2. Update POSTGRES_URL in Render worker environment variables')
    console.log('3. Redeploy both services')

  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await oldPool.end()
    await newPool.end()
  }
}

migrate()
