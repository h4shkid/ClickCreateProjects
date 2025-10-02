'use client'

import { useState, useEffect } from 'react'
import { Download, Search, RefreshCw, Calendar, Users, Hash, TrendingUp, Copy, Plus, Shield } from 'lucide-react'
import axios from 'axios'
import { SEASON_GROUPS, formatTokenIdsForInput } from '@/lib/constants/season-tokens'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'

// Authorized wallet address for Snapshot page access
const AUTHORIZED_SNAPSHOT_WALLET = '0x4Ae8B436e50f762Fa8fad29Fd548b375fEe968AC'

// Internal collection address for snapshot operations
const INTERNAL_COLLECTION_ADDRESS = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'

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

export default function SnapshotPage() {
  const { isAuthenticated } = useAuth()
  const { isConnected, address } = useAccount()
  const [loading, setLoading] = useState(false)
  const [snapshotData, setSnapshotData] = useState<SnapshotData | null>(null)
  const [tokenIds, setTokenIds] = useState<string>('')
  const [snapshotDate, setSnapshotDate] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single')
  const [snapshotType, setSnapshotType] = useState<'current' | 'historical'>('current')
  const [error, setError] = useState<string>('')
  const [syncStatus, setSyncStatus] = useState({ syncing: false, progress: 0 })
  const [syncInfo, setSyncInfo] = useState<any>(null)
  const [dateRange, setDateRange] = useState<{ minDate: string, maxDate: string } | null>(null)
  const [showAllHolders, setShowAllHolders] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [fullSeasonMode, setFullSeasonMode] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState<string>('')
  const [exactMatch, setExactMatch] = useState<boolean | null>(null)
  const [validationInfo, setValidationInfo] = useState<any>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const holdersPerPage = 50
  
  // Check if connected wallet is authorized for Snapshot access
  const isAuthorizedForSnapshot = address?.toLowerCase() === AUTHORIZED_SNAPSHOT_WALLET.toLowerCase()
  
  // Function to refresh date range
  const refreshDateRange = async () => {
    try {
      const response = await axios.get(`/api/contracts/${INTERNAL_COLLECTION_ADDRESS}/date-range`)
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

  // Check sync status and date range for internal collection
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [syncResponse, dateRangeResponse] = await Promise.all([
          axios.get(`/api/contracts/${INTERNAL_COLLECTION_ADDRESS}/sync`),
          axios.get(`/api/contracts/${INTERNAL_COLLECTION_ADDRESS}/date-range`)
        ])
        
        if (syncResponse.data.success) {
          setSyncInfo(syncResponse.data.data)
        }
        
        if (dateRangeResponse.data.success) {
          setDateRange({
            minDate: dateRangeResponse.data.data.dateRange.minDate,
            maxDate: dateRangeResponse.data.data.dateRange.maxDate
          })
        }
      } catch (err) {
        console.error('Failed to get data:', err)
      }
    }
    fetchData()
  }, [])

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
        ? `/api/contracts/${INTERNAL_COLLECTION_ADDRESS}/snapshot/current`
        : `/api/contracts/${INTERNAL_COLLECTION_ADDRESS}/snapshot/historical`
      
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
      console.log('Full season mode:', fullSeasonMode, 'Selected season:', selectedSeason)
      const response = await axios.get(endpoint, { 
        params,
        timeout: 30000 // 30 second timeout
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
          // TODO: Could create a special UI for comparison view
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
      
      // Only set data if we have holders
      if (formattedData.holders && formattedData.holders.length > 0) {
        console.log('✅ Snapshot data received:', formattedData)
        setSnapshotData(formattedData)
        
        // Check if snapshot includes validation info and display it
        if (formattedData.metadata?.validation) {
          setValidationInfo(formattedData.metadata.validation)
          console.log('📊 Auto-displaying validation info from snapshot')
        }
        
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
      // For the internal snapshot page, export the data directly from snapshotData
      // instead of calling the export API which has contract address issues
      
      if (format === 'csv') {
        // Generate CSV with proper format including sets calculation
        const headers = ['wallet_id', 'number_of_sets', 'total_tokens_held', 'token_ids_held', 'snapshot_time', 'token_id_list']
        const csvHeaders = headers.join(',')
        
        const csvRows = snapshotData.holders.map(holder => {
          const totalTokensHeld = parseInt(holder.balance)
          const snapshotTime = snapshotData.timestamp
          
          // Calculate number of sets based on mode
          let numberOfSets = totalTokensHeld
          let tokenIdList = 'all'
          
          if (fullSeasonMode && selectedSeason) {
            // For complete season holders, they have 1 complete set of the season
            // But they might own multiple copies, so calculate how many complete sets
            const { getSeasonGroup } = require('@/lib/constants/season-tokens')
            const seasonGroup = getSeasonGroup(selectedSeason)
            if (seasonGroup) {
              const seasonTokenCount = seasonGroup.tokenIds.length
              numberOfSets = Math.floor(totalTokensHeld / seasonTokenCount)
            } else {
              numberOfSets = 1 // Default to 1 complete season set
            }
            tokenIdList = `${selectedSeason}_complete_holders`
          } else if (tokenIds) {
            // For specific token queries
            const queryTokensArray = tokenIds.split(',').map(id => id.trim())
            if (exactMatch === true) {
              // Exact match: they have exactly the queried tokens
              numberOfSets = Math.floor(totalTokensHeld / queryTokensArray.length)
            } else {
              // Any match: number of sets = total tokens (each token is a set)
              numberOfSets = totalTokensHeld
            }
            tokenIdList = tokenIds.replace(/\s/g, '')
          } else {
            // All holders: each token is considered a set
            numberOfSets = totalTokensHeld
          }
          
          return [
            holder.address,
            numberOfSets, // number_of_sets (calculated based on query type)
            totalTokensHeld, // total_tokens_held (actual balance)
            '', // token_ids_held (would need detailed query to populate)
            snapshotTime,
            tokenIdList
          ].join(',')
        })
        
        const csvContent = [csvHeaders, ...csvRows].join('\n')
        
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // Generate filename based on snapshot type and parameters
        let filename = 'snapshot'
        if (fullSeasonMode && selectedSeason) {
          filename = `snapshot_${selectedSeason}_complete_holders`
        } else if (tokenIds && exactMatch !== null) {
          filename = `snapshot_tokens_${exactMatch ? 'exact' : 'any'}_match`
        } else if (tokenIds) {
          filename = `snapshot_multi_tokens`
        } else {
          filename = 'snapshot_all_holders'
        }
        
        if (snapshotData.blockNumber > 0) {
          filename += `_block_${snapshotData.blockNumber}`
        } else {
          filename += '_current'
        }
        
        a.download = `${filename}_${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
      } else {
        // JSON export
        const jsonData = {
          metadata: {
            exportTime: new Date().toISOString(),
            snapshotType: snapshotType,
            blockNumber: snapshotData.blockNumber,
            totalHolders: snapshotData.totalHolders,
            totalSupply: snapshotData.totalSupply,
            contractAddress: INTERNAL_COLLECTION_ADDRESS,
            parameters: {
              tokenIds: tokenIds || 'all',
              fullSeasonMode,
              selectedSeason,
              exactMatch,
              startDate: startDate || undefined,
              endDate: endDate || undefined
            }
          },
          holders: snapshotData.holders
        }
        
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `snapshot_${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
      
    } catch (err) {
      console.error('Export error:', err)
      setError('Failed to export data')
    }
  }

  // Validate snapshot data
  const validateSnapshot = async () => {
    if (!snapshotData) {
      setError('No snapshot data to validate')
      return
    }

    setValidationLoading(true)
    setError('')
    
    try {
      console.log('🔍 Running snapshot validation...')
      
      const response = await axios.get(`/api/contracts/${INTERNAL_COLLECTION_ADDRESS}/validate`, {
        params: {
          type: 'full',
          blockNumber: snapshotData.blockNumber > 0 ? snapshotData.blockNumber : undefined
        }
      })
      
      if (response.data.success) {
        setValidationInfo(response.data.data.validation)
        console.log('✅ Validation complete:', response.data.data.validation)
      } else {
        setError('Validation failed: ' + response.data.error)
      }
      
    } catch (err) {
      console.error('Validation error:', err)
      setError('Failed to validate snapshot data')
    } finally {
      setValidationLoading(false)
    }
  }

  // Sync blockchain data
  const syncBlockchain = async () => {
    setSyncStatus({ syncing: true, progress: 0 })
    setError('')
    
    try {
      // Start blockchain sync for internal collection
      const response = await axios.post(`/api/contracts/${INTERNAL_COLLECTION_ADDRESS}/sync`, {})
      
      if (response.data.success) {
        console.log('🚀 Sync started:', response.data.message)
        
        // Poll for sync status with real progress
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await axios.get(`/api/contracts/${INTERNAL_COLLECTION_ADDRESS}/sync`)
            const syncData = statusRes.data.data
            
            console.log('📊 Sync status:', syncData)
            
            if (syncData.status === 'completed') {
              clearInterval(pollInterval)
              setSyncStatus({ syncing: false, progress: 100 })
              setSyncInfo(syncData) // Update sync info
              console.log('✅ Sync completed!')
              // Refresh date range after sync completion
              await refreshDateRange()
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
          console.log('⏰ Sync polling timeout')
        }, 900000) // 15 minutes
      }
    } catch (err) {
      console.error('Sync error:', err)
      setError('Failed to sync blockchain data')
      setSyncStatus({ syncing: false, progress: 0 })
    }
  }

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
                    Connected: <span className="font-mono text-xs">{address}</span>
                  </p>
                  <div className="text-sm text-orange-400">
                    Access denied - unauthorized wallet address
                  </div>
                </>
              )}
            </div>
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
            Internal <span className="gradient-text">Snapshot Tool</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Generate current or historical holder snapshots for internal collection analysis
          </p>
          <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-muted-foreground">
                Collection: <span className="font-mono text-xs">{INTERNAL_COLLECTION_ADDRESS}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Sync Status Card */}
        {syncInfo && (
          <div className="card-glass mb-6 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blockchain Sync Status</p>
                <p className="text-lg font-medium">
                  Last synced block: {syncInfo.lastSyncedBlock?.toLocaleString() || 'Never'}
                </p>
                {syncInfo.currentBlockNumber && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Current block: {syncInfo.currentBlockNumber.toLocaleString()}
                    {syncInfo.lastSyncedBlock && syncInfo.currentBlockNumber > syncInfo.lastSyncedBlock && (
                      <span className="text-yellow-400 ml-2">
                        ({(syncInfo.currentBlockNumber - syncInfo.lastSyncedBlock).toLocaleString()} blocks behind)
                      </span>
                    )}
                  </p>
                )}
                {syncInfo.statistics && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {syncInfo.statistics.totalEvents} events · {syncInfo.statistics.totalHolders} holders · {syncInfo.statistics.uniqueTokens} tokens
                  </p>
                )}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${ 
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
        <div className="card-glass mb-8">
          <div className="grid md:grid-cols-2 gap-6">
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
              
              {/* Full Season Mode Toggle */}
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
                <label htmlFor="fullSeasonMode" className="text-xs font-medium">
                  Full Season Holders Only (holders who own every NFT in the season)
                </label>
              </div>
              
              {/* Season Quick Select Buttons */}
              <div className="flex flex-wrap gap-2 mb-2">
                {SEASON_GROUPS.filter(s => s.name.startsWith('season') && !s.name.includes('all')).map((season) => (
                  <button
                    key={season.name}
                    onClick={() => {
                      if (fullSeasonMode) {
                        setSelectedSeason(season.name)
                        setTokenIds('') // Clear token IDs when using full season mode
                      } else {
                        setTokenIds(formatTokenIdsForInput(season.tokenIds))
                        setSelectedSeason('')
                      }
                    }}
                    className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                      fullSeasonMode && selectedSeason === season.name
                        ? 'bg-primary text-background border-primary'
                        : 'border-primary/30 hover:bg-primary/10 hover:border-primary'
                    }`}
                    title={fullSeasonMode ? `Find holders with all ${season.tokenIds.length} NFTs` : season.description}
                  >
                    {season.displayName}
                  </button>
                ))}
                
                {!fullSeasonMode && (
                  <>
                    {SEASON_GROUPS.filter(s => !s.name.startsWith('season') || s.name.includes('all')).map((season) => (
                      <button
                        key={season.name}
                        onClick={() => setTokenIds(formatTokenIdsForInput(season.tokenIds))}
                        className="px-3 py-1 text-xs rounded-lg border border-muted/30 hover:bg-muted/10 hover:border-muted transition-all"
                        title={season.description}
                      >
                        {season.displayName}
                      </button>
                    ))}
                  </>
                )}
                
                <button
                  onClick={() => {
                    setTokenIds('')
                    setSelectedSeason('')
                  }}
                  className="px-3 py-1 text-xs rounded-lg border border-border hover:bg-card hover:border-primary/30 transition-all"
                >
                  Clear
                </button>
              </div>
              
              <input
                type="text"
                value={tokenIds}
                onChange={(e) => {
                  setTokenIds(e.target.value)
                  // Reset exact match when tokens change
                  if (e.target.value !== tokenIds) {
                    setExactMatch(null)
                  }
                }}
                placeholder="e.g., 1, 2, 3"
                className="w-full input-glass mb-3"
              />
              
              {/* Exact Match Selection - MANDATORY */}
              {tokenIds && !fullSeasonMode && (
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                  <label className="block text-sm font-medium mb-3">
                    Exact Match <span className="text-primary">*</span> (Required)
                  </label>
                  
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="exactMatch"
                        value="yes"
                        checked={exactMatch === true}
                        onChange={() => setExactMatch(true)}
                        className="mt-1 text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="font-medium">YES - Exact Match</div>
                        <div className="text-xs text-muted-foreground">
                          Only wallets that hold EXACTLY the queried tokens (no more, no less).
                          <br />
                          Example: Query &quot;1,2,3&quot; → Returns only wallets with tokens 1,2,3
                        </div>
                      </div>
                    </label>
                    
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="exactMatch"
                        value="no"
                        checked={exactMatch === false}
                        onChange={() => setExactMatch(false)}
                        className="mt-1 text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="font-medium">NO - Any Match</div>
                        <div className="text-xs text-muted-foreground">
                          Wallets holding ANY token in the queried list.
                          <br />
                          Example: Query &quot;1,2,3&quot; → Returns wallets with 1, or 1,2, or 2,3, etc.
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
              <div className="space-y-4">
                {/* Date Mode Toggle */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
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
                    <span className="text-sm font-medium">Single Date</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
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
                    <span className="text-sm font-medium">Date Range Comparison</span>
                  </label>
                </div>

                {/* Single Date Input */}
                {dateMode === 'single' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Snapshot Date
                    </label>
                    <input
                      type="date"
                      value={snapshotDate}
                      min={dateRange?.minDate}
                      max={dateRange?.maxDate}
                      onChange={(e) => setSnapshotDate(e.target.value)}
                      className="w-full input-glass"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      The system will automatically find the closest blockchain block for this date.
                      {dateRange && (
                        <span className="block mt-1 text-primary">
                          Available data: {dateRange.minDate} to {dateRange.maxDate}
                        </span>
                      )}
                    </p>
                  </div>
                )}

                {/* Date Range Inputs */}
                {dateMode === 'range' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        min={dateRange?.minDate}
                        max={dateRange?.maxDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full input-glass"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        min={startDate || dateRange?.minDate}
                        max={dateRange?.maxDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full input-glass"
                      />
                    </div>
                  </div>
                )}
                
                {dateMode === 'range' && (
                  <p className="text-xs text-muted-foreground">
                    Compare holders between two dates. Shows new holders, removed holders, and balance changes.
                    {dateRange && (
                      <span className="block mt-1 text-primary">
                        Available data: {dateRange.minDate} to {dateRange.maxDate}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Sync Status */}
            <div>
              <label className="block text-sm font-medium mb-2">Blockchain Sync</label>
              <button
                onClick={syncBlockchain}
                disabled={syncStatus.syncing}
                className="btn-secondary w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncStatus.syncing ? 'animate-spin' : ''}`} />
                {syncStatus.syncing ? `Syncing... ${syncStatus.progress}%` : 'Sync Blockchain'}
              </button>
            </div>
          </div>

          {/* Generate Button */}
          <div className="mt-6 flex gap-4">
            <button
              onClick={generateSnapshot}
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="card-glass">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Holders</p>
                    <p className="text-xl font-bold">{snapshotData.totalHolders.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div className="card-glass">
                <div className="flex items-center gap-3">
                  <Hash className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Block Number</p>
                    <p className="text-xl font-bold">{snapshotData.blockNumber.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              
              <div className="card-glass">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Supply</p>
                    <p className="text-xl font-bold">{parseFloat(snapshotData.totalSupply).toFixed(0)}</p>
                  </div>
                </div>
              </div>
              
              <div className="card-glass">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Timestamp</p>
                    <p className="text-xl font-bold">
                      {new Date(snapshotData.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Export and Validation Buttons */}
            <div className="flex gap-4 mb-8 flex-wrap">
              <button
                onClick={() => exportData('csv')}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => exportData('json')}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
              <button
                onClick={validateSnapshot}
                disabled={validationLoading || !snapshotData}
                className="btn-outline flex items-center gap-2 disabled:opacity-50"
              >
                {validationLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Validate Data
              </button>
            </div>

            {/* Validation Results */}
            {validationInfo && (
              <div className={`card-glass mb-8 ${
                validationInfo.isValid ? 'border-green-500/50' : 'border-red-500/50'
              }`}>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      validationInfo.isValid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {validationInfo.isValid ? '✓' : '⚠'}
                    </div>
                    <h3 className="text-lg font-semibold">
                      Data Validation {validationInfo.isValid ? 'Passed' : 'Issues Found'}
                    </h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-background/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Total Errors</div>
                      <div className="text-2xl font-bold text-red-400">
                        {validationInfo.summary?.totalErrors || 0}
                      </div>
                    </div>
                    <div className="bg-background/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Total Warnings</div>
                      <div className="text-2xl font-bold text-yellow-400">
                        {validationInfo.summary?.totalWarnings || 0}
                      </div>
                    </div>
                    <div className="bg-background/30 rounded-lg p-4">
                      <div className="text-sm text-muted-foreground">Health Status</div>
                      <div className={`text-2xl font-bold ${
                        validationInfo.summary?.overallHealth === 'GOOD' ? 'text-green-400' :
                        validationInfo.summary?.overallHealth === 'FAIR' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {validationInfo.summary?.overallHealth || 'UNKNOWN'}
                      </div>
                    </div>
                  </div>

                  {(validationInfo.errors?.length > 0 || validationInfo.warnings?.length > 0) && (
                    <div className="space-y-3">
                      {validationInfo.errors?.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-400 mb-2">Errors:</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-red-300">
                            {validationInfo.errors.slice(0, 5).map((error: string, index: number) => (
                              <li key={index}>{error}</li>
                            ))}
                            {validationInfo.errors.length > 5 && (
                              <li className="text-muted-foreground">
                                ... and {validationInfo.errors.length - 5} more errors
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                      
                      {validationInfo.warnings?.length > 0 && (
                        <div>
                          <h4 className="font-medium text-yellow-400 mb-2">Warnings:</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-yellow-300">
                            {validationInfo.warnings.slice(0, 5).map((warning: string, index: number) => (
                              <li key={index}>{warning}</li>
                            ))}
                            {validationInfo.warnings.length > 5 && (
                              <li className="text-muted-foreground">
                                ... and {validationInfo.warnings.length - 5} more warnings
                              </li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {validationInfo.details && (
                    <div className="mt-4 text-sm text-muted-foreground">
                      <div>Validation performed on: {new Date(validationInfo.lastValidated || Date.now()).toLocaleString()}</div>
                      {validationInfo.details.totalHolders && (
                        <div>Total holders validated: {validationInfo.details.totalHolders}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

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