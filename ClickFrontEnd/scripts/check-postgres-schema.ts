import { Client } from 'pg'

async function checkSchema() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()
    console.log('✅ Connected to Postgres\n')

    // Check events table schema
    const eventsSchema = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'events'
      ORDER BY ordinal_position
    `)

    console.log('📊 Events table columns:')
    eventsSchema.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`)
    })

    // Check if we have value, amount, or quantity column
    const hasValue = eventsSchema.rows.some((r: any) => r.column_name === 'value')
    const hasAmount = eventsSchema.rows.some((r: any) => r.column_name === 'amount')
    const hasQuantity = eventsSchema.rows.some((r: any) => r.column_name === 'quantity')

    console.log(`\n✅ Has 'value' column: ${hasValue}`)
    console.log(`✅ Has 'amount' column: ${hasAmount}`)
    console.log(`✅ Has 'quantity' column: ${hasQuantity}`)

  } finally {
    await client.end()
  }
}

checkSchema()
