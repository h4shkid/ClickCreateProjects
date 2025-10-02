'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { TrendingUp, Users, Activity, Calendar, Camera, BarChart3, Images, ExternalLink, CheckCircle } from 'lucide-react'
import Image from 'next/image'
import { useParams } from 'next/navigation'

interface Collection {
  id: string
  address: string
  name: string
  symbol: string
  contractType: 'ERC721' | 'ERC1155'
  chainId: number
  imageUrl?: string
  description?: string
  isVerified: boolean
  websiteUrl?: string
  twitterUrl?: string
  discordUrl?: string
}

interface CollectionAnalytics {
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

export default function CollectionOverviewPage() {
  const params = useParams()
  const address = params?.address as string
  
  const [collection, setCollection] = useState<Collection | null>(null)
  const [analytics, setAnalytics] = useState<CollectionAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (address) {
      fetchCollectionData()
    }
  }, [address])

  const fetchCollectionData = async () => {
    setLoading(true)
    try {
      // Fetch collection info
      const collectionResponse = await fetch(`/api/contracts/${address}`)
      const collectionData = await collectionResponse.json()
      
      if (collectionData.success) {
        setCollection(collectionData.contract)
      }

      // Fetch analytics
      const analyticsResponse = await fetch(`/api/contracts/${address}/analytics/summary`)
      const analyticsData = await analyticsResponse.json()
      
      if (analyticsData.success) {
        setAnalytics(analyticsData.analytics)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load collection data')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
    return n.toLocaleString()
  }

  const getChainName = (chainId: number) => {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      137: 'Polygon',
      42161: 'Arbitrum',
      8453: 'Base',
      360: 'Shape'
    }
    return chains[chainId] || 'Unknown'
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="bg-card/20 rounded-lg p-6">
              <div className="h-20 bg-background/50 rounded mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-background/50 rounded w-1/4"></div>
                <div className="h-4 bg-background/50 rounded w-3/4"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-card/20 rounded-lg p-6">
                  <div className="h-12 bg-background/50 rounded mb-2"></div>
                  <div className="h-4 bg-background/50 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-3xl font-bold mb-4">Collection Not Found</h1>
          <p className="text-muted-foreground mb-8">
            {error || 'The collection you are looking for could not be found.'}
          </p>
          <Link 
            href="/my-collections"
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
          >
            Back to My Collections
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        {/* Collection Header */}
        <div className="bg-gradient-to-br from-card/40 to-card/20 backdrop-blur-md border border-border/50 rounded-xl p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* Collection Image */}
            <div className="flex-shrink-0">
              {collection.imageUrl ? (
                <div className="w-24 h-24 relative rounded-xl overflow-hidden bg-background shadow-lg ring-2 ring-border/50">
                  <Image
                    src={collection.imageUrl}
                    alt={collection.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-border/50">
                  <span className="text-3xl font-bold text-primary">
                    {collection.name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </div>

            {/* Collection Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold text-foreground">{collection.name}</h1>
                {collection.isVerified && (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                )}
              </div>
              
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
                  {collection.contractType}
                </span>
                <span className="text-muted-foreground">
                  {getChainName(collection.chainId)}
                </span>
                <span className="text-muted-foreground font-mono text-sm">
                  {collection.address.slice(0, 8)}...{collection.address.slice(-6)}
                </span>
              </div>

              {collection.description && (
                <p className="text-muted-foreground mb-4 max-w-2xl leading-relaxed">
                  {collection.description}
                </p>
              )}

              {/* External Links */}
              <div className="flex items-center gap-3">
                {collection.websiteUrl && (
                  <a
                    href={collection.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-background/50 hover:bg-background/70 border border-border hover:border-primary/50 rounded-lg transition-colors text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Website
                  </a>
                )}
                <a
                  href={`https://etherscan.io/address/${collection.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-background/50 hover:bg-background/70 border border-border hover:border-primary/50 rounded-lg transition-colors text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Etherscan
                </a>
              </div>
            </div>
          </div>
        </div>

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
            <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/collections/${collection.address}/snapshot`}
                className="flex items-center gap-2 p-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors group"
              >
                <Camera className="w-5 h-5" />
                <span className="font-medium">Snapshot</span>
              </Link>
              
              <Link
                href={`/collections/${collection.address}/analytics`}
                className="flex items-center gap-2 p-3 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-lg transition-colors group"
              >
                <BarChart3 className="w-5 h-5" />
                <span className="font-medium">Analytics</span>
              </Link>
              
              <Link
                href={`/collections/${collection.address}/gallery`}
                className="flex items-center gap-2 p-3 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-lg transition-colors group"
              >
                <Images className="w-5 h-5" />
                <span className="font-medium">Gallery</span>
              </Link>
              
              <Link
                href={`/collections/${collection.address}/monitor`}
                className="flex items-center gap-2 p-3 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-lg transition-colors group"
              >
                <Activity className="w-5 h-5" />
                <span className="font-medium">Monitor</span>
              </Link>
            </div>
          </div>

          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Collection Information</h3>
            <div className="space-y-3">
              {analytics && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Average Holdings</span>
                  <span className="text-foreground font-medium">
                    {formatNumber(analytics.avgHoldingPerUser)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Symbol</span>
                <span className="text-foreground font-medium">{collection.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contract Type</span>
                <span className="text-foreground font-medium">{collection.contractType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium ${collection.isVerified ? 'text-green-500' : 'text-yellow-500'}`}>
                  {collection.isVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity Preview */}
        {analytics && analytics.recentActivity.length > 0 && (
          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
              <Link
                href={`/collections/${collection.address}/monitor`}
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
    </div>
  )
}