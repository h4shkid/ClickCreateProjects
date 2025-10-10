import { Client } from 'pg'

async function checkPK() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  })

  try {
    await client.connect()

    // Check primary key
    const pk = await client.query(`
      SELECT constraint_name, column_name
      FROM information_schema.key_column_usage
      WHERE table_name = 'events'
        AND constraint_name LIKE '%pkey%'
      ORDER BY ordinal_position
    `)

    console.log('📊 Events table primary key:')
    pk.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}`)
    })

    // Check all constraints
    const constraints = await client.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'events'::regclass
    `)

    console.log('\n📊 All constraints:')
    constraints.rows.forEach((row: any) => {
      const type = row.contype === 'p' ? 'PRIMARY KEY' :
                   row.contype === 'u' ? 'UNIQUE' :
                   row.contype === 'f' ? 'FOREIGN KEY' : row.contype
      console.log(`  - ${row.conname}: ${type}`)
    })

  } finally {
    await client.end()
  }
}

checkPK()
