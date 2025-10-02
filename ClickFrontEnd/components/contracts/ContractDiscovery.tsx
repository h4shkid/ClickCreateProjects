'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Search, Plus, Filter, Loader2, ExternalLink, CheckCircle, Grid, List, X } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { isValidEthereumAddress } from '@/lib/auth/middleware'

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

interface SearchFilters {
  type?: 'ERC721' | 'ERC1155'
  verified?: boolean
  chainId?: number
  sortBy: 'usage' | 'name' | 'created' | 'holders'
  sortOrder: 'asc' | 'desc'
}

export default function ContractDiscovery() {
  const { user, isAuthenticated } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showRegisterForm, setShowRegisterForm] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: 'usage',
    sortOrder: 'desc'
  })
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false
  })

  // Search contracts with debouncing
  const searchContracts = useCallback(async (query: string, currentFilters: SearchFilters, offset = 0) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        q: query,
        sortBy: currentFilters.sortBy,
        sortOrder: currentFilters.sortOrder,
        limit: pagination.limit.toString(),
        offset: offset.toString()
      })

      if (currentFilters.type) {
        params.set('type', currentFilters.type)
      }
      if (currentFilters.verified !== undefined) {
        params.set('verified', currentFilters.verified.toString())
      }
      if (currentFilters.chainId) {
        params.set('chainId', currentFilters.chainId.toString())
      }

      const response = await fetch(`/api/contracts/search?${params}`)
      const data = await response.json()

      if (data.success) {
        const filteredContracts = data.data.contracts

        if (offset === 0) {
          setContracts(filteredContracts)
        } else {
          setContracts(prev => [...prev, ...filteredContracts])
        }
        setPagination(prev => ({
          ...prev,
          total: data.data.pagination.total,
          offset: data.data.pagination.offset,
          hasMore: data.data.pagination.hasMore
        }))
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.limit])


  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchContracts(searchQuery, filters, 0)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, filters, searchContracts])


  const loadMoreContracts = () => {
    if (pagination.hasMore && !loading) {
      searchContracts(searchQuery, filters, pagination.offset + pagination.limit)
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

  const getChainIcon = (chainId: number) => {
    switch (chainId) {
      case 1: // Ethereum
        return (
          <div className="group/icon relative">
            <svg 
              className="w-4 h-4 text-blue-500 cursor-help" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
              {getChainName(chainId)}
            </div>
          </div>
        )
      case 137: // Polygon
        return (
          <div className="group/icon relative">
            <svg 
              className="w-4 h-4 text-purple-500 cursor-help" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M12 0L1.608 6v12L12 24l10.392-6V6L12 0zm-1.575 4.5L18 8.25v7.5l-7.575 3.75L18 8.25v7.5l-7.575 3.75L2.425 15.75v-7.5L10.425 4.5z"/>
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
              {getChainName(chainId)}
            </div>
          </div>
        )
      case 42161: // Arbitrum
        return (
          <div className="group/icon relative">
            <svg 
              className="w-4 h-4 text-blue-400 cursor-help" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M12 0l12 7v10l-12 7L0 17V7l12-7zm0 2.3L2.3 7.7v8.6L12 21.7l9.7-5.4V7.7L12 2.3z"/>
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
              {getChainName(chainId)}
            </div>
          </div>
        )
      case 8453: // Base
        return (
          <div className="group/icon relative">
            <svg 
              className="w-4 h-4 text-blue-600 cursor-help" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <circle cx="12" cy="12" r="11" fill="currentColor"/>
              <path d="M12 4a8 8 0 100 16 8 8 0 000-16z" fill="white"/>
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
              {getChainName(chainId)}
            </div>
          </div>
        )
      case 360: // Shape
        return (
          <div className="group/icon relative">
            <svg 
              className="w-4 h-4 text-orange-500 cursor-help" 
              viewBox="0 0 24 24" 
              fill="currentColor"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
              {getChainName(chainId)}
            </div>
          </div>
        )
      default:
        return (
          <span className="text-xs text-muted-foreground">
            {getChainName(chainId)}
          </span>
        )
    }
  }

  const formatNumber = (num: number | string) => {
    const n = typeof num === 'string' ? parseInt(num) : num
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }


  const ContractCard = ({ contract, viewMode }: { contract: Contract; viewMode: 'grid' | 'list' }) => {
    const [collectionData, setCollectionData] = useState<{
      imageUrl?: string
      description?: string
    } | null>(null)
    const [loadingCollection, setLoadingCollection] = useState(false)

    // Fetch OpenSea collection data
    useEffect(() => {
      const fetchCollectionData = async () => {
        if (loadingCollection || collectionData) return
        
        setLoadingCollection(true)
        try {
          const response = await fetch(`/api/opensea/collection?address=${contract.address}&chainId=${contract.chainId}`)
          if (response.ok) {
            const data = await response.json()
            if (data.success) {
              setCollectionData({
                imageUrl: data.collection?.image_url,
                description: data.collection?.description
              })
            } else {
              // Set empty data to prevent retries
              setCollectionData({})
            }
          } else {
            // Set empty data to prevent retries on 404/other errors
            setCollectionData({})
          }
        } catch (error) {
          console.error('Failed to fetch collection data:', error)
          // Set empty data to prevent retries
          setCollectionData({})
        } finally {
          setLoadingCollection(false)
        }
      }

      fetchCollectionData()
    }, [contract.address, contract.chainId, loadingCollection, collectionData])

    const handleAddressClick = () => {
      const openseaUrl = contract.chainId === 1 
        ? `https://opensea.io/assets/ethereum/${contract.address}`
        : `https://opensea.io/collection/${contract.address}`
      window.open(openseaUrl, '_blank')
    }

    // Grid view (default)
    if (viewMode === 'grid') {
      return (
        <div className="group bg-gradient-to-br from-card/40 to-card/20 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 transition-all duration-500">
          {/* Header with Collection Image and Info */}
          <div className="relative">

            {/* Banner/Background */}
            {collectionData?.imageUrl && (
              <div className="absolute inset-0 opacity-10">
                <Image
                  src={collectionData.imageUrl}
                  alt={contract.name}
                  fill
                  className="object-cover blur-sm"
                  sizes="400px"
                />
              </div>
            )}
            
            <div className="relative p-6 pb-4">
              <div className="flex items-start gap-4">
                {/* Collection Logo */}
                <div className="relative">
                  {collectionData?.imageUrl ? (
                    <div className="w-20 h-20 relative rounded-xl overflow-hidden bg-background shadow-lg ring-2 ring-border/50 flex-shrink-0">
                      <Image
                        src={collectionData.imageUrl}
                        alt={contract.name}
                        fill
                        className="object-cover"
                        sizes="80px"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-border/50">
                      <span className="text-2xl font-bold text-primary">
                        {contract.name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Collection Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-bold text-foreground truncate">
                      {contract.name}
                    </h3>
                    <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full flex items-center gap-1 font-medium">
                      {contract.contractType}
                      <div className="scale-75">
                        {getChainIcon(contract.chainId)}
                      </div>
                    </span>
                    {contract.isVerified && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  
                  {/* Address */}
                  <div 
                    className="text-sm text-muted-foreground font-mono mb-2 cursor-pointer hover:text-primary transition-colors bg-background/50 px-3 py-1 rounded-lg border border-border/50 hover:border-primary/50 inline-block w-fit"
                    onClick={handleAddressClick}
                    title="Click to view on OpenSea"
                  >
                    {contract.address}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm">
                    {contract.holderCount && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="font-medium">{formatNumber(contract.holderCount)}</span>
                        <span>holders</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          {(collectionData?.description || contract.description) && (
            <div className="px-6 pb-4">
              <div className="bg-background/30 backdrop-blur-sm rounded-lg p-4 border border-border/30">
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {collectionData?.description || contract.description}
                </p>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {contract.websiteUrl && (
                  <a
                    href={contract.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10 border border-border/50 hover:border-primary/50"
                    title="Visit website"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              <button className="px-6 py-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg transition-all duration-300 font-medium shadow-lg hover:shadow-xl">
                View Analytics
              </button>
            </div>
          </div>
        </div>
      )
    }

    // List view
    return (
      <div className="group bg-gradient-to-br from-card/40 to-card/20 backdrop-blur-md border border-border/50 rounded-lg hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300">
        <div className="p-4">
          <div className="flex items-center gap-4">
            {/* Collection Logo */}
            <div className="relative flex-shrink-0">
              {collectionData?.imageUrl ? (
                <div className="w-16 h-16 relative rounded-lg overflow-hidden bg-background shadow-lg ring-2 ring-border/50">
                  <Image
                    src={collectionData.imageUrl}
                    alt={contract.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center shadow-lg ring-2 ring-border/50">
                  <span className="text-xl font-bold text-primary">
                    {contract.name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Collection Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-foreground truncate">
                  {contract.name}
                </h3>
                <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full flex items-center gap-1 font-medium">
                  {contract.contractType}
                  <div className="scale-75">
                    {getChainIcon(contract.chainId)}
                  </div>
                </span>
                {contract.isVerified && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </div>
              
              {/* Address and Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="font-mono">{contract.address.slice(0, 10)}...{contract.address.slice(-8)}</span>
                {contract.holderCount && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="font-medium">{formatNumber(contract.holderCount)}</span>
                    <span>holders</span>
                  </div>
                )}
                {contract.usageCount > 0 && (
                  <span>{contract.usageCount} uses</span>
                )}
              </div>

              {/* Description */}
              {(collectionData?.description || contract.description) && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {collectionData?.description || contract.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {contract.websiteUrl && (
                <a
                  href={contract.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-lg hover:bg-primary/10 border border-border/50 hover:border-primary/50"
                  title="Visit website"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button className="px-4 py-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg transition-all duration-300 font-medium shadow-lg hover:shadow-xl text-sm">
                View Analytics
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8 pt-28">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Discover Contracts</h1>
          <p className="text-muted-foreground">
            Explore and analyze ERC-721 and ERC-1155 NFT contracts across multiple chains
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6 mb-8">
          {/* Main Search Row */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center mb-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name, symbol, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>

            {/* View Toggle and Actions */}
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-background/50 border border-border rounded-md">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-l-md transition-colors ${
                    viewMode === 'grid' 
                      ? 'bg-primary text-white' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-r-md transition-colors ${
                    viewMode === 'list' 
                      ? 'bg-primary text-white' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  showFilters || Object.keys(filters).some(key => key !== 'sortBy' && key !== 'sortOrder' && filters[key as keyof SearchFilters] !== undefined)
                    ? 'bg-primary/20 text-primary border border-primary/50'
                    : 'bg-background/50 border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>


              {/* Register Button */}
              {isAuthenticated && (
                <button
                  onClick={() => setShowRegisterForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Register
                </button>
              )}
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="border-t border-border pt-4">

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Contract Type */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Contract Type</label>
                  <select
                    value={filters.type || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      type: e.target.value as 'ERC721' | 'ERC1155' || undefined 
                    }))}
                    className="w-full px-3 py-2 bg-background/50 border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-primary/50"
                  >
                    <option value="">All Types</option>
                    <option value="ERC721">ERC-721</option>
                    <option value="ERC1155">ERC-1155</option>
                  </select>
                </div>

                {/* Chain */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Chain</label>
                  <select
                    value={filters.chainId || ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      chainId: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    className="w-full px-3 py-2 bg-background/50 border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-primary/50"
                  >
                    <option value="">All Chains</option>
                    <option value="1">Ethereum</option>
                    <option value="137">Polygon</option>
                    <option value="42161">Arbitrum</option>
                    <option value="8453">Base</option>
                    <option value="360">Shape</option>
                  </select>
                </div>

                {/* Verification Status */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Verification</label>
                  <select
                    value={filters.verified === undefined ? '' : filters.verified.toString()}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      verified: e.target.value === '' ? undefined : e.target.value === 'true'
                    }))}
                    className="w-full px-3 py-2 bg-background/50 border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-primary/50"
                  >
                    <option value="">All Status</option>
                    <option value="true">Verified</option>
                    <option value="false">Unverified</option>
                  </select>
                </div>

                {/* Sort By */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Sort By</label>
                  <select
                    value={`${filters.sortBy}-${filters.sortOrder}`}
                    onChange={(e) => {
                      const [sortBy, sortOrder] = e.target.value.split('-') as [SearchFilters['sortBy'], SearchFilters['sortOrder']]
                      setFilters(prev => ({ ...prev, sortBy, sortOrder }))
                    }}
                    className="w-full px-3 py-2 bg-background/50 border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-primary/50"
                  >
                    <option value="usage-desc">Most Used</option>
                    <option value="usage-asc">Least Used</option>
                    <option value="name-asc">Name A-Z</option>
                    <option value="name-desc">Name Z-A</option>
                    <option value="created-desc">Newest</option>
                    <option value="created-asc">Oldest</option>
                    <option value="holders-desc">Most Holders</option>
                    <option value="holders-asc">Least Holders</option>
                  </select>
                </div>
              </div>

              {/* Active Filters & Clear */}
              <div className="flex items-center justify-between mt-4">
                <div className="flex flex-wrap gap-2">
                  {filters.type && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded-md text-sm">
                      {filters.type}
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, type: undefined }))}
                        className="hover:bg-primary/30 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filters.chainId && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded-md text-sm">
                      {getChainName(filters.chainId)}
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, chainId: undefined }))}
                        className="hover:bg-primary/30 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filters.verified !== undefined && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded-md text-sm">
                      {filters.verified ? 'Verified' : 'Unverified'}
                      <button
                        onClick={() => setFilters(prev => ({ ...prev, verified: undefined }))}
                        className="hover:bg-primary/30 rounded-full p-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
                
                {Object.keys(filters).some(key => key !== 'sortBy' && key !== 'sortOrder' && filters[key as keyof SearchFilters] !== undefined) && (
                  <button
                    onClick={() => setFilters({ sortBy: 'usage', sortOrder: 'desc' })}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Contract List */}
        <div>
          {loading && contracts.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className={`${
                viewMode === 'grid' 
                  ? 'grid grid-cols-1 lg:grid-cols-2 gap-6' 
                  : 'space-y-4'
              } mb-8`}>
                {contracts.map((contract) => (
                  <ContractCard key={contract.id} contract={contract} viewMode={viewMode} />
                ))}
              </div>

              {contracts.length === 0 && !loading && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No contracts found.</p>
                  {isAuthenticated && (
                    <button
                      onClick={() => setShowRegisterForm(true)}
                      className="mt-4 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
                    >
                      Register the first contract
                    </button>
                  )}
                </div>
              )}

              {pagination.hasMore && (
                <div className="text-center">
                  <button
                    onClick={loadMoreContracts}
                    disabled={loading}
                    className="px-6 py-2 bg-card/20 backdrop-blur-sm border border-border hover:border-primary/40 text-foreground rounded-md transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                        Loading...
                      </>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Register Contract Modal */}
        {showRegisterForm && (
          <ContractRegisterForm
            onClose={() => setShowRegisterForm(false)}
            onSuccess={() => {
              setShowRegisterForm(false)
              searchContracts(searchQuery, filters, 0)
            }}
          />
        )}

      </div>
    </div>
  )
}

interface ContractRegisterFormProps {
  onClose: () => void
  onSuccess: () => void
}

function ContractRegisterForm({ onClose, onSuccess }: ContractRegisterFormProps) {
  const [formData, setFormData] = useState({
    contractAddress: '',
    chainId: 1,
    description: '',
    websiteUrl: '',
    twitterUrl: '',
    discordUrl: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validate address
    if (!isValidEthereumAddress(formData.contractAddress)) {
      setError('Please enter a valid Ethereum address')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/contracts/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        onSuccess()
      } else {
        setError(data.error || 'Registration failed')
      }
    } catch (err) {
      setError('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Register Contract</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Contract Address *
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={formData.contractAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, contractAddress: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Chain
            </label>
            <select
              value={formData.chainId}
              onChange={(e) => setFormData(prev => ({ ...prev, chainId: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:border-primary/50"
            >
              <option value={1}>Ethereum</option>
              <option value={137}>Polygon</option>
              <option value={42161}>Arbitrum</option>
              <option value={8453}>Base</option>
              <option value={360}>Shape</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description
            </label>
            <textarea
              placeholder="Brief description of the contract..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
              rows={3}
              maxLength={1000}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Website URL
            </label>
            <input
              type="url"
              placeholder="https://..."
              value={formData.websiteUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, websiteUrl: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-500/10 border border-red-500/20 rounded-md p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-card border border-border text-foreground rounded-md hover:bg-card/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Registering...
                </>
              ) : (
                'Register'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}