import { useState, useEffect, useCallback } from 'react'
import { useAccount, useDisconnect } from 'wagmi'
import { useConnectModal } from '@rainbow-me/rainbowkit'

export interface User {
  id: number
  walletAddress: string
  username?: string
  displayName?: string
  bio?: string
  profileImageUrl?: string
  isPublic: boolean
  email?: string
  twitterHandle?: string
  discordHandle?: string
  lastLogin?: string
  createdAt: string
  stats: {
    trackedContracts: number
    totalSnapshots: number
    publicSnapshots: number
  }
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null
  })

  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { openConnectModal } = useConnectModal()

  // Fetch user session from backend
  const fetchSession = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

      const response = await fetch('/api/auth/session')
      const result = await response.json()

      if (result.success) {
        setAuthState({
          user: result.data.user,
          isLoading: false,
          isAuthenticated: true,
          error: null
        })
      } else {
        setAuthState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null
        })
      }
    } catch (error) {
      console.error('Session fetch failed:', error)
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: 'Failed to fetch session'
      })
    }
  }, [])

  // Handle wallet connection changes
  useEffect(() => {
    if (isConnected && address) {
      // Wallet is connected, check for existing session
      fetchSession()
    } else {
      // Wallet disconnected
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null
      })
    }
  }, [isConnected, address, fetchSession])

  // Sign in with wallet
  const signIn = useCallback(async () => {
    if (!isConnected) {
      // Open wallet connection modal
      openConnectModal?.()
      return
    }

    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }))
      
      // The SIWE flow will be handled by the AppKit/wagmi integration
      // The backend will verify the signature and create the session
      await fetchSession()
      
    } catch (error) {
      console.error('Sign in failed:', error)
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Sign in failed'
      }))
    }
  }, [isConnected, openConnectModal, fetchSession])

  // Sign out
  const signOut = useCallback(async () => {
    try {
      // Call backend to clear session
      await fetch('/api/auth/logout', { method: 'POST' })
      
      // Disconnect wallet
      disconnect()
      
      // Clear local state
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null
      })
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }, [disconnect])

  // Update user profile
  const updateProfile = useCallback(async (updates: Partial<User>) => {
    if (!authState.user) return

    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      const result = await response.json()

      if (result.success) {
        setAuthState(prev => ({
          ...prev,
          user: prev.user ? { ...prev.user, ...result.data.user } : null
        }))
        return true
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Profile update failed:', error)
      setAuthState(prev => ({
        ...prev,
        error: 'Failed to update profile'
      }))
      return false
    }
  }, [authState.user])

  // Refresh user data
  const refreshUser = useCallback(() => {
    if (isConnected) {
      fetchSession()
    }
  }, [isConnected, fetchSession])

  return {
    ...authState,
    signIn,
    signOut,
    updateProfile,
    refreshUser,
    walletAddress: address,
    isWalletConnected: isConnected
  }
}

// Hook for requiring authentication
export function useRequireAuth() {
  const auth = useAuth()

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      // Redirect to sign in or show auth modal
      auth.signIn()
    }
  }, [auth.isLoading, auth.isAuthenticated])

  return auth
}