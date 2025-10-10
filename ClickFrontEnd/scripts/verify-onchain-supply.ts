import { Client } from 'pg'

async function verify() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  })
  
  await client.connect()
  const res = await client.query(`SELECT COUNT(*) FROM events WHERE block_number BETWEEN 23526505 AND 23526510`)
  console.log('Events in 23526505-23526510:', res.rows[0].count)
  await client.end()
}
verify()
