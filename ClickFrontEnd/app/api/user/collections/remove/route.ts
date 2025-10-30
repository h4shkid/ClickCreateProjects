import { NextRequest, NextResponse } from 'next/server'
import { removeSync, checkNewSyncLimit } from '@/lib/auth/new-sync-limit'
import { getWalletFromHeaders } from '@/lib/auth/middleware'

/**
 * Remove a collection from user's sync slots
 *
 * DELETE /api/user/collections/remove
 * Header: x-wallet-address (required)
 * Body: { contractAddress: string }
 *
 * Effect:
 * - Sets is_active = 0 in wallet_new_syncs (soft delete)
 * - Decrements total_users in contracts table
 * - Frees up a slot for new sync
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get wallet address from headers
    const walletAddress = getWalletFromHeaders(request)

    if (!walletAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Wallet address required. Connect your wallet first.'
        },
        { status: 401 }
      )
    }

    // Get contract address from body
    const body = await request.json()
    const { contractAddress } = body

    if (!contractAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Contract address is required'
        },
        { status: 400 }
      )
    }

    console.log(`🗑️  Removing collection ${contractAddress} for wallet ${walletAddress}`)

    // Remove sync (soft delete)
    const result = await removeSync(walletAddress, contractAddress)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to remove collection'
        },
        { status: 500 }
      )
    }

    // Get updated limit status
    const limitStatus = await checkNewSyncLimit(walletAddress)

    console.log(`✅ Collection removed. Available slots: ${limitStatus.maxCount - limitStatus.currentCount}/${limitStatus.maxCount}`)

    return NextResponse.json({
      success: true,
      message: 'Collection removed successfully. Slot freed up.',
      data: {
        removedContract: contractAddress.toLowerCase(),
        syncStatus: {
          currentCount: limitStatus.currentCount,
          maxCount: limitStatus.maxCount,
          availableSlots: limitStatus.maxCount - limitStatus.currentCount,
          canAddMore: limitStatus.canAddNewSync
        }
      }
    })
  } catch (error: any) {
    console.error('❌ Collection removal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove collection',
        details: error.message
      },
      { status: 500 }
    )
  }
}
