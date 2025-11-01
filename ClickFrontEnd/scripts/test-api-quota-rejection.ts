/**
 * Test API rejection when quota is full
 */

async function main() {
  const testWallet = '0x4Ae8B436e50f762Fa8fad29Fd548b375fEe968AC'
  const testContract = '0x60E4d786628Fea6478F785A6d7e704777c86a7c6' // MAYC - known collection

  console.log('🧪 Testing API Quota Rejection\n')
  console.log(`Wallet: ${testWallet}`)
  console.log(`Contract: ${testContract}`)
  console.log(`Expected: 429 status with error message about quota limit\n`)

  try {
    const response = await fetch('http://localhost:3000/api/contracts/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contractAddress: testContract,
        chainId: 1,
        walletAddress: testWallet
      })
    })

    console.log(`📡 Response Status: ${response.status} ${response.statusText}`)

    const data = await response.json()

    console.log('\n📦 Response Body:')
    console.log(JSON.stringify(data, null, 2))

    if (response.status === 429) {
      console.log('\n✅ CORRECT: API rejected with 429 status')
    } else {
      console.log('\n❌ ERROR: API should return 429 status when quota is full')
    }

    if (data.success === false && data.error) {
      console.log('✅ CORRECT: Error message present')
    } else {
      console.log('❌ ERROR: Error message missing or success=true')
    }

  } catch (error: any) {
    console.error('❌ Network error:', error.message)
  }
}

main()
