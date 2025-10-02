'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Search, Plus, TrendingUp, Star, Filter, Loader2, ExternalLink, CheckCircle } from 'lucide-react'
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
  sortBy: 'usage' | 'name' | 'created' | 'holders'
  sortOrder: 'asc' | 'desc'
}

export default function ContractDiscovery() {
  const { user, isAuthenticated } = useAuth()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [trendingContracts, setTrendingContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showRegisterForm, setShowRegisterForm] = useState(false)
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

      const response = await fetch(`/api/contracts/search?${params}`)
      const data = await response.json()

      if (data.success) {
        if (offset === 0) {
          setContracts(data.data.contracts)
        } else {
          setContracts(prev => [...prev, ...data.data.contracts])
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

  // Load trending contracts
  const loadTrendingContracts = useCallback(async () => {
    try {
      const response = await fetch('/api/contracts/trending?limit=5')
      const data = await response.json()

      if (data.success) {
        setTrendingContracts(data.data.contracts)
      }
    } catch (error) {
      console.error('Trending contracts error:', error)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchContracts(searchQuery, filters, 0)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, filters, searchContracts])

  // Load trending contracts on mount
  useEffect(() => {
    loadTrendingContracts()
  }, [loadTrendingContracts])

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
      8453: 'Base'
    }
    return chains[chainId] || 'Unknown'
  }

  const formatNumber = (num: number | string) => {
    const n = typeof num === 'string' ? parseInt(num) : num
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }

  const ContractCard = ({ contract }: { contract: Contract }) => (
    <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6 hover:border-primary/40 transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-foreground">{contract.name}</h3>
            {contract.isVerified && (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
              {contract.contractType}
            </span>
          </div>
          <p className="text-sm text-muted-foreground font-mono mb-2">
            {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
          </p>
          <p className="text-xs text-muted-foreground">
            {getChainName(contract.chainId)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {formatNumber(contract.usageCount)} uses
          </p>
          {contract.holderCount && (
            <p className="text-xs text-muted-foreground">
              {formatNumber(contract.holderCount)} holders
            </p>
          )}
        </div>
      </div>

      {contract.description && (
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {contract.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {contract.websiteUrl && (
            <a
              href={contract.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        <button className="text-sm px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors">
          View Analytics
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Discover Contracts</h1>
          <p className="text-muted-foreground">
            Explore and analyze ERC-721 and ERC-1155 NFT contracts across multiple chains
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
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

            {/* Filters */}
            <div className="flex gap-2 items-center">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={filters.type || ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  type: e.target.value as 'ERC721' | 'ERC1155' || undefined 
                }))}
                className="px-3 py-2 bg-background/50 border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-primary/50"
              >
                <option value="">All Types</option>
                <option value="ERC721">ERC-721</option>
                <option value="ERC1155">ERC-1155</option>
              </select>

              <select
                value={filters.verified === undefined ? '' : filters.verified.toString()}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  verified: e.target.value === '' ? undefined : e.target.value === 'true'
                }))}
                className="px-3 py-2 bg-background/50 border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-primary/50"
              >
                <option value="">All Status</option>
                <option value="true">Verified</option>
                <option value="false">Unverified</option>
              </select>

              <select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-') as [SearchFilters['sortBy'], SearchFilters['sortOrder']]
                  setFilters(prev => ({ ...prev, sortBy, sortOrder }))
                }}
                className="px-3 py-2 bg-background/50 border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-primary/50"
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

            {/* Register Button */}
            {isAuthenticated && (
              <button
                onClick={() => setShowRegisterForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                Register Contract
              </button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Trending Contracts Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground">Trending</h2>
              </div>
              <div className="space-y-3">
                {trendingContracts.map((contract) => (
                  <div key={contract.id} className="p-3 bg-background/50 rounded-md hover:bg-background/70 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-foreground truncate">{contract.name}</h3>
                      {contract.isVerified && (
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {contract.address.slice(0, 8)}...{contract.address.slice(-6)}
                    </p>
                    <p className="text-xs text-primary mt-1">
                      {formatNumber(contract.usageCount)} uses
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Contract List */}
          <div className="lg:col-span-3">
            {loading && contracts.length === 0 ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 mb-8">
                  {contracts.map((contract) => (
                    <ContractCard key={contract.id} contract={contract} />
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
        </div>

        {/* Register Contract Modal */}
        {showRegisterForm && (
          <ContractRegisterForm
            onClose={() => setShowRegisterForm(false)}
            onSuccess={() => {
              setShowRegisterForm(false)
              searchContracts(searchQuery, filters, 0)
              loadTrendingContracts()
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