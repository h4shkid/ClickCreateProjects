import { Pool } from 'pg'
import { ethers } from 'ethers'

const POSTGRES_URL = process.env.POSTGRES_URL
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

if (!POSTGRES_URL || !ALCHEMY_KEY) {
  console.error('❌ Environment variables required')
  process.exit(1)
}

const pool = new Pool({
  connectionString: POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
})

async function checkContract() {
  const client = await pool.connect()
  const contractAddress = '0x18a62e93ff3ab180e0c7abd4812595bf2be3405f'

  try {
    // Get from database
    const dbResult = await client.query(`
      SELECT address, name, symbol, contract_type, deployment_block, total_supply
      FROM contracts
      WHERE LOWER(address) = LOWER($1)
    `, [contractAddress])

    console.log('📊 Database info:')
    console.log(dbResult.rows[0])

    // Check on blockchain
    const provider = new ethers.JsonRpcProvider(
      `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
    )

    const contract = new ethers.Contract(contractAddress, [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function totalSupply() view returns (uint256)',
      'function balanceOf(address) view returns (uint256)',
      'function ownerOf(uint256) view returns (address)',
      'function supportsInterface(bytes4) view returns (bool)'
    ], provider)

    console.log('\n🔍 Blockchain info:')

    try {
      const name = await contract.name()
      console.log(`   Name: ${name}`)
    } catch (e) {
      console.log('   Name: N/A')
    }

    try {
      const symbol = await contract.symbol()
      console.log(`   Symbol: ${symbol}`)
    } catch (e) {
      console.log('   Symbol: N/A')
    }

    try {
      const totalSupply = await contract.totalSupply()
      console.log(`   Total Supply: ${totalSupply.toString()}`)
    } catch (e) {
      console.log('   Total Supply: N/A')
    }

    // Check ERC721
    const ERC721_INTERFACE = '0x80ac58cd'
    const ERC1155_INTERFACE = '0xd9b67a26'

    try {
      const isERC721 = await contract.supportsInterface(ERC721_INTERFACE)
      const isERC1155 = await contract.supportsInterface(ERC1155_INTERFACE)
      console.log(`\n   Supports ERC721: ${isERC721}`)
      console.log(`   Supports ERC1155: ${isERC1155}`)
    } catch (e) {
      console.log('   Interface check failed')
    }

    // Get actual event count from Etherscan-style API
    const deployBlock = dbResult.rows[0].deployment_block
    const currentBlock = await provider.getBlockNumber()

    console.log(`\n📦 Fetching sample events from blocks ${deployBlock} to ${parseInt(deployBlock) + 2000}...`)

    const logs = await provider.getLogs({
      address: contractAddress,
      fromBlock: parseInt(deployBlock),
      toBlock: Math.min(parseInt(deployBlock) + 2000, currentBlock),
      topics: [
        ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'] // Transfer
      ]
    })

    console.log(`   Found ${logs.length} Transfer events in first 2000 blocks`)

    if (logs.length > 0) {
      console.log(`\n   Sample event:`)
      console.log(`   Topics: ${logs[0].topics.length}`)
      logs[0].topics.forEach((topic, i) => {
        console.log(`   Topic ${i}: ${topic}`)
      })
      console.log(`   Data: ${logs[0].data}`)
    }

    // Check events in DB
    const eventsInDb = await client.query(`
      SELECT COUNT(*) as count, MIN(block_number) as min_block, MAX(block_number) as max_block
      FROM events
      WHERE LOWER(contract_address) = LOWER($1)
    `, [contractAddress])

    console.log(`\n📊 Events in database:`)
    console.log(eventsInDb.rows[0])

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

checkContract().catch(console.error)
