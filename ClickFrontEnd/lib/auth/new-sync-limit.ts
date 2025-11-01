/**
 * New Sync Limit System
 *
 * Core Logic:
 * - Each wallet can sync max 2 NEW collections (blockchain sync required)
 * - Existing collections (already in database) don't count toward limit
 * - Snapshots/exports are unlimited
 * - 1 wallet per IP address
 */

import { createDatabaseAdapter } from '../database/adapter'
import { NextRequest } from 'next/server'

export interface NewSyncLimitResult {
  canAddNewSync: boolean
  currentCount: number
  maxCount: number
  activeNewSyncs: ActiveSync[]
}

export interface ActiveSync {
  contractAddress: string
  contractName: string | null
  syncStartedAt: string
  isActive: boolean
}

export interface IPWalletCheck {
  allowed: boolean
  reason?: string
  boundWallet?: string
  expiresAt?: string
}

const MAX_NEW_SYNCS = 2
const IP_BINDING_DURATION_HOURS = 24

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
function getTodayDate(): string {
  const now = new Date()
  return now.toISOString().split('T')[0] // YYYY-MM-DD
}

/**
 * Check if user has reached their DAILY new sync limit
 * Limit resets every day at 00:00 UTC
 */
export async function checkNewSyncLimit(walletAddress: string): Promise<NewSyncLimitResult> {
  const db = createDatabaseAdapter()
  const isPostgres = !!process.env.POSTGRES_URL

  try {
    const today = getTodayDate()

    // Get count of new syncs started TODAY
    let countResult: any
    if (isPostgres) {
      countResult = await db.prepare(`
        SELECT COUNT(*) as count
        FROM wallet_new_syncs
        WHERE LOWER(wallet_address) = LOWER($1)
        AND DATE(sync_started_at) = $2
      `).get(walletAddress, today)
    } else {
      countResult = await db.prepare(`
        SELECT COUNT(*) as count
        FROM wallet_new_syncs
        WHERE LOWER(wallet_address) = LOWER(?)
        AND DATE(sync_started_at) = ?
      `).get(walletAddress, today)
    }

    const currentCount = countResult?.count || 0

    // Get details of today's syncs
    let activeSyncs: any[]
    if (isPostgres) {
      activeSyncs = await db.prepare(`
        SELECT
          wns.contract_address,
          wns.sync_started_at,
          c.name as contract_name
        FROM wallet_new_syncs wns
        LEFT JOIN contracts c ON LOWER(c.address) = LOWER(wns.contract_address)
        WHERE LOWER(wns.wallet_address) = LOWER($1)
        AND DATE(wns.sync_started_at) = $2
        ORDER BY wns.sync_started_at DESC
      `).all(walletAddress, today) as any[]
    } else {
      activeSyncs = await db.prepare(`
        SELECT
          wns.contract_address,
          wns.sync_started_at,
          c.name as contract_name
        FROM wallet_new_syncs wns
        LEFT JOIN contracts c ON LOWER(c.address) = LOWER(wns.contract_address)
        WHERE LOWER(wns.wallet_address) = LOWER(?)
        AND DATE(wns.sync_started_at) = ?
        ORDER BY wns.sync_started_at DESC
      `).all(walletAddress, today) as any[]
    }

    return {
      canAddNewSync: currentCount < MAX_NEW_SYNCS,
      currentCount,
      maxCount: MAX_NEW_SYNCS,
      activeNewSyncs: activeSyncs.map(sync => ({
        contractAddress: sync.contract_address,
        contractName: sync.contract_name,
        syncStartedAt: sync.sync_started_at,
        isActive: true
      }))
    }
  } catch (error: any) {
    console.error('❌ Error checking new sync limit:', error)
    throw error
  }
}

/**
 * Check if contract already exists in database (existing collection)
 */
export async function isExistingCollection(contractAddress: string): Promise<boolean> {
  const db = createDatabaseAdapter()

  try {
    const result = await db.prepare(`
      SELECT id FROM contracts WHERE LOWER(address) = LOWER(?)
    `).get(contractAddress) as any

    return !!result
  } catch (error: any) {
    console.error('❌ Error checking if collection exists:', error)
    return false
  }
}

/**
 * Add a new sync for a wallet (daily limit)
 */
