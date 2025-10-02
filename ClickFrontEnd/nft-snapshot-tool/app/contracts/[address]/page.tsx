'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft, ExternalLink, TrendingUp, Users, Activity, Calendar, CheckCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Contract {
  id: string
  address: string
  name: string
  symbol: string
  contractType: 'ERC721' | 'ERC1155'
  chainId: number
  isVerified: boolean
  description?: string
  websiteUrl?: string
  twitterUrl?: string
  discordUrl?: string
  holderCount?: number
  totalSupply?: string
  addedByUserId: string
  createdAt: string
  usageCount: number
}

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

export default function ContractAnalyticsPage() {
  const params = useParams()
  const address = params.address as string
  
  const [contract, setContract] = useState<Contract | null>(null)
  const [analytics, setAnalytics] = useState<ContractAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'holders' | 'activity'>('overview')

  useEffect(() => {
    const fetchContractData = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(`/api/contracts/${address}`)
        const data = await response.json()

        if (data.success) {
          setContract(data.data.contract)
          setAnalytics(data.data.analytics)
        } else {
          setError(data.error || 'Contract not found')
        }
      } catch (err) {
        setError('Failed to load contract data')
      } finally {
        setLoading(false)
      }
    }

    if (address) {
      fetchContractData()
    }
  }, [address])

  const getChainName = (chainId: number) => {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      137: 'Polygon',
      42161: 'Arbitrum',
      8453: 'Base'
    }
    return chains[chainId] || 'Unknown'
  }

  const formatNumber = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
    return n.toLocaleString()
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000)

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading contract data...</p>
        </div>
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-foreground mb-2">Contract not found</p>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Link 
            href="/contracts"
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
          >
            Back to Contracts
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/contracts"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contracts
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-foreground">{contract.name}</h1>
                {contract.isVerified && (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                )}
                <span className="px-3 py-1 bg-primary/10 text-primary rounded text-sm">
                  {contract.contractType}
                </span>
              </div>
              <p className="text-muted-foreground font-mono text-lg mb-2">{contract.address}</p>
              <p className="text-muted-foreground">
                {getChainName(contract.chainId)} • Symbol: {contract.symbol}
              </p>
              {contract.description && (
                <p className="text-foreground mt-4 max-w-2xl">{contract.description}</p>
              )}
            </div>

            <div className="flex gap-3">
              {contract.websiteUrl && (
                <a
                  href={contract.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-md transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Website
                </a>
              )}
              <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors">
                Generate Snapshot
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
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

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-border">
            <nav className="flex space-x-8">
              {[
                { key: 'overview', label: 'Overview' },
                { key: 'holders', label: 'Top Holders' },
                { key: 'activity', label: 'Recent Activity' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-2 px-1 border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'overview' && analytics && (
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Contract Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Average Holdings</span>
                    <span className="text-foreground font-medium">
                      {formatNumber(analytics.avgHoldingPerUser)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Usage Count</span>
                    <span className="text-foreground font-medium">{contract.usageCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Added</span>
                    <span className="text-foreground font-medium">
                      {new Date(contract.createdAt).toLocaleDateString()}
                    </span>
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
                <div className="space-y-3">
                  <button className="w-full px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors text-left">
                    Generate Current Snapshot
                  </button>
                  <button className="w-full px-4 py-2 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-md transition-colors text-left">
                    View Historical Data
                  </button>
                  <button className="w-full px-4 py-2 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-md transition-colors text-left">
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'holders' && analytics && (
            <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Top Holders</h3>
              <div className="space-y-4">
                {analytics.topHolders.map((holder, index) => (
                  <div key={holder.address} className="flex items-center justify-between p-4 bg-background/50 rounded-md">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-mono text-foreground">{formatAddress(holder.address)}</p>
                        <p className="text-sm text-muted-foreground">{holder.percentage}% of supply</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">{formatNumber(holder.balance)}</p>
                      <p className="text-sm text-muted-foreground">tokens</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'activity' && analytics && (
            <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Recent Activity</h3>
              <div className="space-y-4">
                {analytics.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-background/50 rounded-md">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.type === 'mint' ? 'bg-green-500' :
                        activity.type === 'transfer' ? 'bg-blue-500' : 'bg-red-500'
                      }`} />
                      <div>
                        <p className="text-foreground capitalize">{activity.type}</p>
                        {activity.from && activity.to && (
                          <p className="text-sm text-muted-foreground">
                            {formatAddress(activity.from)} → {formatAddress(activity.to)}
                          </p>
                        )}
                        {activity.tokenId && (
                          <p className="text-sm text-muted-foreground">
                            Token #{activity.tokenId}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">{formatTimeAgo(activity.timestamp)}</p>
                      <a
                        href={`https://etherscan.io/tx/${activity.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        View Tx
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}