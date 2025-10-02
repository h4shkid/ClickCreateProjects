'use client'

import { useState, useEffect } from 'react'
import { useContract } from '@/lib/contracts/ContractContext'
import { Users, Search, Download, ExternalLink, TrendingUp, PieChart, BarChart3, Crown, Fish, Waves, Zap } from 'lucide-react'

interface Holder {
  address: string
  balance: string
  percentage: string
  tokenCount: number
  firstTransactionDate: string
  lastTransactionDate: string
  isContract?: boolean
}

interface HolderDistribution {
  whales: number // >1% of supply
  dolphins: number // 0.1-1% of supply  
  fish: number // <0.1% of supply
  giniCoefficient: number
  top10Percentage: number
  top100Percentage: number
}

interface ContractHoldersProps {
  contractAddress: string
}

export function ContractHolders({ contractAddress }: ContractHoldersProps) {
  const { contract, isLoading } = useContract()
  const [holders, setHolders] = useState<Holder[]>([])
  const [distribution, setDistribution] = useState<HolderDistribution | null>(null)
  const [loadingHolders, setLoadingHolders] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'balance' | 'percentage' | 'tokenCount'>('balance')
  const [currentPage, setCurrentPage] = useState(1)
  const holdersPerPage = 20

  useEffect(() => {
    const fetchHolders = async () => {
      setLoadingHolders(true)
      try {
        const response = await fetch(`/api/contracts/${contractAddress}/holders?limit=100&sort=${sortBy}`)
        const data = await response.json()
        
        if (data.success) {
          setHolders(data.holders || [])
          setDistribution(data.distribution)
        }
      } catch (err) {
        console.error('Failed to load holders:', err)
      } finally {
        setLoadingHolders(false)
      }
    }

    if (contractAddress) {
      fetchHolders()
    }
  }, [contractAddress, sortBy])

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const formatNumber = (num: number | string) => {
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
    return n.toLocaleString()
  }

  const filteredHolders = holders.filter(holder =>
    holder.address.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const paginatedHolders = filteredHolders.slice(
    (currentPage - 1) * holdersPerPage,
    currentPage * holdersPerPage
  )

  const totalPages = Math.ceil(filteredHolders.length / holdersPerPage)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card/20 rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-background/50 rounded mb-4"></div>
              <div className="h-8 bg-background/50 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Distribution Overview */}
      {distribution && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <PieChart className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Distribution</h3>
                <p className="text-sm text-muted-foreground">Holder categories</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1 text-muted-foreground"><Waves className="w-3 h-3" /> Whales (&gt;1%)</div>
                <span className="font-medium text-foreground">{distribution.whales}</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1 text-muted-foreground"><Zap className="w-3 h-3" /> Dolphins (0.1-1%)</div>
                <span className="font-medium text-foreground">{distribution.dolphins}</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-1 text-muted-foreground"><Fish className="w-3 h-3" /> Fish (&lt;0.1%)</div>
                <span className="font-medium text-foreground">{distribution.fish}</span>
              </div>
            </div>
          </div>

          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Concentration</h3>
                <p className="text-sm text-muted-foreground">Supply distribution</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Top 10 holders</span>
                <span className="font-medium text-foreground">{distribution.top10Percentage.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Top 100 holders</span>
                <span className="font-medium text-foreground">{distribution.top100Percentage.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gini coefficient</span>
                <span className="font-medium text-foreground">{distribution.giniCoefficient.toFixed(3)}</span>
              </div>
            </div>
          </div>

          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Total Holders</h3>
                <p className="text-sm text-muted-foreground">Unique addresses</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="text-3xl font-bold text-foreground">
                {formatNumber(holders.length)}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Contract Type</span>
                <span className="font-medium text-foreground">{contract?.contractType || '---'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Holders List */}
      <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Holder Rankings</h3>
            <p className="text-sm text-muted-foreground">Top token holders by balance</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 border border-border">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search and Sort */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground focus:outline-none focus:border-primary/50"
          >
            <option value="balance">Sort by Balance</option>
            <option value="percentage">Sort by Percentage</option>
            <option value="tokenCount">Sort by Token Count</option>
          </select>
        </div>

        {/* Holders Table */}
        {loadingHolders ? (
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-background/50 rounded-lg animate-pulse">
                <div className="w-8 h-8 bg-background/50 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-background/50 rounded w-3/4"></div>
                  <div className="h-3 bg-background/50 rounded w-1/2"></div>
                </div>
                <div className="h-6 bg-background/50 rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : paginatedHolders.length > 0 ? (
          <>
            <div className="space-y-2">
              {paginatedHolders.map((holder, index) => {
                const rank = (currentPage - 1) * holdersPerPage + index + 1
                return (
                  <div key={holder.address} className="flex items-center gap-4 p-4 bg-background/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-2">
                        {rank <= 3 && (
                          <Crown className={`w-4 h-4 ${
                            rank === 1 ? 'text-yellow-500' : 
                            rank === 2 ? 'text-gray-400' : 'text-amber-600'
                          }`} />
                        )}
                        <span className="w-8 text-center text-sm font-medium text-muted-foreground">
                          #{rank}
                        </span>
                      </div>
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-foreground">{formatAddress(holder.address)}</span>
                          {holder.isContract && (
                            <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-500 rounded">
                              Contract
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{holder.tokenCount} {holder.tokenCount === 1 ? 'token' : 'tokens'}</span>
                          <span>Since {new Date(holder.firstTransactionDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-medium text-foreground">{formatNumber(holder.balance)}</div>
                        <div className="text-xs text-muted-foreground">{holder.percentage}% of supply</div>
                      </div>
                      
                      <a
                        href={`https://etherscan.io/address/${holder.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50"
                        title="View on Etherscan"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * holdersPerPage + 1} to {Math.min(currentPage * holdersPerPage, filteredHolders.length)} of {filteredHolders.length} holders
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-foreground hover:bg-background/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <span className="px-3 py-2 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-foreground hover:bg-background/70 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No holders found</h4>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try adjusting your search terms' : 'This contract has no token holders'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}