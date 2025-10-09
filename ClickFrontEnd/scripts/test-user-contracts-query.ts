import { Client } from 'pg'

async function testUserContractsQuery() {
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

    const walletAddress = '0x4ae8b436e50f762fa8fad29fd548b375fee968ac'

    // Exact query from API route (without COLLATE NOCASE)
    const query = `
      SELECT
        c.id,
        c.address,
        c.name,
        c.symbol,
        c.contract_type as contractType,
        c.chain_id as chainId,
        c.description,
        c.website_url as websiteUrl,
        c.twitter_url as twitterUrl,
        c.discord_url as discordUrl,
        c.image_url as imageUrl,
        c.banner_image_url as bannerImageUrl,
        c.is_verified as isVerified,
        c.usage_count as usageCount,
        c.total_supply as totalSupply,
        c.created_at as addedAt,
        MAX(ca.total_holders) as holderCount,
        COUNT(DISTINCT us.id) as userSnapshots
      FROM contracts c
      LEFT JOIN user_profiles up ON up.wallet_address = $1
      LEFT JOIN contract_analytics ca ON c.id = ca.contract_id
        AND ca.analysis_date = (
          SELECT MAX(analysis_date)
          FROM contract_analytics
          WHERE contract_id = c.id
        )
      LEFT JOIN user_snapshots us ON c.id = us.contract_id AND us.user_id = up.id
      WHERE c.added_by_user_id = up.id
      GROUP BY c.id, c.address, c.name, c.symbol, c.contract_type, c.chain_id,
               c.description, c.website_url, c.twitter_url, c.discord_url,
               c.image_url, c.banner_image_url, c.is_verified, c.usage_count,
               c.total_supply, c.created_at
      ORDER BY c.usage_count DESC, c.created_at DESC
    `

    console.log('🔍 Running query with wallet:', walletAddress)
    const result = await client.query(query, [walletAddress])

    console.log('\n📊 Query Results:')
    console.log('   Row count:', result.rows.length)
    console.log('   Rows:', JSON.stringify(result.rows, null, 2))

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await client.end()
  }
}

testUserContractsQuery()
