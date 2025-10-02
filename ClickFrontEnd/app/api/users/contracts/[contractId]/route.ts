import { NextRequest, NextResponse } from 'next/server'
import { isValidEthereumAddress } from '@/lib/auth/middleware'
import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
db.pragma('journal_mode = WAL')

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const { contractId } = await params
    const { searchParams } = new URL(request.url)
    const walletAddress = searchParams.get('walletAddress')

    // Validate wallet address
    if (!walletAddress || !isValidEthereumAddress(walletAddress)) {
      return NextResponse.json({
        success: false,
        error: 'Valid wallet address is required'
      }, { status: 401 })
    }

    // Validate contract ID
    if (!contractId || isNaN(parseInt(contractId))) {
      return NextResponse.json({
        success: false,
        error: 'Valid contract ID is required'
      }, { status: 400 })
    }

    // Get user profile
    const userProfile = db.prepare('SELECT id FROM user_profiles WHERE wallet_address = ? COLLATE NOCASE').get(walletAddress.toLowerCase())
    
    if (!userProfile) {
      return NextResponse.json({
        success: false,
        error: 'User profile not found'
      }, { status: 404 })
    }

    // Check if contract exists and belongs to user
    const contract = db.prepare(`
      SELECT c.id, c.address, c.name 
      FROM contracts c 
      WHERE c.id = ? AND c.added_by_user_id = ?
    `).get(parseInt(contractId), userProfile.id)

    if (!contract) {
      return NextResponse.json({
        success: false,
        error: 'Contract not found or you do not have permission to remove it'
      }, { status: 404 })
    }

    // Start transaction
    const transaction = db.transaction(() => {
      // Log user activity
      const insertActivity = db.prepare(`
        INSERT INTO user_activity (user_id, activity_type, contract_id, metadata, created_at)
        VALUES (?, 'contract_removed', ?, ?, CURRENT_TIMESTAMP)
      `)
      
      insertActivity.run(
        userProfile.id,
        contract.id,
        JSON.stringify({
          contractAddress: contract.address,
          contractName: contract.name,
          removedAt: new Date().toISOString()
        })
      )

      // Delete the contract (this will cascade to related data)
      const deleteContract = db.prepare('DELETE FROM contracts WHERE id = ? AND added_by_user_id = ?')
      const result = deleteContract.run(contract.id, userProfile.id)

      return result
    })

    const result = transaction()

    if (result.changes === 0) {
      return NextResponse.json({
        success: false,
        error: 'Failed to remove contract'
      }, { status: 500 })
    }

    console.log(`✅ Contract ${contract.name || contract.address} removed by user ${walletAddress}`)

    return NextResponse.json({
      success: true,
      message: 'Contract removed successfully',
      data: {
        contractId: contract.id,
        contractAddress: contract.address,
        contractName: contract.name
      }
    })

  } catch (error) {
    console.error('Contract removal error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}