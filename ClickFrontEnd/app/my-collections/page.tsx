'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Search, Camera, BarChart3, Images, Activity, ExternalLink, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAccount } from 'wagmi'
import QuickAddCollection from '@/components/collections/QuickAddCollection'

interface UserCollection {
  id: string
  address: string
  name: string
  symbol: string
  contractType: 'ERC721' | 'ERC1155'
  chainId: number
  description?: string
  imageUrl?: string
  isVerified: boolean
  holderCount?: number
  totalSupply?: string
  usageCount: number
  lastUsed?: string
  addedAt: string
}

export default function MyCollectionsPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const { isConnected, address } = useAccount()
  const [mounted, setMounted] = useState(false)
  const [collections, setCollections] = useState<UserCollection[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddCollection, setShowAddCollection] = useState(false)
  const [tooltipContent, setTooltipContent] = useState<string | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })

  // Handle hydration - wait for client-side mount
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && isConnected && address) {
      fetchCollections()
    }
  }, [mounted, isConnected, address])

  const fetchCollections = async () => {
    if (!address) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/users/contracts?walletAddress=${encodeURIComponent(address)}`)
      const data = await response.json()
      if (data.success) {
        setCollections(data.data.collections || [])
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error)
    } finally {
      setLoading(false)
    }
  }

  const removeCollection = async (collectionId: string) => {
    if (!confirm('Remove this collection from your list?')) return
    
    if (!address) {
      console.error('Wallet address not available')
      return
    }
    
    try {
      const response = await fetch(`/api/users/contracts/${collectionId}?walletAddress=${encodeURIComponent(address)}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setCollections(prev => prev.filter(c => c.id !== collectionId))
        console.log('Collection removed successfully:', data.data?.contractName)
      } else {
        console.error('Failed to remove collection:', data.error)
        alert(data.error || 'Failed to remove collection')
      }
    } catch (error) {
      console.error('Failed to remove collection:', error)
      alert('Network error occurred while removing collection')
    }
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

  const handleMouseEnter = (e: React.MouseEvent, description: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
    setTooltipContent(description)
  }

  const handleMouseLeave = () => {
    setTooltipContent(null)
  }

  const filteredCollections = collections.filter(collection =>
    (collection.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (collection.symbol?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (collection.address?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  )

  // Show loading during hydration
  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card/20 rounded-lg p-6">
                  <div className="h-16 bg-background/50 rounded mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-background/50 rounded w-3/4"></div>
                    <div className="h-4 bg-background/50 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-3xl font-bold mb-4">My Collections</h1>
          <p className="text-muted-foreground mb-8">
            Please connect your wallet to view your collections
          </p>
          <Link 
            href="/"
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            My Collections
          </h1>
          <p className="text-muted-foreground">
            Manage and analyze your tracked NFT collections
          </p>
        </div>

        {/* Search and Add */}
        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
            <button
              onClick={() => setShowAddCollection(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Collection
            </button>
          </div>
        </div>

        {/* Collections Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="text-center py-12">
            <Images className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchQuery ? 'No collections found' : 'No collections yet'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : 'Add your first collection to start generating snapshots'
              }
            </p>
            <button
              onClick={() => setShowAddCollection(true)}
              className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
            >
              Add Your First Collection
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCollections.map((collection) => (
              <div key={collection.id} className="group bg-gradient-to-br from-card/40 to-card/20 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-500">
                {/* Header */}
                <div className="relative p-6">
                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      removeCollection(collection.id)
                    }}
                    className="absolute top-4 right-4 p-2 rounded-full bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-start gap-4">
                    {/* Collection Logo */}
                    <div className="relative">
                      {collection.imageUrl ? (
                        <div className="w-16 h-16 relative rounded-lg overflow-hidden bg-background shadow-lg ring-2 ring-border/50 flex-shrink-0">
                          <Image
                            src={collection.imageUrl}
                            alt={collection.name}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center shadow-lg ring-2 ring-border/50">
                          <span className="text-xl font-bold text-primary">
                            {collection.name?.charAt(0) || '?'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Collection Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-foreground truncate mb-1">
                        {collection.name || 'Unknown Collection'}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full">
                          {collection.contractType || 'Unknown'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getChainName(collection.chainId || 1)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {collection.address ? `${collection.address.slice(0, 8)}...${collection.address.slice(-6)}` : 'Unknown Address'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                {(collection.holderCount || collection.usageCount > 0) && (
                  <div className="px-6 pb-4">
                    <div className="flex items-center justify-between text-sm">
                      {collection.holderCount && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <span>{collection.holderCount.toLocaleString()} holders</span>
                        </div>
                      )}
                      {collection.usageCount > 0 && (
                        <span className="text-muted-foreground">
                          {collection.usageCount} snapshots
                        </span>
                      )}
                    </div>
                    {collection.lastUsed && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Last used {new Date(collection.lastUsed).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Description */}
                {collection.description && (
                  <div className="px-6 pb-4">
                    <div className="bg-background/30 backdrop-blur-sm rounded-lg p-3 border border-border/30">
                      <p 
                        className="text-sm text-muted-foreground leading-relaxed line-clamp-2 cursor-help"
                        onMouseEnter={(e) => handleMouseEnter(e, collection.description)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {collection.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="px-6 pb-6">
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/collections/${collection.address}/snapshot`}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm"
                    >
                      <Camera className="w-4 h-4" />
                      Snapshot
                    </Link>
                    <Link
                      href={`/collections/${collection.address}/analytics`}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-lg transition-colors text-sm"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Analytics
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <Link
                      href={`/collections/${collection.address}/gallery`}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-lg transition-colors text-sm"
                    >
                      <Images className="w-4 h-4" />
                      Gallery
                    </Link>
                    <Link
                      href={`/collections/${collection.address}/monitor`}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-lg transition-colors text-sm"
                    >
                      <Activity className="w-4 h-4" />
                      Monitor
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Collection Modal */}
        <QuickAddCollection
          isOpen={showAddCollection}
          onClose={() => setShowAddCollection(false)}
          onSuccess={(collection) => {
            // Add the new collection to the list with proper structure
            if (collection && collection.address) {
              const formattedCollection = {
                id: collection.id || Date.now().toString(),
                address: collection.address,
                name: collection.name || 'Unknown Collection',
                symbol: collection.symbol || 'UNKNOWN',
                contractType: collection.contractType || 'ERC1155' as const,
                chainId: collection.chainId || 1,
                description: collection.description || '',
                imageUrl: collection.imageUrl || '',
                isVerified: collection.isVerified || false,
                holderCount: collection.holderCount || 0,
                totalSupply: collection.totalSupply || '0',
                usageCount: collection.usageCount || 0,
                lastUsed: collection.lastUsed || undefined,
                addedAt: collection.addedAt || new Date().toISOString()
              }
              setCollections(prev => [formattedCollection, ...prev])
            }
            setShowAddCollection(false)
          }}
        />

        {/* Global Tooltip */}
        {tooltipContent && (
          <div 
            className="fixed z-[100] pointer-events-none"
            style={{
              left: `${tooltipPosition.x}px`,
              top: `${tooltipPosition.y}px`,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="bg-gray-900 text-white text-sm rounded-lg py-2 px-3 max-w-sm shadow-xl border border-gray-700 backdrop-blur-sm">
              <div className="whitespace-pre-wrap break-words">
                {tooltipContent}
              </div>
              {/* Arrow pointing down */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}