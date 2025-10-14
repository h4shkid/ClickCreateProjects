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
    ensName?: string | null
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

      if (!response.ok) {
        console.error('[Gallery] Holders API failed:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        console.error('[Gallery] Error details:', errorData)
        setSelectedToken(token)
        return
      }

      const data = await response.json()
      console.log('[Gallery] Holders response:', data)

      if (data.success && data.data.holders) {
        const holders = data.data.holders

        // Resolve ENS names for holders (server-side batch request)
        const addresses = holders.map((h: any) => h.address)

        try {
          const ensResponse = await fetch('/api/ens/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses })
          })

          const ensData = await ensResponse.json()
          const ensResults = ensData.success ? ensData.data : {}

          // Add ENS names to holders
          const holdersWithENS = holders.map((holder: any) => ({
            ...holder,
            ensName: ensResults[holder.address] || null
          }))

          setSelectedToken({
            ...token,
            holders: holdersWithENS,
            holderCount: data.data.holderCount
          })
        } catch (ensError) {
          console.warn('[Gallery] ENS resolution failed, showing without ENS names:', ensError)
          // If ENS resolution fails, still show holders without ENS names
          setSelectedToken({
            ...token,
            holders,
            holderCount: data.data.holderCount
          })
        }
      } else {
        console.warn('[Gallery] No holders data in response')
        setSelectedToken(token)
      }
    } catch (err) {
      console.error('[Gallery] Failed to load holders:', err)
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
          className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedToken(null)}
        >
          <div
            className="bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-primary/20 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2 gradient-text">
                    {selectedToken.name || `Token #${selectedToken.tokenId}`}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Token ID:</span>
                    <span className="font-mono text-sm font-medium">{selectedToken.tokenId}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedToken(null)}
                  className="p-2 hover:bg-background/50 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Image Section */}
                <div className="space-y-4">
                  <div className="aspect-square relative rounded-xl overflow-hidden border-2 border-primary/20 shadow-lg">
                    {selectedToken.image ? (
                      <Image
                        src={selectedToken.image}
                        alt={selectedToken.name || `Token #${selectedToken.tokenId}`}
                        fill
                        className="object-cover"
                        sizes="500px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-card to-background">
                        <ImageIcon className="w-20 h-20 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
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

                {/* Info Section */}
                <div className="space-y-6">
                  {selectedToken.description && (
                    <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Description
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{selectedToken.description}</p>
                    </div>
                  )}

                  {/* Holders Section - Only show if loading or data exists */}
                  {(loadingHolders || (selectedToken.holders && selectedToken.holders.length > 0)) && (
                    <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Top Holders
                        {selectedToken.holderCount && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                            {selectedToken.holderCount} total
                          </span>
                        )}
                      </h3>
                      {loadingHolders ? (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                          <span className="text-sm">Loading holders...</span>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                          {selectedToken.holders!.slice(0, 10).map((holder, index) => (
                            <Link
                              key={index}
                              href={`https://opensea.io/${holder.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-gradient-to-r from-card/30 to-card/10 hover:from-primary/20 hover:to-primary/10 border border-border/30 hover:border-primary/30 rounded-lg p-3 transition-all duration-200 flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                  index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                  index === 1 ? 'bg-gray-400/20 text-gray-400' :
                                  index === 2 ? 'bg-orange-500/20 text-orange-500' :
                                  'bg-primary/10 text-primary'
                                }`}>
                                  {index + 1}
                                </div>
                                <div className="flex flex-col flex-1 min-w-0">
                                  {holder.ensName ? (
                                    <>
                                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                        {holder.ensName}
                                      </p>
                                      <p className="text-xs font-mono text-muted-foreground truncate">
                                        {holder.address}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-xs font-mono text-muted-foreground group-hover:text-foreground transition-colors truncate">
                                      {holder.address}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded">
                                  ×{holder.balance}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                              </div>
                            </Link>
                          ))}
                          {selectedToken.holderCount && selectedToken.holderCount > 10 && (
                            <div className="text-center pt-3 border-t border-border/50 mt-3">
                              <p className="text-xs text-muted-foreground">
                                +{selectedToken.holderCount - 10} more holders
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedToken.attributes && selectedToken.attributes.length > 0 && (
                    <div className="bg-background/50 rounded-xl p-4 border border-border/50">
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Attributes
                      </h3>
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                        {selectedToken.attributes.map((attr, index) => (
                          <div key={index} className="bg-gradient-to-br from-card/50 to-card/30 border border-primary/10 rounded-lg p-3 hover:border-primary/30 transition-colors">
                            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{attr.trait_type}</p>
                            <p className="font-semibold text-sm text-foreground">{attr.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Snapshot Button */}
                  {selectedToken.holders && selectedToken.holders.length > 0 && (
                    <button
                      onClick={handleSnapshot}
                      disabled={snapshotLoading}
                      className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl"
                    >
                      {snapshotLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Generating Snapshot...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                          <span>Download Token Snapshot</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}