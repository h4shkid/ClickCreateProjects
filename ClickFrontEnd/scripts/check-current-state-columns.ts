import { Client } from 'pg'

async function checkSchema() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    const schema = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'current_state'
      ORDER BY ordinal_position
    `)

    console.log('📊 current_state table columns:')
    schema.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`)
    })

  } finally {
    await client.end()
  }
}

checkSchema()
