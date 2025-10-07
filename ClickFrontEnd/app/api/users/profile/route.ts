import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, sanitizeInput } from '@/lib/auth/middleware'
import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
db.pragma('journal_mode = WAL')

// GET user profile
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    const getProfile = db.prepare(`
      SELECT 
        up.*,
        COUNT(DISTINCT us.contract_id) as tracked_contracts,
        COUNT(us.id) as total_snapshots,
        COUNT(CASE WHEN us.is_public = 1 THEN 1 END) as public_snapshots,
        COUNT(uf.id) as favorite_contracts
      FROM user_profiles up
      LEFT JOIN user_snapshots us ON up.id = us.user_id
      LEFT JOIN user_favorites uf ON up.id = uf.user_id AND uf.favorite_type = 'contract'
      WHERE up.id = ? AND up.is_active = 1
      GROUP BY up.id
    `)

    const profile = getProfile.get(user.userId) as any

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: 'Profile not found'
      }, { status: 404 })
    }

    // Get recent activity
    const getActivity = db.prepare(`
      SELECT activity_type, created_at, metadata
      FROM user_activity 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `)

    const recentActivity = getActivity.all(user.userId) as any

    return NextResponse.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          walletAddress: profile.wallet_address,
          username: profile.username,
          displayName: profile.display_name,
          bio: profile.bio,
          profileImageUrl: profile.profile_image_url,
          isPublic: profile.is_public,
          email: profile.email,
          twitterHandle: profile.twitter_handle,
          discordHandle: profile.discord_handle,
          lastLogin: profile.last_login,
          createdAt: profile.created_at,
          stats: {
            trackedContracts: profile.tracked_contracts || 0,
            totalSnapshots: profile.total_snapshots || 0,
            publicSnapshots: profile.public_snapshots || 0,
            favoriteContracts: profile.favorite_contracts || 0
          }
        },
        recentActivity
      }
    })

  } catch (error: any) {
    console.error('Profile fetch error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}

// PUT update user profile
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const updates = await request.json()

    // Validate and sanitize inputs
    const allowedFields = [
      'username',
      'display_name',
      'bio',
      'profile_image_url',
      'is_public',
      'email',
      'twitter_handle',
      'discord_handle'
    ]

    const sanitizedUpdates: any = {}
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (typeof updates[field] === 'string') {
          sanitizedUpdates[field] = sanitizeInput(updates[field])
        } else if (typeof updates[field] === 'boolean') {
          sanitizedUpdates[field] = updates[field]
        }
      }
    }

    // Special validation for username
    if (sanitizedUpdates.username) {
      // Check if username is already taken
      const checkUsername = db.prepare(
        'SELECT id FROM user_profiles WHERE username = ? AND id != ?'
      )
      const existingUser = checkUsername.get(sanitizedUpdates.username, user.userId) as any
      
      if (existingUser) {
        return NextResponse.json({
          success: false,
          error: 'Username is already taken'
        }, { status: 400 })
      }

      // Validate username format
      if (!/^[a-zA-Z0-9_-]{3,20}$/.test(sanitizedUpdates.username)) {
        return NextResponse.json({
          success: false,
          error: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens'
        }, { status: 400 })
      }
    }

    // Special validation for email
    if (sanitizedUpdates.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(sanitizedUpdates.email)) {
        return NextResponse.json({
          success: false,
          error: 'Invalid email format'
        }, { status: 400 })
      }
    }

    // Build dynamic update query
    const updateFields = Object.keys(sanitizedUpdates)
    if (updateFields.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No valid fields to update'
      }, { status: 400 })
    }

    const setClause = updateFields.map(field => `${field} = ?`).join(', ')
    const updateQuery = `
      UPDATE user_profiles 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `

    const updateValues = [...updateFields.map(field => sanitizedUpdates[field]), user.userId]
    
    const updateResult = db.prepare(updateQuery).run(...updateValues)

    if (updateResult.changes === 0) {
      return NextResponse.json({
        success: false,
        error: 'No changes made'
      }, { status: 400 })
    }

    // Log the activity
    const logActivity = db.prepare(`
      INSERT INTO user_activity (user_id, activity_type, metadata, created_at)
      VALUES (?, 'profile_updated', ?, CURRENT_TIMESTAMP)
    `)

    logActivity.run(
      user.userId, 
      JSON.stringify({ updatedFields: updateFields })
    )

    // Return updated profile
    const getUpdatedProfile = db.prepare(`
      SELECT 
        up.*,
        COUNT(DISTINCT us.contract_id) as tracked_contracts,
        COUNT(us.id) as total_snapshots,
        COUNT(CASE WHEN us.is_public = 1 THEN 1 END) as public_snapshots
      FROM user_profiles up
      LEFT JOIN user_snapshots us ON up.id = us.user_id
      WHERE up.id = ?
      GROUP BY up.id
    `)

    const updatedProfile = getUpdatedProfile.get(user.userId) as any

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: updatedProfile.id,
          walletAddress: updatedProfile.wallet_address,
          username: updatedProfile.username,
          displayName: updatedProfile.display_name,
          bio: updatedProfile.bio,
          profileImageUrl: updatedProfile.profile_image_url,
          isPublic: updatedProfile.is_public,
          email: updatedProfile.email,
          twitterHandle: updatedProfile.twitter_handle,
          discordHandle: updatedProfile.discord_handle,
          lastLogin: updatedProfile.last_login,
          createdAt: updatedProfile.created_at,
          stats: {
            trackedContracts: updatedProfile.tracked_contracts || 0,
            totalSnapshots: updatedProfile.total_snapshots || 0,
            publicSnapshots: updatedProfile.public_snapshots || 0
          }
        }
      }
    })

  } catch (error: any) {
    console.error('Profile update error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}