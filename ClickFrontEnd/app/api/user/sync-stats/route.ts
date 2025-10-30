import { NextRequest, NextResponse } from 'next/server'
import { checkNewSyncLimit } from '@/lib/auth/new-sync-limit'
import { getWalletFromHeaders } from '@/lib/auth/middleware'
import { createDatabaseAdapter } from '@/lib/database/adapter'

/**
 * Get user's sync statistics
 *
 * GET /api/user/sync-stats
 * Header: x-wallet-address (required)
 *
 * Returns:
 * - newSyncsCount: number - How many NEW syncs user has
 * - maxNewSyncs: number - Maximum NEW syncs allowed (2)
 * - availableSlots: number - How many slots remaining
 * - activeSyncs: array - List of user's NEW syncs
 * - accessibleCollections: array - Existing collections user can access
 */
export async function GET(request: NextRequest) {
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

    // Get new sync limit status
    const limitStatus = await checkNewSyncLimit(walletAddress)

    // Get all accessible collections (existing collections in database)
    const db = createDatabaseAdapter()
    const allCollections = await db.prepare(`
      SELECT
        address,
        name,
        symbol,
        contract_type,
        first_synced_by_wallet,
        first_synced_at,
        total_users
      FROM contracts
      WHERE is_active = 1
      ORDER BY first_synced_at DESC
    `).all() as any[]

    // Separate into user's new syncs vs accessible collections
    const userNewSyncAddresses = new Set(
      limitStatus.activeNewSyncs.map(s => s.contractAddress.toLowerCase())
    )

    const activeSyncs = allCollections
      .filter(c => userNewSyncAddresses.has(c.address.toLowerCase()))
      .map(c => ({
        address: c.address,
        name: c.name,
        symbol: c.symbol,
        contractType: c.contract_type,
        isNew: true,
        countsAsSlot: true,
        canRemove: true,
        syncedBy: c.first_synced_by_wallet,
        syncedAt: c.first_synced_at
      }))

    const accessibleCollections = allCollections
      .filter(c => !userNewSyncAddresses.has(c.address.toLowerCase()))
      .map(c => ({
        address: c.address,
        name: c.name,
        symbol: c.symbol,
        contractType: c.contract_type,
        isNew: false,
        countsAsSlot: false,
        canSnapshot: true,
        addedByOthers: c.first_synced_by_wallet !== walletAddress.toLowerCase(),
        totalUsers: c.total_users || 0
      }))

    return NextResponse.json({
      success: true,
      data: {
        walletAddress,
        newSyncsCount: limitStatus.currentCount,
        maxNewSyncs: limitStatus.maxCount,
        availableSlots: limitStatus.maxCount - limitStatus.currentCount,
        canAddMore: limitStatus.canAddNewSync,
        activeSyncs,
        accessibleCollections,
        totalAccessibleCollections: allCollections.length
      }
    })
  } catch (error: any) {
    console.error('❌ User sync stats error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sync statistics',
        details: error.message
      },
      { status: 500 }
    )
  }
}
