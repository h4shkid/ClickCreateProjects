import { NextRequest, NextResponse } from 'next/server'
import { verifyMessage } from 'viem'
import { SignJWT } from 'jose'
import { createDatabaseAdapter } from '@/lib/database/adapter'

// JWT secret - in production, use a secure environment variable
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
)

interface VerifySignatureRequest {
  message: string
  signature: `0x${string}`
  cacao?: any // SIWE CACAO object
}

export async function POST(request: NextRequest) {
  try {
    const db = createDatabaseAdapter()
    const { message, signature }: VerifySignatureRequest = await request.json()

    // Extract wallet address from the message
    const addressMatch = message.match(/Wallet address: (0x[a-fA-F0-9]{40})/)
    if (!addressMatch) {
      return NextResponse.json({
        success: false,
        error: 'Invalid message format'
      }, { status: 400 })
    }

    const walletAddress = addressMatch[1].toLowerCase()

    // Verify the signature
    const isValid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message,
      signature
    })

    if (!isValid) {
      return NextResponse.json({
        success: false,
        error: 'Invalid signature'
      }, { status: 401 })
    }

    // Create or update user profile
    const upsertUser = db.prepare(`
      INSERT INTO user_profiles (wallet_address, last_login, created_at, updated_at)
      VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(wallet_address) DO UPDATE SET
        last_login = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `)

    const result = await upsertUser.run(walletAddress)
    
    // Get user profile
    const getUser = db.prepare('SELECT * FROM user_profiles WHERE wallet_address = ?')
    const user = getUser.get(walletAddress) as any

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create user profile'
      }, { status: 500 })
    }

    // Log user activity
    const logActivity = db.prepare(`
      INSERT INTO user_activity (user_id, activity_type, created_at)
      VALUES (?, 'login', CURRENT_TIMESTAMP)
    `)

    await logActivity.run(user.id)

    // Create JWT token
    const token = await new SignJWT({
      userId: user.id,
      walletAddress: user.wallet_address,
      username: user.username,
      isPublic: user.is_public
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d') // 7 days
      .sign(JWT_SECRET)

    // Set HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          username: user.username,
          displayName: user.display_name,
          isPublic: user.is_public,
          profileImageUrl: user.profile_image_url
        }
      }
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    })

    return response

  } catch (error: any) {
    console.error('Signature verification error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}