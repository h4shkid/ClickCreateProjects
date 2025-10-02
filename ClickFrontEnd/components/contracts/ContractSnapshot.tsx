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
        
        response = await axios.get(`/api/contracts/${contractAddress}/snapshot/historical`, {
          params,
          timeout: 30000 // 30 second timeout
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
      <div className="space-y-6">
        <div className="bg-card/20 rounded-lg p-6 animate-pulse">
          <div className="h-6 bg-background/50 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-background/50 rounded"></div>
            <div className="h-4 bg-background/50 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Snapshot Generator */}
      <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
            <Camera className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Generate Snapshot</h2>
            <p className="text-sm text-muted-foreground">Create a holder snapshot for this contract</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Snapshot Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Snapshot Type
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSnapshotForm(prev => ({ ...prev, type: 'current' }))}
                className={`p-4 border border-border rounded-lg text-left transition-all ${
                  snapshotForm.type === 'current'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:border-primary/40 text-foreground'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Current Snapshot</span>
                </div>
                <p className="text-sm opacity-80">
                  Snapshot of current state at latest block
                </p>
              </button>

              <button
                onClick={() => setSnapshotForm(prev => ({ ...prev, type: 'historical' }))}
                className={`p-4 border border-border rounded-lg text-left transition-all ${
                  snapshotForm.type === 'historical'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'hover:border-primary/40 text-foreground'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5" />
                  <span className="font-medium">Historical Snapshot</span>
                </div>
                <p className="text-sm opacity-80">
                  Snapshot at a specific date
                </p>
              </button>
            </div>
          </div>

          {/* Historical Date Options */}
          {snapshotForm.type === 'historical' && (
            <div className="space-y-4">
              {/* Date Range Toggle */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
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
                  <span className="text-sm font-medium">Single Date</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
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
                  <span className="text-sm font-medium">Date Range Comparison</span>
                </label>
              </div>

              {/* Single Date Input */}
              {dateMode === 'single' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
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
                    className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Select a date to generate a historical snapshot. The system will find the closest blockchain block.
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
                    <label className="block text-sm font-medium text-foreground mb-2">
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
                      className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
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
                      className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
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

          {/* Snapshot Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Snapshot Name (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Q4 2024 Holders"
              value={snapshotForm.name}
              onChange={(e) => setSnapshotForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Description (Optional)
            </label>
            <textarea
              placeholder="Add notes about this snapshot..."
              value={snapshotForm.description}
              onChange={(e) => setSnapshotForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-background/50 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50"
              rows={3}
            />
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateSnapshot}
            disabled={generatingSnapshot || (snapshotForm.type === 'historical' && !snapshotForm.date && (!snapshotForm.startDate || !snapshotForm.endDate))}
            className="w-full px-6 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg transition-all duration-300 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {generatingSnapshot ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Snapshot...
              </>
            ) : (
              <>
                <Camera className="w-5 h-5" />
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
        <div className={`bg-card/20 backdrop-blur-sm border rounded-lg p-6 ${
          validationInfo.isValid ? 'border-green-500/50' : 'border-red-500/50'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              validationInfo.isValid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {validationInfo.isValid ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
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
                  <h4 className="font-medium text-yellow-400 mb-2">Warnings:</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-yellow-300">
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
      <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Snapshot History</h3>
          <span className="text-sm text-muted-foreground">
            {snapshots.length} {snapshots.length === 1 ? 'snapshot' : 'snapshots'}
          </span>
        </div>

        {loadingSnapshots ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 bg-background/50 rounded-lg animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-background/50 rounded w-48"></div>
                    <div className="h-3 bg-background/50 rounded w-32"></div>
                  </div>
                  <div className="h-8 bg-background/50 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : snapshots.length > 0 ? (
          <div className="space-y-4">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="p-4 bg-background/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-foreground">
                        {snapshot.name || `${snapshot.type === 'current' ? 'Current' : 'Historical'} Snapshot`}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        snapshot.type === 'current' 
                          ? 'bg-green-500/20 text-green-500' 
                          : snapshot.type === 'dateRange'
                          ? 'bg-purple-500/20 text-purple-500'
                          : 'bg-blue-500/20 text-blue-500'
                      }`}>
                        {snapshot.type === 'dateRange' ? 'range' : snapshot.type}
                      </span>
                      {snapshot.validationInfo && (
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          snapshot.validationInfo.isValid 
                            ? 'bg-green-500/20 text-green-500' 
                            : 'bg-yellow-500/20 text-yellow-500'
                        }`}>
                          {snapshot.validationInfo.isValid ? 'validated' : 'issues'}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{snapshot.totalHolders.toLocaleString()} holders</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" />
                        <span>{snapshot.totalSupply} supply</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>Block {snapshot.blockNumber.toLocaleString()}</span>
                      </div>
                      <span>{formatTimeAgo(snapshot.createdAt)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => validateSnapshot(snapshot)}
                      disabled={validationLoading}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 border border-border/50 hover:border-primary/50 disabled:opacity-50"
                      title="Validate snapshot data"
                    >
                      {validationLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button 
                      onClick={() => window.open(snapshot.downloadUrl, '_blank')}
                      className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 border border-border/50 hover:border-primary/50"
                      title="Download CSV"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Camera className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No snapshots yet</h4>
            <p className="text-muted-foreground">Generate your first snapshot to get started</p>
          </div>
        )}
      </div>
    </div>
  )
}