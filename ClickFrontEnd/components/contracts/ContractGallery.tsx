'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Search, Filter, Grid, List, ExternalLink, Image as ImageIcon } from 'lucide-react'
import Link from 'next/link'

interface NFTToken {
  tokenId: string
  name?: string
  description?: string
  image?: string
  attributes?: Array<{
    trait_type: string
    value: string
  }>
  owner?: string
  holders?: Array<{
    address: string
    balance: string
  }>
  holderCount?: number
}

interface ContractGalleryProps {
  contractAddress: string
}

export function ContractGallery({ contractAddress }: ContractGalleryProps) {
  const [tokens, setTokens] = useState<NFTToken[]>([])
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [selectedToken, setSelectedToken] = useState<NFTToken | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingHolders, setLoadingHolders] = useState(false)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  const fetchTokens = async (cursor: string | null = null) => {
    setLoadingTokens(true)
    try {
      let url = `/api/gallery/tokens?contract=${contractAddress}&limit=200`
      if (cursor) {
        url += `&next=${cursor}`
      }

      const response = await fetch(url)
      const data = await response.json()

      if (data.success) {
        // Map the response to match our interface
        const mappedTokens = data.data.tokens.map((token: any) => ({
          tokenId: token.tokenId,
          name: token.name,
          description: token.description,
          image: token.imageUrl,
          attributes: token.attributes || []
        }))
        setTokens(mappedTokens)
        setNextCursor(data.data.pagination.next)
      }
    } catch (err) {
      console.error('Failed to load tokens:', err)
    } finally {
      setLoadingTokens(false)
    }
  }

  useEffect(() => {
    if (contractAddress) {
      fetchTokens()
    }
  }, [contractAddress])

  const fetchTokenHolders = async (token: NFTToken) => {
    setLoadingHolders(true)
    try {
      const response = await fetch(`/api/tokens/${contractAddress}/${token.tokenId}/holders`)
      const data = await response.json()

      if (data.success) {
        setSelectedToken({
          ...token,
          holders: data.data.holders,
          holderCount: data.data.holderCount
        })
      } else {
        setSelectedToken(token)
      }
    } catch (err) {
      console.error('Failed to load holders:', err)
      setSelectedToken(token)
    } finally {
      setLoadingHolders(false)
    }
  }

  const handleTokenClick = (token: NFTToken) => {
    setSelectedToken(token)
    fetchTokenHolders(token)
  }

  const handleSnapshot = async () => {
    if (!selectedToken) return

    setSnapshotLoading(true)
    try {
      const response = await fetch('/api/snapshot/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractAddress,
          tokenId: selectedToken.tokenId
        })
      })

      const data = await response.json()

      if (data.success) {
        // Download the snapshot
        const blob = new Blob([JSON.stringify(data.data.snapshot, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `snapshot-${contractAddress}-${selectedToken.tokenId}.json`
        a.click()
      }
    } catch (err) {
      console.error('Failed to generate snapshot:', err)
    } finally {
      setSnapshotLoading(false)
    }
  }

  const filteredTokens = tokens.filter(token =>
    token.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.tokenId.includes(searchQuery)
  )

  if (loadingTokens && tokens.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card-glass animate-pulse">
              <div className="aspect-square bg-background/50 rounded-t-lg"></div>
              <div className="p-4 space-y-2">
                <div className="h-4 bg-background/50 rounded"></div>
                <div className="h-3 bg-background/50 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or token ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 border border-border">
            <Filter className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid' 
                ? 'bg-primary/20 text-primary' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list' 
                ? 'bg-primary/20 text-primary' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Results Count and Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredTokens.length} {filteredTokens.length === 1 ? 'token' : 'tokens'}
        </p>
        {nextCursor && (
          <button
            onClick={() => fetchTokens(nextCursor)}
            disabled={loadingTokens}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed text-sm px-4 py-2"
          >
            Load More →
          </button>
        )}
      </div>

      {/* Gallery Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTokens.map((token) => (
            <div
              key={token.tokenId}
              className="card-glass overflow-hidden cursor-pointer group"
              onClick={() => handleTokenClick(token)}
            >
              <div className="aspect-square relative overflow-hidden rounded-t-lg">
                {token.image ? (
                  <Image
                    src={token.image}
                    alt={token.name || `Token #${token.tokenId}`}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-card">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1 truncate">
                  {token.name || `Token #${token.tokenId}`}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  ID: {token.tokenId}
                </p>
                {token.attributes && token.attributes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {token.attributes.slice(0, 2).map((attr, index) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary"
                      >
                        {attr.value}
                      </span>
                    ))}
                    {token.attributes.length > 2 && (
                      <span className="text-xs px-2 py-1 rounded-md bg-card text-muted-foreground">
                        +{token.attributes.length - 2} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="space-y-4">
          {filteredTokens.map((token) => (
            <div
              key={token.tokenId}
              className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-4 hover:border-primary/50 transition-all duration-200 cursor-pointer"
              onClick={() => handleTokenClick(token)}
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 relative bg-background/50 rounded-lg overflow-hidden flex-shrink-0">
                  {token.image ? (
                    <Image
                      src={token.image}
                      alt={token.name || `Token #${token.tokenId}`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {token.name || `Token #${token.tokenId}`}
                  </h3>
                  <p className="text-sm text-muted-foreground">ID: {token.tokenId}</p>
                  {token.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {token.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredTokens.length === 0 && !loadingTokens && (
        <div className="text-center py-12">
          <ImageIcon className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No tokens found</h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'No NFTs found in this collection'}
          </p>
        </div>
      )}

      {/* Token Detail Modal */}
      {selectedToken && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedToken(null)}
        >
          <div className="card-glass max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">
                  {selectedToken.name || `Token #${selectedToken.tokenId}`}
                </h2>
                <button
                  onClick={() => setSelectedToken(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors text-2xl"
                >
                  ✕
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="aspect-square relative rounded-lg overflow-hidden">
                  {selectedToken.image ? (
                    <Image
                      src={selectedToken.image}
                      alt={selectedToken.name || `Token #${selectedToken.tokenId}`}
                      fill
                      className="object-cover"
                      sizes="500px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-card">
                      <ImageIcon className="w-16 h-16 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-1">Token ID</h3>
                    <p className="text-muted-foreground font-mono text-sm">{selectedToken.tokenId}</p>
                  </div>

                  {selectedToken.description && (
                    <div>
                      <h3 className="font-semibold mb-1">Description</h3>
                      <p className="text-muted-foreground text-sm">{selectedToken.description}</p>
                    </div>
                  )}

                  {/* Holders Section - Only show if loading or data exists */}
                  {(loadingHolders || (selectedToken.holders && selectedToken.holders.length > 0)) && (
                    <div>
                      <h3 className="font-semibold mb-2">Holders {selectedToken.holderCount && `(${selectedToken.holderCount})`}</h3>
                      {loadingHolders ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          <span className="text-sm">Loading holders...</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedToken.holders!.slice(0, 5).map((holder, index) => (
                            <div key={index} className="bg-card/50 rounded-lg p-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-mono text-muted-foreground truncate flex-1">
                                  {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                                </p>
                                <p className="text-xs font-medium">x{holder.balance}</p>
                              </div>
                            </div>
                          ))}
                          {selectedToken.holderCount && selectedToken.holderCount > 5 && (
                            <p className="text-xs text-muted-foreground text-center">
                              +{selectedToken.holderCount - 5} more holders
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedToken.attributes && selectedToken.attributes.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Attributes</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {selectedToken.attributes.map((attr, index) => (
                          <div key={index} className="bg-card rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">{attr.trait_type}</p>
                            <p className="font-medium text-sm">{attr.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="space-y-3 pt-4">
                    {selectedToken.holders && selectedToken.holders.length > 0 && (
                      <button
                        onClick={handleSnapshot}
                        disabled={snapshotLoading}
                        className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {snapshotLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Generating Snapshot...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                            </svg>
                            <span>Download Token Snapshot</span>
                          </>
                        )}
                      </button>
                    )}

                    <div className="flex gap-3">
                      <Link
                        href={`https://opensea.io/assets/ethereum/${contractAddress}/${selectedToken.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        OpenSea
                      </Link>
                      <Link
                        href={`https://etherscan.io/token/${contractAddress}?a=${selectedToken.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Etherscan
                      </Link>
                    </div>
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