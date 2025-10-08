import { Client } from 'pg'

async function checkUserContracts() {
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
    await client.connect()
    console.log('✅ Connected to Postgres\n')

    // Check user profiles
    const users = await client.query('SELECT * FROM user_profiles')
    console.log('📊 User Profiles:')
    users.rows.forEach((user: any) => {
      console.log(`   ID: ${user.id}`)
      console.log(`   Wallet: ${user.wallet_address}`)
      console.log(`   Username: ${user.username}`)
    })
    console.log('')

    // Check contracts and their user association
    const contracts = await client.query(`
      SELECT id, address, name, symbol, added_by_user_id
      FROM contracts
    `)
    console.log('📊 Contracts:')
    contracts.rows.forEach((contract: any) => {
      console.log(`   ID: ${contract.id}`)
      console.log(`   Name: ${contract.name}`)
      console.log(`   Address: ${contract.address}`)
      console.log(`   Added by user ID: ${contract.added_by_user_id}`)
      console.log('')
    })

    // Check if there's a user_contracts table
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'user_contracts'
    `)

    if (tableCheck.rows.length > 0) {
      console.log('📊 User_contracts table exists')
      const userContracts = await client.query('SELECT * FROM user_contracts')
      console.log(`   Total links: ${userContracts.rows.length}`)
      userContracts.rows.forEach((uc: any) => {
        console.log(`   User ${uc.user_id} -> Contract ${uc.contract_id}`)
      })
    } else {
      console.log('⚠️  No user_contracts table found')
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    await client.end()
  }
}

checkUserContracts()
