import { NextRequest, NextResponse } from 'next/server'
import { isExistingCollection, getCollectionInfo } from '@/lib/auth/new-sync-limit'

/**
 * Check if a contract exists in database
 *
 * GET /api/contracts/[address]/check
 *
 * Returns:
 * - exists: boolean - Whether contract is in database
 * - isNew: boolean - Whether it's a new collection (needs sync)
 * - requiresSync: boolean - Whether blockchain sync is needed
 * - canAddWithoutLimit: boolean - Can be added without counting toward limit
 * - contractInfo: object - Contract details if exists
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: 'Contract address is required'
        },
        { status: 400 }
      )
    }

    // Check if contract exists
    const exists = await isExistingCollection(address)
    const isNew = !exists
    const requiresSync = !exists
    const canAddWithoutLimit = exists

    let contractInfo = null
    if (exists) {
      contractInfo = await getCollectionInfo(address)
    }

    return NextResponse.json({
      success: true,
      data: {
        contractAddress: address.toLowerCase(),
        exists,
        isNew,
        requiresSync,
        canAddWithoutLimit,
        contractInfo,
        message: exists
          ? 'This collection is already synced and can be added instantly (no limit)'
          : 'This is a new collection and will require blockchain sync (counts toward your 2-collection limit)'
      }
    })
  } catch (error: any) {
    console.error('❌ Contract check error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check contract status',
        details: error.message
      },
      { status: 500 }
    )
  }
}
