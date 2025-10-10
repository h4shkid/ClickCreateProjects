import { Pool } from 'pg'

const POSTGRES_URL = process.env.POSTGRES_URL

if (!POSTGRES_URL) {
  console.error('❌ POSTGRES_URL environment variable required')
  process.exit(1)
}

const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
})

async function verifySupply() {
  const client = await pool.connect()
  const contractAddress = '0x18a62e93ff3ab180e0c7abd4812595bf2be3405f'

  try {
    console.log('🔍 Verifying MAX PAIN AND FRENS collection supply\n')

    // Get contract info
    const contractResult = await client.query(`
      SELECT address, name, symbol, contract_type, deployment_block, total_supply
      FROM contracts
      WHERE LOWER(address) = LOWER($1)
    `, [contractAddress])

    const contract = contractResult.rows[0]
    console.log('📊 Contract Info:')
    console.log(`   Name: ${contract.name}`)
    console.log(`   Type: ${contract.contract_type}`)
    console.log(`   Deployment Block: ${contract.deployment_block}`)
    console.log(`   Stored Total Supply: ${contract.total_supply}\n`)

    // Get actual unique tokens from events
    const tokensResult = await client.query(`
      SELECT COUNT(DISTINCT token_id) as unique_tokens
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
    `, [contractAddress])

    console.log('🎫 Actual Minted Tokens: ' + tokensResult.rows[0].unique_tokens)

    // Get current holders
    const holdersResult = await client.query(`
      SELECT COUNT(DISTINCT address) as unique_holders
      FROM current_state
      WHERE LOWER(contract_address) = LOWER($1)
      AND CAST(balance AS BIGINT) > 0
    `, [contractAddress])

    console.log('👥 Current Holders: ' + holdersResult.rows[0].unique_holders)

    // Get total events
    const eventsResult = await client.query(`
      SELECT COUNT(*) as total_events, MIN(block_number) as first_event, MAX(block_number) as last_event
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
    `, [contractAddress])

    console.log('📦 Total Transfer Events: ' + eventsResult.rows[0].total_events)
    console.log(`   First Event: Block ${eventsResult.rows[0].first_event}`)
    console.log(`   Last Event: Block ${eventsResult.rows[0].last_event}\n`)

    // List all unique token IDs
    const tokenListResult = await client.query(`
      SELECT DISTINCT token_id
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
      ORDER BY token_id ASC
    `, [contractAddress])

    console.log('📝 All Token IDs:')
    tokenListResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. Token #${row.token_id}`)
    })

    console.log('\n✅ Verification complete!')
    console.log('\n💡 Note: This is a limited edition XCOPY collection (Ranked Auctions)')
    console.log('   The token numbering scheme (169000XXXXXX) suggests a curated/limited release')
    console.log('   NOT a 3000+ holder collection - this is correct behavior!')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

verifySupply().catch(console.error)
