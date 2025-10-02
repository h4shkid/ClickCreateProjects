'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, ChevronDown, Star, Clock, ExternalLink } from 'lucide-react'
import { useContract } from '@/lib/contracts/ContractContext'

interface ContractOption {
  address: string
  name: string
  symbol?: string
  contractType: string
  isVerified: boolean
  usageCount: number
  lastUsed?: string
}

interface ContractSwitcherProps {
  currentAddress?: string
  onSwitch?: (address: string) => void
}

export function ContractSwitcher({ currentAddress, onSwitch }: ContractSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [contracts, setContracts] = useState<ContractOption[]>([])
  const [recentContracts, setRecentContracts] = useState<ContractOption[]>([])
  const [loading, setLoading] = useState(false)
  const { contract } = useContract()
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch contracts when dropdown opens
  useEffect(() => {
    if (isOpen && contracts.length === 0) {
      fetchContracts()
    }
  }, [isOpen])

  // Fetch recent contracts from localStorage
  useEffect(() => {
    const recent = localStorage.getItem('recentContracts')
    if (recent) {
      try {
        setRecentContracts(JSON.parse(recent))
      } catch (e) {
        console.warn('Failed to parse recent contracts')
      }
    }
  }, [])

  const fetchContracts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/contracts/search?limit=20&sort=usage_count`)
      const data = await response.json()
      
      if (data.success) {
        setContracts(data.contracts || [])
      }
    } catch (err) {
      console.error('Failed to fetch contracts:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleContractSwitch = (address: string) => {
    // Add to recent contracts
    const foundContract = contracts.find(c => c.address === address)
    const newRecent = [
      { 
        address, 
        name: foundContract?.name || address, 
        contractType: foundContract?.contractType || 'Unknown',
        isVerified: foundContract?.isVerified || false,
        usageCount: foundContract?.usageCount || 0,
        lastUsed: new Date().toISOString() 
      },
      ...recentContracts.filter(c => c.address !== address)
    ].slice(0, 5)
    
    setRecentContracts(newRecent)
    localStorage.setItem('recentContracts', JSON.stringify(newRecent))
    
    setIsOpen(false)
    if (onSwitch) {
      onSwitch(address)
    } else {
      router.push(`/contracts/${address}`)
    }
  }

  const filteredContracts = contracts.filter(contract =>
    contract.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contract.symbol?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Contract Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-card/20 backdrop-blur-sm border border-border rounded-lg hover:border-primary/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {contract ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">
                  {contract.name || formatAddress(contract.address)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {contract.symbol || contract.contractType}
                </div>
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">Select Contract</div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-xl z-50 min-w-80">
          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search contracts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {/* Recent Contracts */}
            {recentContracts.length > 0 && !searchQuery && (
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Recent</span>
                </div>
                <div className="space-y-1">
                  {recentContracts.slice(0, 3).map((recent) => (
                    <button
                      key={recent.address}
                      onClick={() => handleContractSwitch(recent.address)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors text-left"
                    >
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate">
                          {recent.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAddress(recent.address)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Contract List */}
            <div className="p-3">
              {!searchQuery && (
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Popular Contracts</span>
                </div>
              )}
              
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 animate-pulse">
                      <div className="w-2 h-2 bg-background/50 rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-background/50 rounded w-3/4 mb-1" />
                        <div className="h-3 bg-background/50 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredContracts.length > 0 ? (
                <div className="space-y-1">
                  {filteredContracts.slice(0, 10).map((contractOption) => (
                    <button
                      key={contractOption.address}
                      onClick={() => handleContractSwitch(contractOption.address)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-background/50 transition-colors text-left ${
                        contractOption.address === currentAddress ? 'bg-primary/10 border border-primary/20' : ''
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        contractOption.isVerified ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate">
                          {contractOption.name}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{formatAddress(contractOption.address)}</span>
                          <span>•</span>
                          <span>{contractOption.contractType}</span>
                          {contractOption.symbol && (
                            <>
                              <span>•</span>
                              <span>{contractOption.symbol}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {contractOption.usageCount} uses
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <div className="text-sm">
                    {searchQuery ? 'No contracts found' : 'No contracts available'}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border p-3">
              <Link
                href="/contracts"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Discover more contracts
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}