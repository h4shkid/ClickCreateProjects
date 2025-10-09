'use client'

import { useState, useEffect } from 'react'
import { Download, Search, RefreshCw, Calendar, Users, Hash, TrendingUp, Copy, ArrowLeft, Shield } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import axios from 'axios'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { SEASON_GROUPS, formatTokenIdsForInput } from '@/lib/constants/season-tokens'

// Authorized wallet address for Snapshot page access
const AUTHORIZED_SNAPSHOT_WALLET = '0x4Ae8B436e50f762Fa8fad29Fd548b375fEe968AC'

interface Holder {
  address: string
  balance: string
  percentage: number
  rank: number
}

interface SnapshotData {
  tokenIds: string[]
  holders: Holder[]
  totalSupply: string
  totalHolders: number
  blockNumber: number
  timestamp: string
}

interface Collection {
  address: string
  name: string
  symbol: string
  contractType: 'ERC721' | 'ERC1155'
  chainId: number
}

export default function CollectionSnapshotPage() {
  const params = useParams()
  const address = params?.address as string
  const { isConnected, address: walletAddress } = useAccount()
  
  const [collection, setCollection] = useState<Collection | null>(null)
  const [loading, setLoading] = useState(false)
  const [snapshotData, setSnapshotData] = useState<SnapshotData | null>(null)
  const [lastResponse, setLastResponse] = useState<any>(null)
  const [tokenIds, setTokenIds] = useState<string>('')
  const [snapshotDate, setSnapshotDate] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single')
  const [dateRange, setDateRange] = useState<{ minDate: string, maxDate: string } | null>(null)
  const [snapshotType, setSnapshotType] = useState<'current' | 'historical'>('current')
  const [error, setError] = useState<string>('')
  const [syncStatus, setSyncStatus] = useState({ syncing: false, progress: 0 })
  const [syncInfo, setSyncInfo] = useState<any>(null)
  const [showAllHolders, setShowAllHolders] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [fullSeasonMode, setFullSeasonMode] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState<string>('')
  const [exactMatch, setExactMatch] = useState<boolean | null>(null)
  const holdersPerPage = 50

  // Function to refresh date range
  const refreshDateRange = async () => {
    try {
      const response = await axios.get(`/api/contracts/${address}/date-range`)
      
      if (response.data.success) {
        setDateRange({
          minDate: response.data.data.dateRange.minDate,
          maxDate: response.data.data.dateRange.maxDate
        })
      }
    } catch (err) {
      console.error('Failed to refresh date range:', err)
    }
  }

  // Fetch collection info and start polling for sync status
  useEffect(() => {
    if (address) {
      fetchCollectionInfo()
      checkSyncStatus()
      refreshDateRange() // Fetch available date range
      
      // Start auto-polling for sync status to catch ongoing syncs (with error handling)
      const autoPollingInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/contracts/${address}/sync`, {
            timeout: 5000 // 5 second timeout
          })
          
          if (statusRes.data.success) {
            const syncData = statusRes.data.data
            
            if (syncData.status === 'processing') {
              const progress = syncData.progressPercentage || 0
              setSyncStatus({ syncing: true, progress })
              setSyncInfo(syncData)
              console.log(`🔄 Auto-detected sync progress: ${progress}%`)
            } else if (syncData.status === 'completed') {
              setSyncStatus({ syncing: false, progress: 100 })
              setSyncInfo(syncData)
            } else {
              setSyncStatus({ syncing: false, progress: 0 })
            }
          }
        } catch (err: any) {
          // Silently handle network errors for auto-polling - don't spam console
          if (err.code !== 'ECONNABORTED' && !err.message?.includes('timeout')) {
            console.log('🔄 Sync status polling unavailable for this contract')
          }
          // Stop polling if we consistently get network errors
          if (err.message?.includes('Network Error')) {
            console.log('🔄 Stopping auto-poll due to network issues')
            clearInterval(autoPollingInterval)
          }
        }
      }, 5000) // Poll every 5 seconds (reduced frequency)
      
      // Cleanup polling on unmount
      return () => {
        clearInterval(autoPollingInterval)
      }
    }
  }, [address])

  const fetchCollectionInfo = async () => {
    try {
      const response = await fetch(`/api/contracts/${address}`)
      const data = await response.json()
      if (data.success) {
        setCollection(data.contract)
      }
    } catch (error) {
      console.error('Failed to fetch collection info:', error)
    }
  }

  const checkSyncStatus = async () => {
    try {
      const response = await axios.get(`/api/contracts/${address}/sync`, {
        timeout: 5000 // 5 second timeout
      })
      if (response.data.success) {
        setSyncInfo(response.data.data)
      }
    } catch (err: any) {
      // Don't log errors for missing sync endpoints - this is expected for many contracts
      console.log('🔄 Sync status not available for this contract')
    }
  }

  // Generate snapshot
  const generateSnapshot = async () => {
    // Validate exact match selection when tokens are specified
    if (tokenIds && exactMatch === null && !fullSeasonMode) {
      setError('Please select Exact Match option (YES or NO)')
      return
    }
    
    setLoading(true)
    setError('')
    console.log('🎯 Starting snapshot generation...')
    
    try {
      const endpoint = snapshotType === 'current' 
        ? `/api/contracts/${address}/snapshot/current`
        : `/api/contracts/${address}/snapshot/historical`
      
      const params: any = {}
      
      // Handle full season mode
      if (fullSeasonMode && selectedSeason) {
        params.fullSeason = 'true'
        params.season = selectedSeason
      } else if (tokenIds) {
        // For current snapshot API, send tokenIds
        const tokenIdList = tokenIds.split(',').map(id => id.trim())
        if (tokenIdList.length === 1) {
          params.tokenId = tokenIdList[0]
        } else {
          params.tokenIds = tokenIds
        }
        
        // Add exact match parameter
        if (exactMatch !== null) {
          params.exactMatch = exactMatch ? 'true' : 'false'
        }
      }
      
      if (snapshotType === 'historical') {
        if (startDate && endDate) {
          params.startDate = startDate
          params.endDate = endDate
        } else if (snapshotDate) {
          params.date = snapshotDate
        }
      }
      
      console.log('📡 Calling API with params:', params)
      const response = await axios.get(endpoint, {
        params,
        timeout: 180000 // 3 minute timeout for historical snapshots (can take 1-2 minutes)
      })
      console.log('📥 API Response:', response.data)
      
      // Update sync status if available
      if (response.data.data?.syncStatus) {
        setSyncInfo(response.data.data.syncStatus)
      }

      // Format the data based on API response structure
      let formattedData: SnapshotData;
      
      if (response.data.success && response.data.data) {
        // Check if this is a date range comparison response
        if (response.data.data.dateRange && response.data.data.snapshots) {
          // Date range comparison format
          const { snapshots, dateRange, comparison } = response.data.data;
          
          // For now, show the end snapshot as the main data (most recent)
          formattedData = {
            tokenIds: [],
            holders: snapshots.end.holders?.map((h: any, index: number) => ({
              address: h.holderAddress || h.address,
              balance: h.balance,
              percentage: h.percentage || 0,
              rank: h.rank || index + 1
            })) || [],
            totalSupply: snapshots.end.totalSupply || '0',
            totalHolders: snapshots.end.uniqueHolders || 0,
            blockNumber: snapshots.end.blockNumber || 0,
            timestamp: snapshots.end.date || new Date().toISOString()
          }
          
          console.log('📊 Date range comparison data:', {
            dateRange,
            comparison,
            startHolders: snapshots.start.uniqueHolders,
            endHolders: snapshots.end.uniqueHolders,
            changes: comparison.summary
          })
        } else {
          // Single snapshot format
          const { snapshot, metadata, totalHolders, blockNumber } = response.data.data;
          formattedData = {
            tokenIds: metadata?.tokenId ? [metadata.tokenId] : [],
            holders: snapshot?.map((h: any, index: number) => ({
              address: h.holderAddress || h.address,
              balance: h.balance,
              percentage: h.percentage || 0,
              rank: h.rank || index + 1
            })) || [],
            totalSupply: metadata?.totalSupply || '0',
            totalHolders: totalHolders || metadata?.uniqueHolders || snapshot?.length || 0,
            blockNumber: blockNumber || response.data.blockNumber || 0,
            timestamp: metadata?.timestamp || new Date().toISOString()
          }
        }
      } else {
        // Fallback formatting for different response structure
        formattedData = {
          tokenIds: response.data.tokenIds || [],
          holders: response.data.holders?.map((h: any, index: number) => ({
            address: h.address,
            balance: h.balance,
            percentage: (parseFloat(h.balance) / parseFloat(response.data.totalSupply || '1')) * 100,
            rank: index + 1
          })) || [],
          totalSupply: response.data.totalSupply || '0',
          totalHolders: response.data.totalHolders || 0,
          blockNumber: response.data.blockNumber || 0,
          timestamp: response.data.timestamp || new Date().toISOString()
        }
      }
      
      // Store the last response for demo data detection
      setLastResponse(response.data)
      
      // Only set data if we have holders
      if (formattedData.holders && formattedData.holders.length > 0) {
        console.log('✅ Snapshot data received:', formattedData)
        setSnapshotData(formattedData)
        
        // Refresh date range after successful snapshot (in case new data was processed)
        await refreshDateRange()
      } else {
        console.warn('⚠️ No holders found in response')
        setError('No holders found. Please ensure blockchain data is synced.')
      }
    } catch (err: any) {
      console.error('Snapshot generation error:', err)
      setError(err.response?.data?.error || 'Failed to generate snapshot. Please sync blockchain data first.')
    } finally {
      setLoading(false)
    }
  }

  // Export snapshot data
  const exportData = async (format: 'csv' | 'json') => {
    if (!snapshotData) return

    try {
      // Build params for export API
      const params: any = {
        type: 'snapshot',
        contract: address // Pass contract address for proper CSV formatting
      }

      // Only add block number for historical snapshots
      // For current snapshots, don't pass blockNumber - use current_state table instead
      if (snapshotType === 'historical' && snapshotData.blockNumber) {
        params.blockNumber = snapshotData.blockNumber
      }
      
      const response = await axios.get(`/api/export/${format}`, {
        params,
        responseType: format === 'csv' ? 'text' : 'json'
      })
      
      const blob = new Blob(
        [format === 'csv' ? response.data : JSON.stringify(response.data, null, 2)],
        { type: format === 'csv' ? 'text/csv' : 'application/json' }
      )
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${collection?.name || 'snapshot'}_${Date.now()}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export data')
    }
  }

  // Sync blockchain data
  const syncBlockchain = async () => {
    setSyncStatus({ syncing: true, progress: 0 })
    setError('')

    try {
      // Start blockchain sync
      const response = await axios.post(`/api/contracts/${address}/sync`, {})

      if (response.data.success) {
        console.log('🚀 Sync started:', response.data.message)

        // Poll for sync status with real progress
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await axios.get(`/api/contracts/${address}/sync`)
            const syncData = statusRes.data.data

            console.log('📊 Sync status:', syncData)

            if (syncData.status === 'completed') {
              clearInterval(pollInterval)
              setSyncStatus({ syncing: false, progress: 100 })
              setSyncInfo(syncData) // Update sync info

              // Refresh sync info after a short delay to get latest statistics
              setTimeout(async () => {
                await checkSyncStatus()
                console.log('✅ Sync completed and statistics refreshed!')
              }, 2000)
            } else if (syncData.status === 'processing') {
              // Update progress with real percentage
              const progress = syncData.progressPercentage || 0
              setSyncStatus({ syncing: true, progress })
              setSyncInfo(syncData) // Update sync info during sync
              console.log(`🔄 Sync progress: ${progress}%`)
            } else if (syncData.status === 'failed') {
              clearInterval(pollInterval)
              setSyncStatus({ syncing: false, progress: 0 })
              setError('Sync failed. Please try again.')
              console.error('❌ Sync failed')
            }
          } catch (err) {
            console.error('Status poll error:', err)
          }
        }, 2000) // Poll every 2 seconds

        // Stop polling after 15 minutes (for very large syncs)
        setTimeout(() => {
          clearInterval(pollInterval)
          setSyncStatus({ syncing: false, progress: 100 })

          // Refresh stats when timeout
          checkSyncStatus()
          console.log('⏰ Sync polling timeout, refreshing stats')
        }, 900000) // 15 minutes
      }
    } catch (err) {
      console.error('Sync error:', err)
      setError('Failed to sync blockchain data')
      setSyncStatus({ syncing: false, progress: 0 })
    }
  }

  if (!collection) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="animate-pulse space-y-6">
            <div className="bg-card/20 rounded-lg p-6">
              <div className="h-8 bg-background/50 rounded mb-4"></div>
              <div className="h-4 bg-background/50 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Validate snapshot data

  // Check if connected wallet is authorized for Snapshot access
  const isAuthorizedForSnapshot = walletAddress?.toLowerCase() === AUTHORIZED_SNAPSHOT_WALLET.toLowerCase()
  
  // If not connected or not authorized, show access control message
  if (!isConnected || !isAuthorizedForSnapshot) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="card-glass max-w-md w-full text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Shield className="w-8 h-8 text-orange-400" />
                </div>
              </div>
              
              <h1 className="text-2xl font-bold mb-4">Access Restricted</h1>
              
              {!isConnected ? (
                <>
                  <p className="text-muted-foreground mb-6">
                    Please connect your wallet to access the Snapshot page.
                  </p>
                  <div className="flex justify-center">
                    <ConnectButton />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground mb-4">
                    This page is restricted to authorized internal use only.
                  </p>
                  <p className="text-sm text-muted-foreground/70 mb-6">
                    Connected: <span className="font-mono text-xs">{walletAddress}</span>
                  </p>
                  <div className="text-sm text-orange-400">
                    Access denied - unauthorized wallet address
                  </div>
                </>
              )}
              
              <div className="mt-6">
                <Link 
                  href={`/collections/${address}`}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Collection
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="animate-pulse space-y-6">
            <div className="bg-card/20 rounded-lg p-6">
              <div className="h-8 bg-background/50 rounded mb-4"></div>
              <div className="h-4 bg-background/50 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 px-6 lg:px-8">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href={`/collections/${address}`}
              className="p-2 -ml-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2 flex-1">
              <span className="px-2 py-1 text-xs font-mono bg-green-500/20 text-green-400 rounded">
                Collection: {address.slice(0, 6)}...{address.slice(-4)}
              </span>
            </div>
          </div>
        </div>

        {/* Sync Status Card */}
        {syncInfo && (
          <div className="card-glass mb-4 bg-primary/5 border-primary/20">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Blockchain Sync Status</p>
                <p className="text-sm font-medium">
                  Last synced block: {syncInfo.lastSyncedBlock?.toLocaleString() || 'Never'}
                </p>
                {syncInfo.currentBlockNumber && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Current block: {syncInfo.currentBlockNumber.toLocaleString()}
                    {syncInfo.lastSyncedBlock && syncInfo.currentBlockNumber > syncInfo.lastSyncedBlock && (
                      <span className="text-yellow-400 ml-1">
                        ({(syncInfo.currentBlockNumber - syncInfo.lastSyncedBlock).toLocaleString()} blocks behind)
                      </span>
                    )}
                  </p>
                )}
                {syncInfo.statistics && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {syncInfo.statistics.totalEvents} events · {syncInfo.statistics.totalHolders} holders · {syncInfo.statistics.uniqueTokens} tokens
                  </p>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                syncInfo.isSynced ? 'bg-green-500/20 text-green-400' :
                syncInfo.status === 'syncing' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-orange-500/20 text-orange-400'
              }`}>
                {syncInfo.isSynced ? 'Up to date' :
                 syncInfo.status === 'syncing' ? 'Syncing...' :
                 'Auto-sync on snapshot'}
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="card-glass mb-6">
          <div className="space-y-4">
            {/* Snapshot Type */}
            <div>
              <label className="block text-sm font-medium mb-2">Snapshot Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSnapshotType('current')}
                  className={`py-2 px-4 rounded-lg font-medium transition-all ${
                    snapshotType === 'current'
                      ? 'bg-primary text-background'
                      : 'bg-card border border-border hover:border-primary/50'
                  }`}
                >
                  Current
                </button>
                <button
                  onClick={() => setSnapshotType('historical')}
                  className={`py-2 px-4 rounded-lg font-medium transition-all ${
                    snapshotType === 'historical'
                      ? 'bg-primary text-background'
                      : 'bg-card border border-border hover:border-primary/50'
                  }`}
                >
                  Historical
                </button>
              </div>
            </div>

            {/* Token IDs */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Token IDs (comma-separated, optional)
              </label>

              {/* Full Season Mode Toggle - Only show for ClickCreate collections */}
              {collection.name.toLowerCase().includes('clickcreate') && (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="fullSeasonMode"
                    checked={fullSeasonMode}
                    onChange={(e) => {
                      setFullSeasonMode(e.target.checked)
                      if (!e.target.checked) {
                        setSelectedSeason('')
                      }
                    }}
                    className="rounded border-primary/30 text-primary focus:ring-primary"
                  />
                  <label htmlFor="fullSeasonMode" className="text-xs">
                    Full Season Holders Only (holders who own every NFT in the season)
                  </label>
                </div>
              )}

              {/* Season Quick Select Buttons - Only show for ClickCreate collections */}
              {collection.name.toLowerCase().includes('clickcreate') && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {SEASON_GROUPS.filter(s => s.name.startsWith('season') && !s.name.includes('all')).map((season) => (
                    <button
                      key={season.name}
                      onClick={() => {
                        if (fullSeasonMode) {
                          setSelectedSeason(season.name)
                          setTokenIds('')
                        } else {
                          setTokenIds(formatTokenIdsForInput(season.tokenIds))
                          setSelectedSeason('')
                        }
                      }}
                      className={`px-2.5 py-1 text-xs rounded border transition-all ${
                        fullSeasonMode && selectedSeason === season.name
                          ? 'bg-primary text-background border-primary'
                          : 'border-primary/30 hover:bg-primary/10 hover:border-primary'
                      }`}
                      title={fullSeasonMode ? `Find holders with all ${season.tokenIds.length} NFTs` : season.description}
                    >
                      {season.displayName}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      if (!fullSeasonMode) {
                        setTokenIds(formatTokenIdsForInput(SEASON_GROUPS.find(s => s.name === 'all-seasons')?.tokenIds || []))
                      }
                    }}
                    className="px-2.5 py-1 text-xs rounded border border-primary/30 hover:bg-primary/10 hover:border-primary transition-all"
                  >
                    All Seasons
                  </button>
                  <button
                    onClick={() => {
                      if (!fullSeasonMode) {
                        setTokenIds(formatTokenIdsForInput(SEASON_GROUPS.find(s => s.name === 'subpasses')?.tokenIds || []))
                      }
                    }}
                    className="px-2.5 py-1 text-xs rounded border border-primary/30 hover:bg-primary/10 hover:border-primary transition-all"
                  >
                    SubPasses Only
                  </button>
                  <button
                    onClick={() => {
                      setTokenIds(formatTokenIdsForInput([...Array(96)].map((_: any, i: number) => (i + 1).toString())))
                    }}
                    className="px-2.5 py-1 text-xs rounded border border-primary/30 hover:bg-primary/10 hover:border-primary transition-all"
                  >
                    Entire Collection
                  </button>
                  <button
                    onClick={() => {
                      setTokenIds('')
                      setSelectedSeason('')
                    }}
                    className="px-2.5 py-1 text-xs rounded border border-border hover:bg-card hover:border-primary/30 transition-all"
                  >
                    Clear
                  </button>
                </div>
              )}

              <input
                type="text"
                value={tokenIds}
                onChange={(e) => {
                  setTokenIds(e.target.value)
                  if (e.target.value !== tokenIds) {
                    setExactMatch(null)
                  }
                }}
                placeholder="e.g., 1, 2, 3"
                className="w-full input-glass text-sm"
              />

              {/* Exact Match Selection - MANDATORY */}
              {tokenIds && !fullSeasonMode && (
                <div className="mt-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                  <label className="block text-xs font-medium mb-2">
                    Exact Match <span className="text-primary">*</span> (Required)
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 p-2 border border-border rounded cursor-pointer hover:bg-primary/5 transition-colors">
                      <input
                        type="radio"
                        name="exactMatch"
                        value="yes"
                        checked={exactMatch === true}
                        onChange={() => setExactMatch(true)}
                        className="text-primary focus:ring-primary"
                      />
                      <div className="text-xs">
                        <div className="font-medium">YES - Exact Match</div>
                        <div className="text-muted-foreground text-[10px]">
                          Only EXACTLY these tokens
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-2 border border-border rounded cursor-pointer hover:bg-primary/5 transition-colors">
                      <input
                        type="radio"
                        name="exactMatch"
                        value="no"
                        checked={exactMatch === false}
                        onChange={() => setExactMatch(false)}
                        className="text-primary focus:ring-primary"
                      />
                      <div className="text-xs">
                        <div className="font-medium">NO - Any Match</div>
                        <div className="text-muted-foreground text-[10px]">
                          ANY of these tokens
                        </div>
                      </div>
                    </label>
                  </div>

                  {exactMatch === null && (
                    <div className="mt-2 text-xs text-orange-400">
                      ⚠️ Please select an option to continue
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date Options (for historical) */}
            {snapshotType === 'historical' && (
              <div className="space-y-3">
                {/* Date Mode Toggle */}
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dateMode"
                      checked={dateMode === 'single'}
                      onChange={() => {
                        setDateMode('single')
                        setStartDate('')
                        setEndDate('')
                      }}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="font-medium">Single Date</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="dateMode"
                      checked={dateMode === 'range'}
                      onChange={() => {
                        setDateMode('range')
                        setSnapshotDate('')
                        if (!startDate) setStartDate('')
                        if (!endDate) setEndDate('')
                      }}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="font-medium">Date Range</span>
                  </label>
                </div>

                {/* Single Date Input */}
                {dateMode === 'single' && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5">
                      Snapshot Date
                    </label>
                    <input
                      type="date"
                      value={snapshotDate}
                      min={dateRange?.minDate}
                      max={dateRange?.maxDate}
                      onChange={(e) => setSnapshotDate(e.target.value)}
                      className="w-full input-glass text-sm"
                    />
                    {dateRange && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Available: {dateRange.minDate} to {dateRange.maxDate}
                      </p>
                    )}
                  </div>
                )}

                {/* Date Range Inputs */}
                {dateMode === 'range' && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium mb-1.5">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={startDate}
                          min={dateRange?.minDate}
                          max={dateRange?.maxDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full input-glass text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1.5">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={endDate}
                          min={startDate || dateRange?.minDate}
                          max={dateRange?.maxDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full input-glass text-sm"
                        />
                      </div>
                    </div>
                    {dateRange && (
                      <p className="text-[10px] text-muted-foreground">
                        Available: {dateRange.minDate} to {dateRange.maxDate}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={syncBlockchain}
                disabled={syncStatus.syncing}
                className="btn-secondary flex items-center justify-center gap-2 flex-1"
              >
                <RefreshCw className={`w-4 h-4 ${syncStatus.syncing ? 'animate-spin' : ''}`} />
                {syncStatus.syncing ? `Syncing ${syncStatus.progress}%` : 'Sync Blockchain'}
              </button>
              <button
                onClick={generateSnapshot}
                disabled={loading}
                className="btn-primary flex items-center justify-center gap-2 flex-1"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Generate Snapshot
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        {snapshotData && (
          <>
            {/* Statistics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="card-glass bg-primary/5">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total Holders</p>
                    <p className="text-lg font-bold">{snapshotData.totalHolders.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="card-glass bg-primary/5">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Block Number</p>
                    <p className="text-lg font-bold">{snapshotData.blockNumber.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="card-glass bg-primary/5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total Supply</p>
                    <p className="text-lg font-bold">{parseFloat(snapshotData.totalSupply).toFixed(0)}</p>
                  </div>
                </div>
              </div>

              <div className="card-glass bg-primary/5">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Timestamp</p>
                    <p className="text-lg font-bold">
                      {new Date(snapshotData.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Demo Data Warning */}
            {lastResponse && (() => {
              // Check if this is demo data based on metadata
              const metadata = lastResponse?.metadata
              const responseSyncStatus = lastResponse?.syncStatus
              
              // More robust demo detection - only show demo notice if explicitly marked as demo
              // Since we have real data (1900 holders, real block numbers), don't show demo notice
              const isDemo = metadata?.isDemo === true
              
              if (isDemo) {
                return (
                  <div className="mb-8 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <h3 className="text-orange-400 font-semibold">Demo Data Notice</h3>
                    </div>
                    <p className="text-orange-300 text-sm mb-3">
                      {metadata?.demoNotice || 'This snapshot shows demo data. To see real blockchain data, you need to sync this contract first.'}
                    </p>
                    <button
                      onClick={syncBlockchain}
                      disabled={syncStatus?.syncing || false}
                      className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors text-sm font-medium"
                    >
                      {syncStatus?.syncing ? 'Syncing...' : 'Sync Real Data'}
                    </button>
                  </div>
                )
              }
              return null
            })()}

            {/* Export and Validation Buttons */}
            <div className="flex gap-2 mb-6 flex-wrap">
              <button
                onClick={() => exportData('csv')}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
              <button
                onClick={() => exportData('json')}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <Download className="w-3.5 h-3.5" />
                JSON
              </button>
            </div>

            {/* Holders Table */}
            <div className="card-glass overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h2 className="text-xl font-semibold">Holders ({snapshotData.totalHolders || snapshotData.holders.length})</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowAllHolders(!showAllHolders)
                      setCurrentPage(1)
                    }}
                    className="btn-secondary text-sm"
                  >
                    {showAllHolders ? 'Show Top 20' : 'Show All'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Rank</th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-muted-foreground">Address</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-muted-foreground">Balance</th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-muted-foreground">Percentage</th>
                      <th className="px-6 py-3 text-center text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const start = showAllHolders ? (currentPage - 1) * holdersPerPage : 0
                      const end = showAllHolders ? start + holdersPerPage : 20
                      const displayHolders = snapshotData.holders.slice(start, end)
                      
                      return displayHolders.map((holder, index) => (
                        <tr key={`${holder.address}-${index}`} className="border-b border-border/50 hover:bg-card/50 transition-colors">
                          <td className="px-6 py-4 text-sm">
                            <span className="text-primary font-medium">#{holder.rank || start + index + 1}</span>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono">
                            {holder.address || 'Invalid Address'}
                          </td>
                          <td className="px-6 py-4 text-sm text-right font-medium">
                            {holder.balance ? parseFloat(holder.balance).toLocaleString() : '0'}
                          </td>
                          <td className="px-6 py-4 text-sm text-right">
                            <span className="text-primary">{holder.percentage ? holder.percentage.toFixed(4) : '0.0000'}%</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-center">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(holder.address)
                              }}
                              className="text-muted-foreground hover:text-primary transition-colors"
                              title="Copy address"
                            >
                              <Copy className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
              {showAllHolders && snapshotData.holders.length > holdersPerPage && (
                <div className="p-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * holdersPerPage) + 1} - {Math.min(currentPage * holdersPerPage, snapshotData.holders.length)} of {snapshotData.holders.length} holders
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded-lg bg-card border border-border hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1 text-sm">
                        Page {currentPage} of {Math.ceil(snapshotData.holders.length / holdersPerPage)}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(snapshotData.holders.length / holdersPerPage), prev + 1))}
                        disabled={currentPage === Math.ceil(snapshotData.holders.length / holdersPerPage)}
                        className="px-3 py-1 rounded-lg bg-card border border-border hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {!showAllHolders && snapshotData.holders.length > 20 && (
                <div className="p-4 text-center text-sm text-muted-foreground border-t border-border">
                  Showing top 20 of {snapshotData.holders.length} holders. Click &quot;Show All&quot; to see more.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}