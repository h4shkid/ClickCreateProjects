import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'data', 'nft-snapshot.db'))
db.pragma('journal_mode = WAL')

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
)

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      // For now, return a simple response indicating no user is logged in
      // but don't return a 401 error
      return NextResponse.json({
        success: true,
        data: {
          user: null
        }
      })
    }

    // Verify JWT token
    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    const userId = payload.userId as number
    
    // Get fresh user data from database
    const getUser = db.prepare(`
      SELECT 
        up.*,
        COUNT(DISTINCT us.contract_id) as tracked_contracts,
        COUNT(us.id) as total_snapshots,
        COUNT(CASE WHEN us.is_public = 1 THEN 1 END) as public_snapshots
      FROM user_profiles up
      LEFT JOIN user_snapshots us ON up.id = us.user_id
      WHERE up.id = ? AND up.is_active = 1
      GROUP BY up.id
    `)

    const user = getUser.get(userId) as any

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found or inactive'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          username: user.username,
          displayName: user.display_name,
          bio: user.bio,
          profileImageUrl: user.profile_image_url,
          isPublic: user.is_public,
          email: user.email,
          twitterHandle: user.twitter_handle,
          discordHandle: user.discord_handle,
          lastLogin: user.last_login,
          createdAt: user.created_at,
          stats: {
            trackedContracts: user.tracked_contracts || 0,
            totalSnapshots: user.total_snapshots || 0,
            publicSnapshots: user.public_snapshots || 0
          }
        }
      }
    })

  } catch (error: any) {
    console.error('Session verification error:', error)
    return NextResponse.json({
      success: false,
      error: 'Invalid or expired token'
    }, { status: 401 })
  }
}