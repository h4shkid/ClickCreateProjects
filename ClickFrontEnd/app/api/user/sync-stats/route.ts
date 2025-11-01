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
    const isPostgres = !!process.env.POSTGRES_URL

    // Use TRUE for PostgreSQL (boolean), 1 for SQLite (integer)
    const activeValue = isPostgres ? 'TRUE' : '1'
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
      WHERE is_active = ${activeValue}
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

    // Calculate reset time (tomorrow at 00:00 UTC)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(0, 0, 0, 0)
    const hoursUntilReset = Math.floor((tomorrow.getTime() - now.getTime()) / (1000 * 60 * 60))

    return NextResponse.json({
      success: true,
      data: {
        walletAddress,
        dailySyncsToday: limitStatus.currentCount,
        maxDailySyncs: limitStatus.maxCount,
        availableToday: limitStatus.maxCount - limitStatus.currentCount,
        canAddMore: limitStatus.canAddNewSync,
        resetTime: tomorrow.toISOString(),
        hoursUntilReset,
        todaysSyncs: activeSyncs,
        accessibleCollections,
        totalAccessibleCollections: allCollections.length
      }
    })
  } catch (error: any) {
    console.error('❌ User sync stats error:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch sync statistics',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
