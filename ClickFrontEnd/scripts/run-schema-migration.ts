import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

async function runMigration() {
  const postgresUrl = process.env.POSTGRES_URL

  if (!postgresUrl) {
    console.error('❌ POSTGRES_URL environment variable is required')
    process.exit(1)
  }

  const client = new Client({
    connectionString: postgresUrl,
    ssl: {
      rejectUnauthorized: false
    }
  })

  try {
    console.log('🔌 Connecting to Postgres...')
    await client.connect()
    console.log('✅ Connected to Postgres')

    // Read schema file
    const schemaPath = path.join(__dirname, '..', 'migrations', '001_initial_postgres_schema.sql')
    const schema = fs.readFileSync(schemaPath, 'utf-8')

    console.log('📄 Running schema migration...')
    await client.query(schema)
    console.log('✅ Schema migration completed successfully!')

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `)

    console.log('\n📊 Created tables:')
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`)
    })

    console.log(`\n✅ Total tables created: ${result.rows.length}`)

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    await client.end()
    console.log('🔌 Disconnected from Postgres')
  }
}

runMigration()
