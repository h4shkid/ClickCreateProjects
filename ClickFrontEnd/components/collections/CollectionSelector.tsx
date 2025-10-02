'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { ChevronDown, Plus, Search, CheckCircle } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAccount } from 'wagmi'

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
}

interface CollectionSelectorProps {
  selectedCollection: Collection | null
  onSelect: (collection: Collection | null) => void
  onAddNew: () => void
  className?: string
}

export default function CollectionSelector({ 
  selectedCollection, 
  onSelect, 
  onAddNew,
  className = '' 
}: CollectionSelectorProps) {
  const { isAuthenticated } = useAuth()
  const { isConnected, address } = useAccount()
  const [isOpen, setIsOpen] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isConnected && isOpen && address) {
      fetchCollections()
    }
  }, [isConnected, isOpen, address])

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

  const filteredCollections = collections.filter(collection =>
    (collection.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (collection.symbol?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (collection.address?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  )

  if (!isConnected) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-full px-4 py-3 bg-background/50 border border-border rounded-md text-muted-foreground flex items-center justify-between">
          <span>Connect wallet to select collection</span>
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-background/50 border border-border rounded-md text-foreground hover:border-primary/50 transition-colors flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {selectedCollection ? (
            <>
              {/* Collection Image */}
              {selectedCollection.imageUrl ? (
                <div className="w-8 h-8 relative rounded-md overflow-hidden flex-shrink-0">
                  <Image
                    src={selectedCollection.imageUrl}
                    alt={selectedCollection.name}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </div>
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-primary/20 to-accent/20 rounded-md flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {selectedCollection.name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              
              {/* Collection Info */}
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedCollection.name || 'Unknown Collection'}</span>
                  {selectedCollection.isVerified && (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {selectedCollection.contractType || 'Unknown'} • {getChainName(selectedCollection.chainId || 1)}
                </div>
              </div>
            </>
          ) : (
            <span className="text-muted-foreground">Select a collection</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-card border border-border rounded-md shadow-lg z-[100] max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search collections..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-primary/50"
                autoFocus
              />
            </div>
          </div>

          {/* Collections List */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : filteredCollections.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-3">
                  {searchQuery ? 'No collections found' : 'No collections added yet'}
                </p>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    onAddNew()
                  }}
                  className="text-primary hover:underline text-sm"
                >
                  Add your first collection
                </button>
              </div>
            ) : (
              <>
                {filteredCollections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => {
                      onSelect(collection)
                      setIsOpen(false)
                      setSearchQuery('')
                    }}
                    className="w-full px-4 py-3 hover:bg-background/50 transition-colors flex items-center gap-3 text-left"
                  >
                    {/* Collection Image */}
                    {collection.imageUrl ? (
                      <div className="w-10 h-10 relative rounded-md overflow-hidden flex-shrink-0">
                        <Image
                          src={collection.imageUrl}
                          alt={collection.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-accent/20 rounded-md flex items-center justify-center flex-shrink-0">
                        <span className="text-lg font-bold text-primary">
                          {collection.name?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                    
                    {/* Collection Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{collection.name || 'Unknown Collection'}</span>
                        {collection.isVerified && (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {collection.contractType || 'Unknown'} • {getChainName(collection.chainId || 1)}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {collection.address ? `${collection.address.slice(0, 8)}...${collection.address.slice(-6)}` : 'Unknown Address'}
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Add New Collection */}
          <div className="border-t border-border p-3">
            <button
              onClick={() => {
                setIsOpen(false)
                onAddNew()
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New Collection
            </button>
          </div>
        </div>
      )}

      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[90]" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}