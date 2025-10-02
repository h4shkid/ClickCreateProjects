'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X, Plus, BarChart3, Users, TrendingUp, ExternalLink, CheckCircle } from 'lucide-react'

interface Contract {
  address: string
  name: string
  symbol?: string
  contractType: string
  chainId: number
  isVerified: boolean
  imageUrl?: string
  holderCount?: number
  totalSupply?: string
  usageCount: number
}

interface ContractAnalytics {
  totalHolders: number
  totalSupply: string
  totalTransfers: number
  avgHoldingPerUser: string
  last24hTransfers: number
}

interface ContractComparisonProps {
  onClose: () => void
  initialContracts?: Contract[]
}

export function ContractComparison({ onClose, initialContracts = [] }: ContractComparisonProps) {
  const [contracts, setContracts] = useState<Contract[]>(initialContracts)
  const [analytics, setAnalytics] = useState<Record<string, ContractAnalytics>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Contract[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  // Fetch analytics for each contract
  useEffect(() => {
    contracts.forEach(contract => {
      if (!analytics[contract.address] && !loading[contract.address]) {
        fetchContractAnalytics(contract.address)
      }
    })
  }, [contracts])

  const fetchContractAnalytics = async (address: string) => {
    setLoading(prev => ({ ...prev, [address]: true }))
    try {
      const response = await fetch(`/api/contracts/${address}/analytics/summary`)
      const data = await response.json()
      
      if (data.success) {
        setAnalytics(prev => ({ ...prev, [address]: data.analytics }))
      }
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setLoading(prev => ({ ...prev, [address]: false }))
    }
  }

  const searchContracts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      const response = await fetch(`/api/contracts/search?q=${encodeURIComponent(query)}&limit=10`)
      const data = await response.json()
      
      if (data.success) {
        // Filter out already selected contracts
        const filtered = data.contracts.filter((c: Contract) => 
          !contracts.some(existing => existing.address === c.address)
        )
        setSearchResults(filtered)
      }
    } catch (err) {
      console.error('Failed to search contracts:', err)
    } finally {
      setSearchLoading(false)
    }
  }

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchContracts(searchQuery)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [searchQuery])

  const addContract = (contract: Contract) => {
    if (contracts.length < 4 && !contracts.some(c => c.address === contract.address)) {
      setContracts(prev => [...prev, contract])
      setSearchQuery('')
      setSearchResults([])
    }
  }

  const removeContract = (address: string) => {
    setContracts(prev => prev.filter(c => c.address !== address))
    setAnalytics(prev => {
      const newAnalytics = { ...prev }
      delete newAnalytics[address]
      return newAnalytics
    })
  }

  const formatNumber = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
    return n.toLocaleString()
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const getChainIcon = (chainId: number) => {
    switch (chainId) {
      case 1:
        return <div className="w-4 h-4 bg-blue-500 rounded-full" title="Ethereum" />
      case 137:
        return <div className="w-4 h-4 bg-purple-500 rounded-full" title="Polygon" />
      case 42161:
        return <div className="w-4 h-4 bg-blue-400 rounded-full" title="Arbitrum" />
      case 8453:
        return <div className="w-4 h-4 bg-blue-600 rounded-full" title="Base" />
      case 360:
        return <div className="w-4 h-4 bg-orange-500 rounded-full" title="Shape" />
      default:
        return <div className="w-4 h-4 bg-gray-500 rounded-full" title={`Chain ${chainId}`} />
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg max-w-6xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Contract Comparison</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Add Contract Section */}
          {contracts.length < 4 && (
            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search contracts to add (max 4)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                />
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-2 bg-background border border-border rounded-lg shadow-lg">
                  {searchResults.map((contract) => (
                    <button
                      key={contract.address}
                      onClick={() => addContract(contract)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-card/50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                    >
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-primary">
                          {contract.name?.charAt(0) || '?'}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-foreground">{contract.name}</div>
                        <div className="text-sm text-muted-foreground">{formatAddress(contract.address)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getChainIcon(contract.chainId)}
                        <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                          {contract.contractType}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comparison Table */}
          {contracts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Metric</th>
                    {contracts.map((contract) => (
                      <th key={contract.address} className="text-center py-3 px-4 min-w-48">
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                              <span className="text-sm font-bold text-primary">
                                {contract.name?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-foreground text-sm">{contract.name}</div>
                              <div className="text-xs text-muted-foreground">{formatAddress(contract.address)}</div>
                            </div>
                            <button
                              onClick={() => removeContract(contract.address)}
                              className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            {getChainIcon(contract.chainId)}
                            <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                              {contract.contractType}
                            </span>
                            {contract.isVerified && (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            )}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Total Holders */}
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium text-foreground">Total Holders</td>
                    {contracts.map((contract) => (
                      <td key={contract.address} className="py-3 px-4 text-center">
                        {loading[contract.address] ? (
                          <div className="flex justify-center">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">
                            {analytics[contract.address]?.totalHolders ? 
                              formatNumber(analytics[contract.address].totalHolders) : 
                              contract.holderCount ? formatNumber(contract.holderCount) : '---'
                            }
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Total Supply */}
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium text-foreground">Total Supply</td>
                    {contracts.map((contract) => (
                      <td key={contract.address} className="py-3 px-4 text-center">
                        {loading[contract.address] ? (
                          <div className="flex justify-center">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">
                            {analytics[contract.address]?.totalSupply ? 
                              formatNumber(analytics[contract.address].totalSupply) : 
                              contract.totalSupply ? formatNumber(contract.totalSupply) : '---'
                            }
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Total Transfers */}
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium text-foreground">Total Transfers</td>
                    {contracts.map((contract) => (
                      <td key={contract.address} className="py-3 px-4 text-center">
                        {loading[contract.address] ? (
                          <div className="flex justify-center">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">
                            {analytics[contract.address]?.totalTransfers ? 
                              formatNumber(analytics[contract.address].totalTransfers) : '---'
                            }
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* 24h Activity */}
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium text-foreground">24h Transfers</td>
                    {contracts.map((contract) => (
                      <td key={contract.address} className="py-3 px-4 text-center">
                        {loading[contract.address] ? (
                          <div className="flex justify-center">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">
                            {analytics[contract.address]?.last24hTransfers ? 
                              formatNumber(analytics[contract.address].last24hTransfers) : '---'
                            }
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Average Holdings */}
                  <tr className="border-b border-border/50">
                    <td className="py-3 px-4 font-medium text-foreground">Avg Holdings</td>
                    {contracts.map((contract) => (
                      <td key={contract.address} className="py-3 px-4 text-center">
                        {loading[contract.address] ? (
                          <div className="flex justify-center">
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">
                            {analytics[contract.address]?.avgHoldingPerUser ? 
                              formatNumber(analytics[contract.address].avgHoldingPerUser) : '---'
                            }
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Platform Usage */}
                  <tr>
                    <td className="py-3 px-4 font-medium text-foreground">Platform Usage</td>
                    {contracts.map((contract) => (
                      <td key={contract.address} className="py-3 px-4 text-center">
                        <span className="font-medium text-foreground">
                          {contract.usageCount} uses
                        </span>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No contracts to compare</h3>
              <p className="text-muted-foreground">Search and add contracts above to start comparing.</p>
            </div>
          )}

          {/* Action Bar */}
          {contracts.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Comparing {contracts.length} contract{contracts.length > 1 ? 's' : ''}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setContracts([])}
                  className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 border border-border"
                >
                  Clear All
                </button>
                <button className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors">
                  Export Comparison
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}