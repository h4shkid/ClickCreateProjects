'use client'

import { useState, useEffect } from 'react'
import { useContract } from '@/lib/contracts/ContractContext'
import { BarChart3, TrendingUp, Users, Activity, PieChart, Calendar } from 'lucide-react'

interface ContractAnalyticsProps {
  contractAddress: string
}

export function ContractAnalytics({ contractAddress }: ContractAnalyticsProps) {
  const { contract, isLoading } = useContract()
  const [analytics, setAnalytics] = useState<any>(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(false)

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoadingAnalytics(true)
      try {
        const response = await fetch(`/api/contracts/${contractAddress}/analytics/summary`)
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

    if (contractAddress) {
      fetchAnalytics()
    }
  }, [contractAddress])

  if (isLoading || loadingAnalytics) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card/20 rounded-lg p-6 animate-pulse">
              <div className="h-12 bg-background/50 rounded mb-4"></div>
              <div className="h-6 bg-background/50 rounded mb-2"></div>
              <div className="h-4 bg-background/50 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Holder Analysis</h3>
              <p className="text-sm text-muted-foreground">Distribution patterns</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Holders</span>
              <span className="font-medium text-foreground">
                {analytics?.totalHolders?.toLocaleString() || '---'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg Holdings</span>
              <span className="font-medium text-foreground">
                {analytics?.avgHoldingPerUser || '---'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Supply Metrics</h3>
              <p className="text-sm text-muted-foreground">Total and circulating</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Supply</span>
              <span className="font-medium text-foreground">
                {analytics?.totalSupply || '---'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Contract Type</span>
              <span className="font-medium text-foreground">
                {contract?.contractType || '---'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Activity Stats</h3>
              <p className="text-sm text-muted-foreground">Transfer patterns</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Transfers</span>
              <span className="font-medium text-foreground">
                {analytics?.totalTransfers?.toLocaleString() || '---'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">24h Transfers</span>
              <span className="font-medium text-foreground">
                {analytics?.last24hTransfers?.toLocaleString() || '---'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <PieChart className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Holder Distribution</h3>
          </div>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Distribution chart coming soon</p>
            </div>
          </div>
        </div>

        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Transfer Timeline</h3>
          </div>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Timeline chart coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Holders */}
      {analytics?.topHolders && analytics.topHolders.length > 0 && (
        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-foreground mb-6">Top Holders</h3>
          <div className="space-y-4">
            {analytics.topHolders.slice(0, 10).map((holder: any, index: number) => (
              <div key={holder.address} className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-mono text-foreground text-sm">
                      {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                    </p>
                    <p className="text-xs text-muted-foreground">{holder.percentage}% of supply</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-foreground">{holder.balance}</p>
                  <p className="text-xs text-muted-foreground">tokens</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}