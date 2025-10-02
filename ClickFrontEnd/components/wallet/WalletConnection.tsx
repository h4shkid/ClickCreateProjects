'use client'

import React, { useState } from 'react'
import { useAppKit } from '@reown/appkit/react'
import { useAccount, useDisconnect } from 'wagmi'
import { Wallet, LogOut, User, Settings, ChevronDown, Copy, ExternalLink } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { getExplorerUrl } from '@/lib/wallet/config'

export function WalletConnection() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const { open } = useAppKit()
  const { address, isConnected, chain } = useAccount()
  const { disconnect } = useDisconnect()
  const { user, isAuthenticated, signOut } = useAuth()

  const handleConnect = () => {
    open()
  }

  const handleDisconnect = async () => {
    await signOut()
    setIsDropdownOpen(false)
  }

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address)
      // You could add a toast notification here
    }
  }

  const openExplorer = () => {
    if (address && chain) {
      const url = getExplorerUrl(chain.id, undefined, address)
      window.open(url, '_blank')
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all duration-200 hover:scale-105"
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-card hover:bg-card/80 border border-border rounded-lg transition-all duration-200"
      >
        <div className="flex items-center gap-2">
          {user?.profileImageUrl ? (
            <img 
              src={user.profileImageUrl} 
              alt="Profile" 
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-3 h-3 text-primary" />
            </div>
          )}
          
          <div className="flex flex-col items-start">
            {user?.username ? (
              <>
                <span className="text-sm font-medium">{user.username}</span>
                <span className="text-xs text-muted-foreground">
                  {address ? formatAddress(address) : 'No address'}
                </span>
              </>
            ) : (
              <span className="text-sm font-medium">
                {address ? formatAddress(address) : 'No address'}
              </span>
            )}
          </div>
        </div>
        
        <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsDropdownOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                {user?.profileImageUrl ? (
                  <img 
                    src={user.profileImageUrl} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  {user?.username && (
                    <div className="font-medium text-sm">{user.username}</div>
                  )}
                  {user?.displayName && (
                    <div className="text-xs text-muted-foreground truncate">
                      {user.displayName}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {address ? formatAddress(address) : 'No address'}
                  </div>
                </div>
              </div>
              
              {isAuthenticated && user && (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-semibold text-primary">
                      {user.stats.trackedContracts}
                    </div>
                    <div className="text-xs text-muted-foreground">Contracts</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-primary">
                      {user.stats.totalSnapshots}
                    </div>
                    <div className="text-xs text-muted-foreground">Snapshots</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-primary">
                      {user.stats.publicSnapshots}
                    </div>
                    <div className="text-xs text-muted-foreground">Public</div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-2">
              <button
                onClick={copyAddress}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted rounded-lg transition-colors"
              >
                <Copy className="w-4 h-4" />
                Copy Address
              </button>
              
              <button
                onClick={openExplorer}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted rounded-lg transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View on Explorer
              </button>
              
              {isAuthenticated && (
                <button
                  onClick={() => {
                    setIsDropdownOpen(false)
                    // Navigate to profile page
                    window.location.href = '/profile'
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted rounded-lg transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Profile Settings
                </button>
              )}
            </div>

            <div className="p-2 border-t border-border">
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Simple connect button for pages where space is limited
export function ConnectWalletButton({ className = '' }: { className?: string }) {
  const { open } = useAppKit()
  const { isConnected } = useAccount()
  const { user } = useAuth()

  if (isConnected && user) {
    return <WalletConnection />
  }

  return (
    <button
      onClick={() => open()}
      className={`flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all duration-200 hover:scale-105 ${className}`}
    >
      <Wallet className="w-4 h-4" />
      Connect Wallet
    </button>
  )
}