export async function addNewSync(
  walletAddress: string,
  contractAddress: string
): Promise<{ success: boolean; error?: string }> {
  const db = createDatabaseAdapter()

  try {
    // Check daily limit first
    const limit = await checkNewSyncLimit(walletAddress)
    if (!limit.canAddNewSync) {
      return {
        success: false,
        error: `Daily sync limit reached (${limit.currentCount}/${limit.maxCount}). Resets at 00:00 UTC.`
      }
    }

    // Add to wallet_new_syncs (always insert new record, no conflict resolution)
    const isPostgres = !!process.env.POSTGRES_URL
    if (isPostgres) {
      await db.prepare(`
        INSERT INTO wallet_new_syncs (wallet_address, contract_address)
        VALUES (LOWER($1), LOWER($2))
      `).run(walletAddress, contractAddress)
    } else {
      await db.prepare(`
        INSERT INTO wallet_new_syncs (wallet_address, contract_address)
        VALUES (LOWER(?), LOWER(?))
      `).run(walletAddress, contractAddress)
    }

    return { success: true }
  } catch (error: any) {
    console.error('❌ Error adding new sync:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Note: removeSync() function removed
 * With daily limits, there's no need to manually remove syncs
 * Limits automatically reset at 00:00 UTC each day
 */

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP (especially behind proxies)
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip') // Cloudflare

  if (forwardedFor) {
    // x-forwarded-for can be comma-separated list, take first one
    return forwardedFor.split(',')[0].trim()
  }

  if (realIP) {
    return realIP
  }

  if (cfConnectingIP) {
    return cfConnectingIP
  }

  // Fallback to unknown (headers should exist in production with Vercel)
  return 'unknown'
}

/**
 * Check IP-wallet binding (1 wallet per IP)
 */
export async function checkIPWalletBinding(
  ipAddress: string,
  walletAddress: string
): Promise<IPWalletCheck> {
  const db = createDatabaseAdapter()
  const isPostgres = !!process.env.POSTGRES_URL

  try {
    // Get existing binding for this IP
    const binding = await db.prepare(`
      SELECT wallet_address, expires_at
      FROM ip_wallet_binding
      WHERE ip_address = ?
    `).get(ipAddress) as any

    if (!binding) {
      // No binding exists, allow and create binding
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + IP_BINDING_DURATION_HOURS)

      if (isPostgres) {
        await db.prepare(`
          INSERT INTO ip_wallet_binding (ip_address, wallet_address, expires_at)
          VALUES ($1, LOWER($2), $3)
          ON CONFLICT (ip_address) DO UPDATE
          SET wallet_address = LOWER($2), last_seen_at = CURRENT_TIMESTAMP, expires_at = $3
        `).run(ipAddress, walletAddress, expiresAt.toISOString())
      } else {
        await db.prepare(`
          INSERT OR REPLACE INTO ip_wallet_binding
          (ip_address, wallet_address, last_seen_at, expires_at)
          VALUES (?, LOWER(?), CURRENT_TIMESTAMP, ?)
        `).run(ipAddress, walletAddress, expiresAt.toISOString())
      }

      return { allowed: true }
    }

    // Binding exists, check if it's the same wallet
    if (binding.wallet_address.toLowerCase() === walletAddress.toLowerCase()) {
      // Same wallet, update last_seen_at
      await db.prepare(`
        UPDATE ip_wallet_binding
        SET last_seen_at = ${isPostgres ? 'CURRENT_TIMESTAMP' : "datetime('now')"}
        WHERE ip_address = ?
      `).run(ipAddress)

      return { allowed: true }
    }

    // Different wallet, check if binding expired
    const expiresAt = new Date(binding.expires_at)
    const now = new Date()

    if (now > expiresAt) {
      // Binding expired, allow new wallet
      const newExpiresAt = new Date()
      newExpiresAt.setHours(newExpiresAt.getHours() + IP_BINDING_DURATION_HOURS)

      await db.prepare(`
        UPDATE ip_wallet_binding
        SET wallet_address = LOWER(?),
            last_seen_at = ${isPostgres ? 'CURRENT_TIMESTAMP' : "datetime('now')"},
            expires_at = ?
        WHERE ip_address = ?
      `).run(walletAddress, newExpiresAt.toISOString(), ipAddress)

      return { allowed: true }
    }

    // Different wallet and binding still active
    return {
      allowed: false,
      reason: 'Another wallet is already connected from this IP address',
      boundWallet: binding.wallet_address,
      expiresAt: binding.expires_at
    }
  } catch (error: any) {
    console.error('❌ Error checking IP-wallet binding:', error)
    // On error, allow the request (fail open)
    return { allowed: true }
  }
}

/**
 * Increment total_users for a contract
 */
export async function incrementContractUsers(contractAddress: string): Promise<void> {
  const db = createDatabaseAdapter()

  try {
    await db.prepare(`
      UPDATE contracts
      SET total_users = COALESCE(total_users, 0) + 1
      WHERE LOWER(address) = LOWER(?)
    `).run(contractAddress)
  } catch (error: any) {
    console.error('❌ Error incrementing contract users:', error)
  }
}

/**
 * Get collection info including sync metadata
 */
export async function getCollectionInfo(contractAddress: string): Promise<any> {
  const db = createDatabaseAdapter()

  try {
    const info = await db.prepare(`
      SELECT
        id,
        address,
        name,
        symbol,
        contract_type,
        first_synced_by_wallet,
        first_synced_at,
        total_users,
        is_active
      FROM contracts
      WHERE LOWER(address) = LOWER(?)
    `).get(contractAddress) as any

    return info || null
  } catch (error: any) {
    console.error('❌ Error getting collection info:', error)
    return null
  }
}
