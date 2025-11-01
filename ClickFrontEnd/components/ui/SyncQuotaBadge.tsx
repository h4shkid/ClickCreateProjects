'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import axios from 'axios'

interface SyncQuotaData {
  dailySyncsToday: number
  maxDailySyncs: number
  availableToday: number
  resetTime: string
  hoursUntilReset: number
}

export default function SyncQuotaBadge() {
  const { address, isConnected } = useAccount()
  const [quota, setQuota] = useState<SyncQuotaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    if (!isConnected || !address) {
      setQuota(null)
      return
    }

    fetchQuota()
    // Refresh every 30 seconds (for testing) - can increase to 5 min later
    const interval = setInterval(fetchQuota, 30 * 1000)
    return () => clearInterval(interval)
  }, [isConnected, address])

  // Also listen for custom event to refresh quota immediately
  useEffect(() => {
    const handleRefreshQuota = () => {
      console.log('🔄 Refreshing quota on demand...')
      fetchQuota()
    }

    window.addEventListener('refreshSyncQuota', handleRefreshQuota)
    return () => window.removeEventListener('refreshSyncQuota', handleRefreshQuota)
  }, [address])

  const fetchQuota = async () => {
    if (!address) return

    try {
      setLoading(true)
      console.log('🔍 Fetching sync quota for:', address)

      const response = await axios.get('/api/user/sync-stats', {
        headers: {
          'x-wallet-address': address
        }
      })

      console.log('📊 Sync quota response:', response.data)

      if (response.data.success) {
        setQuota(response.data.data)
        console.log('✅ Quota set:', response.data.data)
      } else {
        console.warn('⚠️ API returned success: false')
        // Set default quota on API failure
        setQuota({
          dailySyncsToday: 0,
          maxDailySyncs: 2,
          availableToday: 2,
          resetTime: new Date().toISOString(),
          hoursUntilReset: 24
        })
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch sync quota:', error)
      console.error('Error details:', error.response?.data)

      // Set default quota on error (assume full quota available)
      setQuota({
        dailySyncsToday: 0,
        maxDailySyncs: 2,
        availableToday: 2,
        resetTime: new Date().toISOString(),
        hoursUntilReset: 24
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isConnected) {
    return null
  }

  // Show loading state while fetching
  if (!quota && loading) {
    return (
      <div className="px-3 py-1.5 rounded-full border border-border/30 bg-card/50">
        <div className="flex items-center space-x-1.5">
          <svg className="w-3.5 h-3.5 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs text-muted-foreground">...</span>
        </div>
      </div>
    )
  }

  // Don't render if no quota data after loading
  if (!quota) {
    return null
  }

  const { availableToday, maxDailySyncs, hoursUntilReset } = quota
  const percentUsed = ((maxDailySyncs - availableToday) / maxDailySyncs) * 100

  // Badge color based on remaining quota
  const getBadgeColor = () => {
    if (availableToday === 0) return 'bg-red-500/20 text-red-400 border-red-500/30'
    if (availableToday === 1) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    return 'bg-green-500/20 text-green-400 border-green-500/30'
  }

  return (
    <div className="relative">
      {/* Badge */}
      <div
        className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-help ${getBadgeColor()}`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-center space-x-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>{availableToday}/{maxDailySyncs}</span>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute right-0 top-full mt-2 w-64 z-50 animate-fade-in">
          <div className="glass rounded-lg border border-border/50 shadow-lg overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/30 bg-card/50">
              <h4 className="text-sm font-semibold text-foreground">Daily Sync Quota</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                New collections you can sync today
              </p>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Used Today</span>
                  <span className="text-xs font-semibold text-foreground">
                    {maxDailySyncs - availableToday} / {maxDailySyncs}
                  </span>
                </div>
                <div className="h-2 bg-card rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      availableToday === 0
                        ? 'bg-red-500'
                        : availableToday === 1
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${percentUsed}%` }}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-start space-x-2">
                <div className={`mt-0.5 h-2 w-2 rounded-full ${
                  availableToday > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`} />
                <div className="flex-1">
                  {availableToday > 0 ? (
                    <p className="text-xs text-foreground">
                      <span className="font-semibold text-green-400">{availableToday} sync{availableToday > 1 ? 's' : ''}</span> available
                    </p>
                  ) : (
                    <p className="text-xs text-foreground">
                      <span className="font-semibold text-red-400">Quota exhausted</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Resets in <span className="font-medium text-foreground">{hoursUntilReset}h</span> at 00:00 UTC
                  </p>
                </div>
              </div>

              {/* Info */}
              <div className="pt-2 border-t border-border/30">
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-green-400">✓</span>
                    <span>Existing collections: unlimited</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-green-400">✓</span>
                    <span>Snapshots & exports: unlimited</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-orange-400">⚡</span>
                    <span>New blockchain syncs: {maxDailySyncs}/day</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
