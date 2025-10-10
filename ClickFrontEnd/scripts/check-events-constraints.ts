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

async function checkConstraints() {
  const client = await pool.connect()

  try {
    console.log('🔍 Checking events table constraints...\n')

    // Get all constraints on events table
    const constraints = await client.query(`
      SELECT
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        CASE con.contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'f' THEN 'FOREIGN KEY'
          WHEN 'c' THEN 'CHECK'
        END AS type_desc,
        pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE rel.relname = 'events'
      ORDER BY con.contype, con.conname
    `)

    console.log('📊 Constraints on events table:')
    constraints.rows.forEach(row => {
      console.log(`\n   ${row.constraint_name} (${row.type_desc})`)
      console.log(`   ${row.definition}`)
    })

    // Get all indexes
    const indexes = await client.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'events'
      ORDER BY indexname
    `)

    console.log('\n\n📊 Indexes on events table:')
    indexes.rows.forEach(row => {
      console.log(`\n   ${row.indexname}`)
      console.log(`   ${row.indexdef}`)
    })

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

checkConstraints().catch(console.error)
