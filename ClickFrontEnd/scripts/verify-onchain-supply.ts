import { Pool } from 'pg'
import { ethers } from 'ethers'

const POSTGRES_URL = process.env.POSTGRES_URL || "postgres://ca4daf153803706ed28b7b0405128d5897c65b35d96487ed6b0363f56c8c17e6:sk_MLsMuw4nt6ywk9XN19QQw@db.prisma.io:5432/postgres?sslmode=require"
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "8_iY3mDKZOYuNM_fBzS-eIBMq9Sz1x-P"

interface VerificationResult {
  contract: string
  name: string
  onchainSupply: bigint
  dbSupply: bigint
  difference: bigint
  status: 'perfect' | 'minor' | 'major' | 'critical'
}

async function verifyAllContracts() {
  const pool = new Pool({ connectionString: POSTGRES_URL })
  const provider = new ethers.JsonRpcProvider(`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`)

  console.log(`\n🔍 Verifying On-Chain Accuracy for ALL Contracts`)
  console.log('═'.repeat(80))

  const results: VerificationResult[] = []

  try {
    // Get all active ERC721 contracts (ERC1155 is harder to verify)
    const contracts = await pool.query(`
      SELECT address, name, symbol, contract_type
      FROM contracts
      WHERE is_active = true
      ORDER BY id
    `)

    console.log(`\nFound ${contracts.rows.length} active contracts\n`)

    for (const contract of contracts.rows) {
      console.log(`\n${'─'.repeat(80)}`)
      console.log(`📦 ${contract.name} (${contract.symbol})`)
      console.log(`   Address: ${contract.address}`)
      console.log(`   Type: ${contract.contract_type}`)

      // Get DB supply
      const dbStats = await pool.query(`
        SELECT
          COUNT(DISTINCT token_id) FILTER (WHERE CAST(balance AS BIGINT) > 0) as unique_tokens,
          SUM(CAST(balance AS BIGINT)) FILTER (WHERE CAST(balance AS BIGINT) > 0) as total_supply
        FROM current_state
        WHERE LOWER(contract_address) = LOWER($1)
      `, [contract.address])

      const dbSupply = BigInt(dbStats.rows[0].total_supply || 0)
      console.log(`   Database Supply: ${dbSupply}`)

      // Try to get on-chain supply (only works for ERC721 with totalSupply)
      let onchainSupply = BigInt(0)
      let status: 'perfect' | 'minor' | 'major' | 'critical' = 'perfect'

      if (contract.contract_type === 'ERC721') {
        try {
          const abi = ['function totalSupply() view returns (uint256)']
          const tokenContract = new ethers.Contract(contract.address, abi, provider)
          onchainSupply = await tokenContract.totalSupply()

          console.log(`   On-Chain Supply: ${onchainSupply}`)

          const difference = onchainSupply > dbSupply
            ? onchainSupply - dbSupply
            : dbSupply - onchainSupply

          const percentDiff = Number(difference * BigInt(100) / onchainSupply)

          if (difference === BigInt(0)) {
            status = 'perfect'
            console.log(`   ✅ PERFECT MATCH!`)
          } else if (percentDiff < 1) {
            status = 'minor'
            console.log(`   ⚠️  MINOR DIFFERENCE: ${difference} (${percentDiff}%)`)
          } else if (percentDiff < 5) {
            status = 'major'
            console.log(`   🟠 MAJOR DIFFERENCE: ${difference} (${percentDiff}%)`)
          } else {
            status = 'critical'
            console.log(`   🔴 CRITICAL DIFFERENCE: ${difference} (${percentDiff}%)`)
          }

          results.push({
            contract: contract.address,
            name: contract.name,
            onchainSupply,
            dbSupply,
            difference,
            status
          })

        } catch (err: any) {
          console.log(`   ⚠️  Cannot verify (contract may not have totalSupply function)`)
        }
      } else {
        console.log(`   ⚠️  ERC1155 verification not supported (need individual token queries)`)
      }
    }

    // Summary
    console.log(`\n${'═'.repeat(80)}`)
    console.log(`📊 VERIFICATION SUMMARY`)
    console.log('═'.repeat(80))

    const perfect = results.filter(r => r.status === 'perfect')
    const minor = results.filter(r => r.status === 'minor')
    const major = results.filter(r => r.status === 'major')
    const critical = results.filter(r => r.status === 'critical')

    console.log(`\n✅ Perfect Match: ${perfect.length}`)
    console.log(`⚠️  Minor Issues: ${minor.length}`)
    console.log(`🟠 Major Issues: ${major.length}`)
    console.log(`🔴 Critical Issues: ${critical.length}`)

    if (critical.length > 0) {
      console.log(`\n🔴 CRITICAL ISSUES FOUND:`)
      critical.forEach(r => {
        console.log(`   - ${r.name}: Missing ${r.difference} tokens`)
      })
      console.log(`\n💡 Action Required:`)
      console.log(`   1. Re-sync blockchain events for these contracts`)
      console.log(`   2. Run rebuild-contract-state.ts after re-sync`)
    }

    if (major.length > 0) {
      console.log(`\n🟠 MAJOR ISSUES FOUND:`)
      major.forEach(r => {
        console.log(`   - ${r.name}: Off by ${r.difference} tokens`)
      })
      console.log(`\n💡 Recommended: Re-sync these contracts`)
    }

    if (perfect.length === results.length) {
      console.log(`\n🎉 ALL CONTRACTS ARE PERFECTLY ACCURATE!`)
    }

  } catch (error) {
    console.error('\n❌ Error:', error)
  } finally {
    await pool.end()
  }
}

verifyAllContracts()
