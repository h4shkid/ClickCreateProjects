import { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
)

export interface AuthUser {
  userId: number
  walletAddress: string
  username?: string
  isPublic: boolean
}

/**
 * Verify JWT token and return user data
 */
export async function verifyAuth(request: NextRequest): Promise<AuthUser | null> {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return null
    }

    const { payload } = await jwtVerify(token, JWT_SECRET)
    
    return {
      userId: payload.userId as number,
      walletAddress: payload.walletAddress as string,
      username: payload.username as string,
      isPublic: payload.isPublic as boolean
    }

  } catch (error) {
    console.error('Auth verification failed:', error)
    return null
  }
}

/**
 * Require authentication for API routes
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser> {
  const user = await verifyAuth(request)
  
  if (!user) {
    throw new Error('Authentication required')
  }
  
  return user
}

/**
 * Check if user owns a resource (like a snapshot)
 */
export function checkOwnership(user: AuthUser, resourceUserId: number): boolean {
  return user.userId === resourceUserId
}

/**
 * Rate limiting by wallet address
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  walletAddress: string, 
  maxRequests: number = 100, 
  windowMs: number = 60 * 1000 // 1 minute
): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(walletAddress)

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize rate limit
    rateLimitMap.set(walletAddress, {
      count: 1,
      resetTime: now + windowMs
    })
    return true
  }

  if (userLimit.count >= maxRequests) {
    return false // Rate limit exceeded
  }

  userLimit.count++
  return true
}

/**
 * Sanitize user input for database queries
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/script/gi, '') // Remove script tags
    .trim()
    .slice(0, 500) // Limit length
}

/**
 * Validate Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Get supported chain IDs
 */
export function getSupportedChains(): number[] {
  return [1, 137, 42161, 8453, 360] // Ethereum, Polygon, Arbitrum, Base, Shape
}

/**
 * Check if a chain ID is supported
 */
export function isSupportedChain(chainId: number): boolean {
  return getSupportedChains().includes(chainId)
}

/**
 * Get wallet address from request headers
 */
export function getWalletFromHeaders(request: NextRequest): string | null {
  const walletAddress = request.headers.get('x-wallet-address')
  
  if (walletAddress && isValidEthereumAddress(walletAddress)) {
    return walletAddress.toLowerCase()
  }
  
  return null
}

/**
 * Simplified auth that works with just wallet connection
 */
export function requireWalletAuth(request: NextRequest): { walletAddress: string } {
  const walletAddress = getWalletFromHeaders(request)
  
  if (!walletAddress) {
    throw new Error('Wallet address required')
  }
  
  return { walletAddress }
}

/**
 * Validate contract address and detect type
 */
export async function validateContractAddress(address: string, chainId?: number): Promise<{
  isValid: boolean
  type?: 'ERC721' | 'ERC1155'
  error?: string
}> {
  if (!isValidEthereumAddress(address)) {
    return { isValid: false, error: 'Invalid Ethereum address format' }
  }

  if (chainId && !isSupportedChain(chainId)) {
    return { isValid: false, error: 'Unsupported chain ID' }
  }

  try {
    // This would typically use a Web3 provider to check the contract
    // For now, we'll assume it's valid if the format is correct
    return { isValid: true, type: 'ERC1155' } // Default assumption
  } catch (error) {
    return { isValid: false, error: 'Contract validation failed' }
  }
}