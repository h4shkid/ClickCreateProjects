'use client'

import { useState, useEffect } from 'react'
import { Search, Filter, Grid, List, Download, ExternalLink, RefreshCw, Image as ImageIcon } from 'lucide-react'
import axios from 'axios'
import NFTImage from '@/components/ui/NFTImage'

interface NFTMetadata {
  tokenId: string
  name: string
  description: string
  image: string
  attributes: Array<{
    trait_type: string
    value: string | number
  }>
  owner?: string
  balance?: string
}

interface GalleryData {
  nfts: NFTMetadata[]
  totalCount: number
  currentPage: number
  totalPages: number
}

export default function GalleryPage() {
  const [loading, setLoading] = useState(true)
  const [galleryData, setGalleryData] = useState<GalleryData | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [selectedNFT, setSelectedNFT] = useState<NFTMetadata | null>(null)
  const [filterAttribute, setFilterAttribute] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(24) // Increased to show more items
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    fetchGallery()
  }, [page, itemsPerPage])

  const fetchGallery = async () => {
    setLoading(true)
    
    try {
      const response = await axios.get('/api/nft/tokens', {
        params: {
          limit: showAll ? 1000 : itemsPerPage,
          offset: showAll ? 0 : (page - 1) * itemsPerPage,
          sortBy: 'holders'
        }
      })
      
      if (response.data.success && response.data.data.tokens) {
        // Map tokens to gallery format
        const nfts = response.data.data.tokens.map((token: any) => ({
          tokenId: token.tokenId,
          name: token.name || `Token #${token.tokenId.substring(0, 8)}`,
          description: token.description || `ERC-1155 Token with ${token.holderCount} holders. Total supply: ${token.totalSupply}`,
          image: token.imageUrl,
          attributes: token.attributes?.length > 0 ? token.attributes : [
            { trait_type: 'Holders', value: token.holderCount },
            { trait_type: 'Supply', value: parseInt(token.totalSupply).toLocaleString() },
            { trait_type: 'Max Balance', value: parseInt(token.maxBalance).toLocaleString() }
          ],
          owner: token.topHolders?.[0]?.address || null,
          balance: token.topHolders?.[0]?.balance || '0'
        }))
        
        const totalPages = Math.ceil(response.data.data.pagination.total / itemsPerPage)
        
        setGalleryData({
          nfts,
          totalCount: response.data.data.pagination.total,
          currentPage: page,
          totalPages
        })
      } else {
        setGalleryData({
          nfts: [],
          totalCount: 0,
          currentPage: page,
          totalPages: 0
        })
      }
    } catch (err) {
      console.error('Gallery error:', err)
      setGalleryData({
        nfts: [],
        totalCount: 0,
        currentPage: page,
        totalPages: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshMetadata = async () => {
    setRefreshing(true)
    await fetchGallery()
    setRefreshing(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchGallery()
  }

  if (loading && !galleryData) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-center h-96">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            NFT <span className="gradient-text">Gallery</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Explore your collection with metadata and visual presentations
          </p>
        </div>

        {/* Controls */}
        <div className="card-glass mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, ID, or attributes..."
                  className="w-full pl-10 pr-4 py-3 input-glass"
                />
              </div>
            </form>

            {/* View Controls */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-primary text-background'
                    : 'bg-card border border-border hover:border-primary/50'
                }`}
                title="Grid View"
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-primary text-background'
                    : 'bg-card border border-border hover:border-primary/50'
                }`}
                title="List View"
              >
                <List className="w-5 h-5" />
              </button>
              
              {/* Items per page selector */}
              <select 
                value={showAll ? 'all' : itemsPerPage.toString()} 
                onChange={(e) => {
                  if (e.target.value === 'all') {
                    setShowAll(true);
                    setPage(1);
                  } else {
                    setShowAll(false);
                    setItemsPerPage(parseInt(e.target.value));
                    setPage(1);
                  }
                }}
                className="px-3 py-2 rounded-lg bg-card border border-border hover:border-primary/50 text-foreground focus:outline-none focus:border-primary transition-all"
              >
                <option value="24">24 per page</option>
                <option value="48">48 per page</option>
                <option value="96">96 per page</option>
                <option value="all">Show all</option>
              </select>
            </div>

            {/* Refresh */}
            <button
              onClick={refreshMetadata}
              disabled={refreshing}
              className="btn-secondary flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Gallery Grid/List */}
        {galleryData && (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                {galleryData.nfts.map((nft) => (
                  <div
                    key={nft.tokenId}
                    onClick={() => setSelectedNFT(nft)}
                    className="card-glass overflow-hidden cursor-pointer group"
                  >
                    {/* Image */}
                    <div className="aspect-square relative overflow-hidden rounded-t-lg">
                      <NFTImage
                        src={nft.image}
                        alt={nft.name}
                        className="w-full h-full group-hover:scale-110 transition-transform duration-500"
                        fallbackText={nft.name}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                    
                    {/* Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-1">{nft.name || `NFT #${nft.tokenId}`}</h3>
                      <p className="text-sm text-muted-foreground mb-3">Token ID: {nft.tokenId}</p>
                      
                      {/* Attributes Preview */}
                      <div className="flex flex-wrap gap-2">
                        {nft.attributes?.slice(0, 2).map((attr, index) => (
                          <span
                            key={index}
                            className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary"
                          >
                            {attr.value}
                          </span>
                        ))}
                        {nft.attributes && nft.attributes.length > 2 && (
                          <span className="text-xs px-2 py-1 rounded-md bg-card text-muted-foreground">
                            +{nft.attributes.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4 mb-8">
                {galleryData.nfts.map((nft) => (
                  <div
                    key={nft.tokenId}
                    onClick={() => setSelectedNFT(nft)}
                    className="card-glass flex gap-6 cursor-pointer hover:border-primary/30 transition-all"
                  >
                    {/* Image */}
                    <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                      <NFTImage
                        src={nft.image}
                        alt={nft.name}
                        className="w-full h-full"
                        fallbackText=""
                      />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{nft.name || `NFT #${nft.tokenId}`}</h3>
                      <p className="text-sm text-muted-foreground mb-2">Token ID: {nft.tokenId}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{nft.description}</p>
                      
                      {/* Attributes */}
                      <div className="flex flex-wrap gap-2">
                        {nft.attributes?.map((attr, index) => (
                          <span
                            key={index}
                            className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary"
                          >
                            {attr.trait_type}: {attr.value}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button className="p-2 rounded-lg hover:bg-card transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-card transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {!showAll && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((page - 1) * itemsPerPage) + 1} - {Math.min(page * itemsPerPage, galleryData.totalCount)} of {galleryData.totalCount} NFTs
                </div>
                <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                
                <div className="flex gap-1">
                  {(() => {
                    const totalPages = galleryData.totalPages;
                    const currentPage = page;
                    let pages = [];
                    
                    // Always show first page
                    pages.push(1);
                    
                    // Add ellipsis if needed
                    if (currentPage > 3) {
                      pages.push(-1); // -1 represents ellipsis
                    }
                    
                    // Show pages around current page
                    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                      if (!pages.includes(i)) {
                        pages.push(i);
                      }
                    }
                    
                    // Add ellipsis if needed
                    if (currentPage < totalPages - 2) {
                      pages.push(-1); // -1 represents ellipsis
                    }
                    
                    // Always show last page
                    if (totalPages > 1 && !pages.includes(totalPages)) {
                      pages.push(totalPages);
                    }
                    
                    return pages.map((pageNum, idx) => {
                      if (pageNum === -1) {
                        return (
                          <span key={`ellipsis-${idx}`} className="px-2 py-1 text-muted-foreground">
                            ...
                          </span>
                        );
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-10 h-10 rounded-lg font-medium transition-all ${
                            page === pageNum
                              ? 'bg-primary text-background'
                              : 'bg-card border border-border hover:border-primary/50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    });
                  })()}
                </div>
                
                <button
                  onClick={() => setPage(Math.min(galleryData.totalPages, page + 1))}
                  disabled={page === galleryData.totalPages}
                  className="px-4 py-2 rounded-lg bg-card border border-border hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
            )}
            {showAll && (
              <div className="text-center text-sm text-muted-foreground">
                Showing all {galleryData.totalCount} NFTs
              </div>
            )}
          </>
        )}

        {/* NFT Detail Modal */}
        {selectedNFT && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setSelectedNFT(null)}
          >
            <div
              className="card-glass max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image */}
                <div className="aspect-square rounded-lg overflow-hidden">
                  <NFTImage
                    src={selectedNFT.image}
                    alt={selectedNFT.name}
                    className="w-full h-full"
                    fallbackText={selectedNFT.name}
                  />
                </div>
                
                {/* Details */}
                <div>
                  <h2 className="text-2xl font-bold mb-2">{selectedNFT.name || `NFT #${selectedNFT.tokenId}`}</h2>
                  <p className="text-muted-foreground mb-4">Token ID: {selectedNFT.tokenId}</p>
                  
                  {selectedNFT.description && (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-muted-foreground">{selectedNFT.description}</p>
                    </div>
                  )}
                  
                  {selectedNFT.owner && (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-2">Owner</h3>
                      <p className="font-mono text-sm">{selectedNFT.owner}</p>
                    </div>
                  )}
                  
                  {selectedNFT.attributes && selectedNFT.attributes.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-3">Attributes</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {selectedNFT.attributes.map((attr, index) => (
                          <div key={index} className="bg-card rounded-lg p-3">
                            <p className="text-xs text-muted-foreground">{attr.trait_type}</p>
                            <p className="font-medium">{attr.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <button className="btn-primary flex-1 flex items-center justify-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      View on Explorer
                    </button>
                    <button className="btn-secondary flex items-center justify-center gap-2">
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}