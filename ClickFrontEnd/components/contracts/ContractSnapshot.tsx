'use client'

import { useState, useEffect } from 'react'
import { useContract } from '@/lib/contracts/ContractContext'
import { Camera, Calendar, Download, Users, BarChart3, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import axios from 'axios'

interface SnapshotRequest {
  type: 'current' | 'historical'
  date?: string
  startDate?: string
  endDate?: string
  name?: string
  description?: string
}

interface SnapshotResult {
  id: string
  name: string
  type: 'current' | 'historical' | 'dateRange'
  blockNumber: number
  totalHolders: number
  totalSupply: string
  uniqueTokens: number
  createdAt: string
  downloadUrl?: string
  validationInfo?: any
  dateRange?: {
    startDate: string
    endDate: string
  }
}

interface ContractSnapshotProps {
  contractAddress: string
}

export function ContractSnapshot({ contractAddress }: ContractSnapshotProps) {
  const { contract, isLoading } = useContract()
  const [snapshots, setSnapshots] = useState<SnapshotResult[]>([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(false)
  const [generatingSnapshot, setGeneratingSnapshot] = useState(false)
  const [snapshotForm, setSnapshotForm] = useState<SnapshotRequest>({
    type: 'current',
    name: '',
    description: ''
  })
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single')
  const [dateRange, setDateRange] = useState<{ minDate: string, maxDate: string } | null>(null)
  const [validationInfo, setValidationInfo] = useState<any>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Token filtering state
  const [tokenIds, setTokenIds] = useState<string>('')
  const [exactMatch, setExactMatch] = useState<boolean | null>(null)

  // Function to refresh date range
  const refreshDateRange = async () => {
    try {
      const response = await axios.get(`/api/contracts/${contractAddress}/date-range`)
      
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

  useEffect(() => {
    const fetchData = async () => {
      setLoadingSnapshots(true)
      try {
        // Fetch both snapshots and date range in parallel
        const [snapshotsResponse, dateRangeResponse] = await Promise.all([
          axios.get(`/api/contracts/${contractAddress}/snapshots`),
          axios.get(`/api/contracts/${contractAddress}/date-range`)
        ])
        
        if (snapshotsResponse.data.success) {
          setSnapshots(snapshotsResponse.data.snapshots || [])
        }
        
        if (dateRangeResponse.data.success) {
          setDateRange({
            minDate: dateRangeResponse.data.data.dateRange.minDate,
            maxDate: dateRangeResponse.data.data.dateRange.maxDate
          })
        }
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setLoadingSnapshots(false)
      }
    }

    if (contractAddress) {
      fetchData()
    }
  }, [contractAddress])

  const handleGenerateSnapshot = async () => {
    setGeneratingSnapshot(true)
    setError('')
    try {
      let response
      let data
      
      if (snapshotForm.type === 'current') {
        // Use current snapshot API
        response = await axios.get(`/api/contracts/${contractAddress}/snapshot/current`)
        data = response.data
      } else {
        // Use contract-specific historical snapshot API with date parameters
        const params: any = {}

        if (snapshotForm.startDate && snapshotForm.endDate) {
          params.startDate = snapshotForm.startDate
          params.endDate = snapshotForm.endDate
        } else if (snapshotForm.date) {
          params.date = snapshotForm.date
        }

        // Add token filtering parameters if provided
        if (tokenIds.trim()) {
          params.tokenIds = tokenIds.trim()
          if (exactMatch !== null) {
            params.exactMatch = exactMatch.toString()
          }
        }

        response = await axios.get(`/api/contracts/${contractAddress}/snapshot/historical`, {
          params,
          timeout: 180000 // 3 minute timeout for historical snapshots
        })
        data = response.data
      }
      
      if (data.success) {
        // Determine snapshot type and extract validation info
        const isDateRange = snapshotForm.startDate && snapshotForm.endDate
        const snapshotType = isDateRange ? 'dateRange' : snapshotForm.type
        
        // Extract validation info if available
        const validationInfo = data.data.metadata?.validation || data.data.validation || data.metadata?.validation
        if (validationInfo) {
          setValidationInfo(validationInfo)
          console.log('📊 Auto-displaying validation info from snapshot')
        }
        
        // Create a snapshot result object
        const snapshot: SnapshotResult = {
          id: Date.now().toString(),
          name: snapshotForm.name || `${
            snapshotForm.type === 'current' ? 'Current' : 
            isDateRange ? 'Date Range Comparison' : 'Historical'
          } Snapshot`,
          type: snapshotType,
          blockNumber: snapshotForm.type === 'current' 
            ? data.data.metadata?.currentBlock || 0
            : isDateRange
            ? data.data.dateRange?.blocks?.endBlock || 0
            : data.data.metadata?.blockNumber || 0,
          totalHolders: snapshotForm.type === 'current'
            ? data.data.totalHolders
            : isDateRange 
            ? data.data.snapshots?.end?.uniqueHolders || 0
            : data.data.metadata?.uniqueHolders || 0,
          totalSupply: snapshotForm.type === 'current'
            ? data.data.totalSupply
            : isDateRange
            ? data.data.snapshots?.end?.totalSupply || '0'
            : data.data.metadata?.totalSupply || '0',
          uniqueTokens: snapshotForm.type === 'current'
            ? data.data.uniqueTokens || 0
            : 0,
          createdAt: new Date().toISOString(),
          downloadUrl: `/api/export/csv?type=snapshot&contract=${contractAddress}${
            snapshotForm.type === 'historical' 
              ? isDateRange 
                ? `&blockNumber=${data.data.dateRange?.blocks?.endBlock || 0}` 
                : `&blockNumber=${data.data.metadata?.blockNumber || 0}`
              : ''
          }&validate=true`,
          validationInfo,
          ...(isDateRange && {
            dateRange: {
              startDate: snapshotForm.startDate,
              endDate: snapshotForm.endDate
            }
          })
        }
        
        setSnapshots(prev => [snapshot, ...prev])
        setSnapshotForm({
          type: 'current',
          name: '',
          description: ''
        })
        
        // Refresh date range after successful snapshot (in case new data was synced)
        await refreshDateRange()
      } else {
        setError(data.error || 'Failed to generate snapshot')
      }
    } catch (err: any) {
      console.error('Failed to generate snapshot:', err)
      setError(err.response?.data?.error || 'Failed to generate snapshot. Please sync blockchain data first.')
    } finally {
      setGeneratingSnapshot(false)
    }
  }

  // Validate snapshot data
  const validateSnapshot = async (snapshot?: SnapshotResult) => {
    if (!snapshot) {
      console.error('No snapshot to validate')
      return
    }

    setValidationLoading(true)
    setError('')
    
    try {
      console.log('🔍 Running snapshot validation for contract:', contractAddress)
      
      const response = await axios.get(`/api/contracts/${contractAddress}/validate`, {
        params: {
          type: 'full',
          ...(snapshot.blockNumber > 0 && { blockNumber: snapshot.blockNumber.toString() })
        }
      })
      
      if (response.data.success) {
        setValidationInfo(response.data.data.validation)
        console.log('✅ Validation complete:', response.data.data.validation)
      } else {
        console.error('Validation failed:', response.data.error)
        setError('Validation failed: ' + response.data.error)
      }
      
    } catch (err: any) {
      console.error('Validation error:', err)
      setError(err.response?.data?.error || 'Failed to validate snapshot data')
    } finally {
      setValidationLoading(false)
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000)

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-card/20 rounded-lg p-4 animate-pulse">
          <div className="h-4 bg-background/50 rounded mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-background/50 rounded"></div>
            <div className="h-3 bg-background/50 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Snapshot Generator */}
      <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Camera className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Generate Snapshot</h2>
        </div>

        <div className="space-y-3">
          {/* Snapshot Type */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Snapshot Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSnapshotForm(prev => ({ ...prev, type: 'current' }))}
                className={`p-2 border border-border rounded-lg text-left transition-all ${
                  snapshotForm.type === 'current'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:border-primary/40 text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">Current</span>
                </div>
              </button>

              <button
                onClick={() => setSnapshotForm(prev => ({ ...prev, type: 'historical' }))}
                className={`p-2 border border-border rounded-lg text-left transition-all ${
                  snapshotForm.type === 'historical'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:border-primary/40 text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Historical</span>
                </div>
              </button>
            </div>
          </div>

          {/* Token Filtering (for historical snapshots) */}
          {snapshotForm.type === 'historical' && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Token IDs (optional, comma-separated)
              </label>
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
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />

              {/* Exact Match Selection */}
              {tokenIds.trim() && (
                <div className="mt-2 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                  <label className="block text-xs font-medium mb-2">
                    Match Type <span className="text-primary">*</span>
                  </label>

                  <div className="space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="exactMatch"
                        checked={exactMatch === true}
                        onChange={() => setExactMatch(true)}
                        className="mt-0.5 text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="text-xs font-medium">Exact Match</div>
                        <div className="text-[10px] text-muted-foreground">
                          Only holders with EXACTLY these tokens
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="exactMatch"
                        checked={exactMatch === false}
                        onChange={() => setExactMatch(false)}
                        className="mt-0.5 text-primary focus:ring-primary"
                      />
                      <div>
                        <div className="text-xs font-medium">Any Match</div>
                        <div className="text-[10px] text-muted-foreground">
                          Holders with ANY of these tokens
                        </div>
                      </div>
                    </label>
                  </div>

                  {exactMatch === null && (
                    <div className="mt-2 text-[10px] text-orange-400">
                      ⚠️ Please select a match type
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Historical Date Options */}
          {snapshotForm.type === 'historical' && (
            <div className="space-y-3">
              {/* Date Range Toggle */}
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dateMode"
                    checked={dateMode === 'single'}
                    onChange={() => {
                      setDateMode('single')
                      setSnapshotForm(prev => ({
                        ...prev,
                        startDate: undefined,
                        endDate: undefined
                      }))
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
                      setSnapshotForm(prev => ({
                        ...prev,
                        date: undefined,
                        startDate: '',
                        endDate: ''
                      }))
                    }}
                    className="text-primary focus:ring-primary"
                  />
                  <span className="font-medium">Date Range</span>
                </label>
              </div>

              {/* Single Date Input */}
              {dateMode === 'single' && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1.5">
                    Snapshot Date
                  </label>
                  <input
                    type="date"
                    value={snapshotForm.date || ''}
                    min={dateRange?.minDate}
                    max={dateRange?.maxDate}
                    onChange={(e) => setSnapshotForm(prev => ({
                      ...prev,
                      date: e.target.value || undefined
                    }))}
                    className="w-full px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
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
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={snapshotForm.startDate || ''}
                        min={dateRange?.minDate}
                        max={dateRange?.maxDate}
                        onChange={(e) => setSnapshotForm(prev => ({
                          ...prev,
                          startDate: e.target.value || undefined
                        }))}
                        className="w-full px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={snapshotForm.endDate || ''}
                        min={snapshotForm.startDate || dateRange?.minDate}
                        max={dateRange?.maxDate}
                        onChange={(e) => setSnapshotForm(prev => ({
                          ...prev,
                          endDate: e.target.value || undefined
                        }))}
                        className="w-full px-3 py-2 text-sm bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
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

          {/* Generate Button */}
          <button
            onClick={handleGenerateSnapshot}
            disabled={
              generatingSnapshot ||
              (snapshotForm.type === 'historical' && !snapshotForm.date && (!snapshotForm.startDate || !snapshotForm.endDate)) ||
              (tokenIds.trim() && exactMatch === null) // Disable if token IDs provided but match type not selected
            }
            className="w-full px-4 py-2 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {generatingSnapshot ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
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

      {/* Validation Results */}
      {validationInfo && (
        <div className={`bg-card/20 backdrop-blur-sm border rounded-lg p-4 ${
          validationInfo.isValid ? 'border-green-500/50' : 'border-red-500/50'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              validationInfo.isValid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {validationInfo.isValid ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
            </div>
            <h3 className="text-sm font-semibold">
              Data Validation {validationInfo.isValid ? 'Passed' : 'Issues Found'}
            </h3>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-background/30 rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">Errors</div>
              <div className="text-lg font-bold text-red-400">
                {validationInfo.summary?.totalErrors || 0}
              </div>
            </div>
            <div className="bg-background/30 rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">Warnings</div>
              <div className="text-lg font-bold text-yellow-400">
                {validationInfo.summary?.totalWarnings || 0}
              </div>
            </div>
            <div className="bg-background/30 rounded-lg p-2">
              <div className="text-[10px] text-muted-foreground">Health</div>
              <div className={`text-lg font-bold ${
                validationInfo.summary?.overallHealth === 'GOOD' ? 'text-green-400' :
                validationInfo.summary?.overallHealth === 'FAIR' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {validationInfo.summary?.overallHealth || 'UNKNOWN'}
              </div>
            </div>
          </div>

          {(validationInfo.errors?.length > 0 || validationInfo.warnings?.length > 0) && (
            <div className="space-y-2">
              {validationInfo.errors?.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-400 mb-1 text-xs">Errors:</h4>
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-red-300">
                    {validationInfo.errors.slice(0, 3).map((error: string, index: number) => (
                      <li key={index}>{error}</li>
                    ))}
                    {validationInfo.errors.length > 3 && (
                      <li className="text-muted-foreground">
                        ... and {validationInfo.errors.length - 3} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {validationInfo.warnings?.length > 0 && (
                <div>
                  <h4 className="font-medium text-yellow-400 mb-1 text-xs">Warnings:</h4>
                  <ul className="list-disc list-inside space-y-0.5 text-xs text-yellow-300">
                    {validationInfo.warnings.slice(0, 3).map((warning: string, index: number) => (
                      <li key={index}>{warning}</li>
                    ))}
                    {validationInfo.warnings.length > 3 && (
                      <li className="text-muted-foreground">
                        ... and {validationInfo.warnings.length - 3} more warnings
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Snapshot History */}
      <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Snapshot History</h3>
          <span className="text-xs text-muted-foreground">
            {snapshots.length} {snapshots.length === 1 ? 'snapshot' : 'snapshots'}
          </span>
        </div>

        {loadingSnapshots ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-3 bg-background/50 rounded-lg animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-3 bg-background/50 rounded w-48"></div>
                    <div className="h-2 bg-background/50 rounded w-32"></div>
                  </div>
                  <div className="h-6 bg-background/50 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        ) : snapshots.length > 0 ? (
          <div className="space-y-3">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="p-3 bg-background/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="font-medium text-foreground text-sm">
                        {snapshot.name || `${snapshot.type === 'current' ? 'Current' : 'Historical'} Snapshot`}
                      </h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        snapshot.type === 'current'
                          ? 'bg-green-500/20 text-green-500'
                          : snapshot.type === 'dateRange'
                          ? 'bg-purple-500/20 text-purple-500'
                          : 'bg-blue-500/20 text-blue-500'
                      }`}>
                        {snapshot.type === 'dateRange' ? 'range' : snapshot.type}
                      </span>
                      {snapshot.validationInfo && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          snapshot.validationInfo.isValid
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-yellow-500/20 text-yellow-500'
                        }`}>
                          {snapshot.validationInfo.isValid ? 'validated' : 'issues'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        <span>{snapshot.totalHolders.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-3 h-3" />
                        <span>{snapshot.totalSupply}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>#{snapshot.blockNumber.toLocaleString()}</span>
                      </div>
                      <span>{formatTimeAgo(snapshot.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => validateSnapshot(snapshot)}
                      disabled={validationLoading}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-background/50 border border-border/50 hover:border-primary/50 disabled:opacity-50"
                      title="Validate snapshot data"
                    >
                      {validationLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      onClick={() => window.open(snapshot.downloadUrl, '_blank')}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-background/50 border border-border/50 hover:border-primary/50"
                      title="Download CSV"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Camera className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
            <h4 className="text-sm font-medium text-foreground mb-1">No snapshots yet</h4>
            <p className="text-xs text-muted-foreground">Generate your first snapshot to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}