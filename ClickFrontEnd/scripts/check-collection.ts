import { createDatabaseAdapter } from '../lib/database/adapter'

const contractAddress = '0x6339e5e072086621540d0362c4e3cea0d643e114'

async function checkCollection() {
  try {
    // Check OpenSea API
    const apiKey = process.env.OPENSEA_API_KEY
    if (!apiKey) {
      console.log('❌ No OpenSea API key found')
      process.exit(1)
    }

    console.log(`\n🔍 Checking collection: ${contractAddress}\n`)

    const response = await fetch(`https://api.opensea.io/api/v2/chain/ethereum/contract/${contractAddress}`, {
      headers: {
        'x-api-key': apiKey
      }
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ Collection found on OpenSea:')
      console.log(JSON.stringify(data, null, 2))
    } else {
      console.log('❌ OpenSea error:', data)
    }

    // Check database
    const db = createDatabaseAdapter()
    const contract = db.prepare(`
      SELECT * FROM contracts
      WHERE LOWER(address) = LOWER(?)
    `).get(contractAddress)

    console.log('\n📊 Database check:')
    console.log(contract ? '✅ Contract exists in database' : '❌ Contract NOT in database')

  } catch (error: any) {
    console.error('Error:', error.message)
  }
}

checkCollection()
