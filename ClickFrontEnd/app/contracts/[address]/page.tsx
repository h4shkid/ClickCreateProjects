'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { TrendingUp, Users, Activity, Calendar, Camera, BarChart3, Images } from 'lucide-react'
import { useContract } from '@/lib/contracts/ContractContext'

interface ContractAnalytics {
  totalHolders: number
  totalSupply: string
  avgHoldingPerUser: string
  totalTransfers: number
  last24hTransfers: number
  topHolders: Array<{
    address: string
    balance: string
    percentage: string
  }>
  recentActivity: Array<{
    type: 'mint' | 'transfer' | 'burn'
    from?: string
    to?: string
    tokenId?: string
    amount?: string
    timestamp: string
    txHash: string
  }>
}

export default function ContractOverviewPage() {
  const { contract, isLoading, error } = useContract()
  const [analytics, setAnalytics] = useState<ContractAnalytics | null>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!contract) return
      
      setLoadingAnalytics(true)
      try {
        const response = await fetch(`/api/contracts/${contract.address}/analytics/summary`)
        const data = await response.json()
        
        if (data.success) {
          setAnalytics(data.analytics)
        }
      } catch (err) {
        console.error('Failed to load analytics:', err)
      } finally {
        setLoadingAnalytics(false)
      }
    }

    fetchAnalytics()
  }, [contract])

  const formatNumber = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
    return n.toLocaleString()
  }

  if (isLoading || !contract) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card/20 rounded-lg p-6">
              <div className="h-12 bg-background/50 rounded mb-2"></div>
              <div className="h-4 bg-background/50 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link 
          href="/contracts"
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
        >
          Back to Contracts
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Quick Stats */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">
                {formatNumber(analytics.totalHolders)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Total Holders</p>
          </div>

          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">
                {formatNumber(analytics.totalSupply)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Total Supply</p>
          </div>

          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">
                {formatNumber(analytics.totalTransfers)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Total Transfers</p>
          </div>

          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold text-foreground">
                {formatNumber(analytics.last24hTransfers)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">24h Transfers</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Contract Information</h3>
          <div className="space-y-3">
            {analytics && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Holdings</span>
                  <span className="text-foreground font-medium">
                    {formatNumber(analytics.avgHoldingPerUser)}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Symbol</span>
              <span className="text-foreground font-medium">{contract.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contract Type</span>
              <span className="text-foreground font-medium">{contract.contractType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={`font-medium ${contract.isVerified ? 'text-green-500' : 'text-yellow-500'}`}>
                {contract.isVerified ? 'Verified' : 'Unverified'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href={`/contracts/${contract.address}/analytics`}
              className="flex items-center gap-2 p-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors group"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="font-medium">Analytics</span>
            </Link>
            
            <Link
              href={`/contracts/${contract.address}/snapshot`}
              className="flex items-center gap-2 p-3 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-lg transition-colors group"
            >
              <Camera className="w-5 h-5" />
              <span className="font-medium">Snapshot</span>
            </Link>
            
            <Link
              href={`/contracts/${contract.address}/gallery`}
              className="flex items-center gap-2 p-3 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-lg transition-colors group"
            >
              <Images className="w-5 h-5" />
              <span className="font-medium">Gallery</span>
            </Link>
            
            <Link
              href={`/contracts/${contract.address}/monitor`}
              className="flex items-center gap-2 p-3 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-lg transition-colors group"
            >
              <Activity className="w-5 h-5" />
              <span className="font-medium">Monitor</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity Preview */}
      {analytics && analytics.recentActivity.length > 0 && (
        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
            <Link
              href={`/contracts/${contract.address}/monitor`}
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {analytics.recentActivity.slice(0, 5).map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === 'mint' ? 'bg-green-500' :
                    activity.type === 'transfer' ? 'bg-blue-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="text-foreground capitalize font-medium">{activity.type}</p>
                    {activity.tokenId && (
                      <p className="text-sm text-muted-foreground">
                        Token #{activity.tokenId}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {new Date(activity.timestamp).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}