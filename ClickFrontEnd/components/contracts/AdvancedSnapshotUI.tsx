/**
 * Advanced Snapshot UI Component
 * User-friendly interface for hybrid snapshot system with presets and query builder
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Gift, Target, TrendingUp, Layers, CheckCircle, ListChecks, Crown,
  BarChart3, Medal, Filter, UserPlus, User, Sparkles, Download,
  Settings, ChevronDown, ChevronRight, Loader2, AlertCircle, Info
} from 'lucide-react'
import axios from 'axios'

interface SnapshotPreset {
  id: string
  name: string
  description: string
  category: 'airdrop' | 'whitelist' | 'analysis' | 'marketing' | 'custom'
  icon: string
  recommended: boolean
  requiresTokenInput: boolean
  examples?: string[]
}

interface AdvancedSnapshotUIProps {
  contractAddress: string
}

const ICON_MAP: Record<string, any> = {
  Gift, Target, TrendingUp, Layers, CheckCircle, ListChecks, Crown,
  BarChart3, Medal, Filter, UserPlus, User, Sparkles
}

const CATEGORY_COLORS = {
  airdrop: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
  whitelist: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
  analysis: 'from-green-500/20 to-green-600/20 border-green-500/30',
  marketing: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
  custom: 'from-pink-500/20 to-pink-600/20 border-pink-500/30'
}

export function AdvancedSnapshotUI({ contractAddress }: AdvancedSnapshotUIProps) {
  const [presets, setPresets] = useState<SnapshotPreset[]>([])
  const [selectedPreset, setSelectedPreset] = useState<SnapshotPreset | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string>('')

  // User inputs
  const [tokenIds, setTokenIds] = useState<string>('')
  const [minBalance, setMinBalance] = useState<string>('')
  const [minTokenCount, setMinTokenCount] = useState<string>('')

  // UI state
  const [expandedCategory, setExpandedCategory] = useState<string>('airdrop')
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    fetchPresets()
  }, [])

  const fetchPresets = async () => {
    try {
      const response = await axios.get('/api/snapshot/presets')
      if (response.data.success) {
        setPresets(response.data.data.presets)
      }
    } catch (err) {
      console.error('Failed to load presets:', err)
    }
  }

  const handlePresetSelect = (preset: SnapshotPreset) => {
    setSelectedPreset(preset)
    setResult(null)
    setError('')
  }

  const handleGenerateSnapshot = async () => {
    if (!selectedPreset) return

    setLoading(true)
    setError('')
    setResult(null)

    try {
      // Build query parameters
      const params = new URLSearchParams({
        preset: selectedPreset.id
      })

      if (tokenIds && selectedPreset.requiresTokenInput) {
        params.set('tokenIds', tokenIds)
      }

      if (minBalance) {
        params.set('minBalance', minBalance)
      }

      if (minTokenCount) {
        params.set('minTokenCount', minTokenCount)
      }

      const response = await axios.get(
        `/api/contracts/${contractAddress}/snapshot/advanced?${params.toString()}`
      )

      if (response.data.success) {
        setResult(response.data.data)
      } else {
        setError(response.data.error || 'Failed to generate snapshot')
      }
    } catch (err: any) {
      console.error('Snapshot generation failed:', err)
      setError(err.response?.data?.error || 'Failed to generate snapshot')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCSV = () => {
    if (!result) return

    // Convert to CSV
    const headers = ['Rank', 'Address', 'Total Balance', 'Token Count', 'Percentage']
    const rows = result.holders.map((h: any) => [
      h.rank,
      h.address,
      h.totalBalance,
      h.tokenCount,
      h.percentage?.toFixed(2) + '%'
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row: string[]) => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snapshot-${selectedPreset?.id}-${Date.now()}.csv`
    a.click()
  }

  const groupedPresets = presets.reduce((acc, preset) => {
    if (!acc[preset.category]) {
      acc[preset.category] = []
    }
    acc[preset.category].push(preset)
    return acc
  }, {} as Record<string, SnapshotPreset[]>)

  const categories = [
    { id: 'airdrop', name: 'Airdrop Campaigns', icon: Gift },
    { id: 'whitelist', name: 'Whitelist Generation', icon: CheckCircle },
    { id: 'analysis', name: 'Holder Analysis', icon: BarChart3 },
    { id: 'marketing', name: 'Marketing & Engagement', icon: Target },
    { id: 'custom', name: 'Custom Queries', icon: Settings }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-glass p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">Advanced Snapshot Generator</h2>
            <p className="text-muted-foreground">
              Use pre-configured presets for common use cases or build custom queries
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            <span>{presets.length} presets available</span>
          </div>
        </div>

        {/* Category Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {categories.map(cat => {
            const Icon = cat.icon
            const count = groupedPresets[cat.id]?.length || 0
            const isActive = expandedCategory === cat.id

            return (
              <button
                key={cat.id}
                onClick={() => setExpandedCategory(cat.id)}
                className={`p-3 rounded-lg border transition-all ${
                  isActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 bg-card/50'
                }`}
              >
                <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-xs font-medium">{cat.name}</div>
                <div className="text-xs text-muted-foreground">{count} presets</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Preset Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupedPresets[expandedCategory]?.map(preset => {
          const Icon = ICON_MAP[preset.icon] || Sparkles
          const isSelected = selectedPreset?.id === preset.id
          const colorClass = CATEGORY_COLORS[preset.category]

          return (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset)}
              className={`card-glass p-4 text-left transition-all hover:scale-105 ${
                isSelected ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{preset.name}</h3>
                    {preset.recommended && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                        ⭐ Recommended
                      </span>
                    )}
                  </div>
                  {preset.requiresTokenInput && (
                    <span className="text-xs text-orange-400">Requires token input</span>
                  )}
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-3">
                {preset.description}
              </p>

              {preset.examples && preset.examples.length > 0 && (
                <div className="text-xs text-muted-foreground/70">
                  <div className="font-medium mb-1">Examples:</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {preset.examples.slice(0, 2).map((ex, i) => (
                      <li key={i}>{ex}</li>
                    ))}
                  </ul>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected Preset Configuration */}
      {selectedPreset && (
        <div className="card-glass p-6">
          <h3 className="text-xl font-bold mb-4">
            Configure: {selectedPreset.name}
          </h3>

          <div className="space-y-4">
            {selectedPreset.requiresTokenInput && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Token IDs (required)
                  <span className="text-muted-foreground ml-2">Comma-separated</span>
                </label>
                <input
                  type="text"
                  value={tokenIds}
                  onChange={(e) => setTokenIds(e.target.value)}
                  placeholder="1,5,10,15,20"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Example: &quot;1,5,10&quot; or &quot;2,3,4,5,6,7,8,9,10&quot;
                </p>
              </div>
            )}

            {/* Optional Filters */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Optional Filters
            </button>

            {showAdvanced && (
              <div className="space-y-3 pl-6 border-l-2 border-border">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Minimum Balance
                  </label>
                  <input
                    type="number"
                    value={minBalance}
                    onChange={(e) => setMinBalance(e.target.value)}
                    placeholder="10"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Minimum Token Count
                  </label>
                  <input
                    type="number"
                    value={minTokenCount}
                    onChange={(e) => setMinTokenCount(e.target.value)}
                    placeholder="5"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerateSnapshot}
              disabled={loading || (selectedPreset.requiresTokenInput && !tokenIds)}
              className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Snapshot...
                </>
              ) : (
                <>
                  <Gift className="w-5 h-5" />
                  Generate Snapshot
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="card-glass p-4 border-red-500/50 bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-red-400">Error</div>
              <div className="text-sm text-red-300">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="card-glass p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold mb-1">Snapshot Results</h3>
              <p className="text-sm text-muted-foreground">
                {selectedPreset?.name}
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              className="btn-primary"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-background/50 rounded-lg border border-border">
              <div className="text-2xl font-bold text-primary">
                {result.metadata.totalHolders}
              </div>
              <div className="text-sm text-muted-foreground">Total Holders</div>
            </div>
            <div className="p-4 bg-background/50 rounded-lg border border-border">
              <div className="text-2xl font-bold text-primary">
                {result.metadata.totalSupply}
              </div>
              <div className="text-sm text-muted-foreground">Total Supply</div>
            </div>
            <div className="p-4 bg-background/50 rounded-lg border border-border">
              <div className="text-2xl font-bold text-primary">
                {result.metadata.uniqueTokens}
              </div>
              <div className="text-sm text-muted-foreground">Unique Tokens</div>
            </div>
            <div className="p-4 bg-background/50 rounded-lg border border-border">
              <div className="text-sm text-muted-foreground mb-1">Data Source</div>
              <div className="text-xs font-mono text-primary">
                {result.metadata.dataSource}
              </div>
            </div>
          </div>

          {/* Holders Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Rank</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Address</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Balance</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Tokens</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {result.holders.slice(0, 50).map((holder: any) => (
                  <tr key={holder.address} className="border-b border-border/50 hover:bg-background/50">
                    <td className="py-3 px-4 text-sm">#{holder.rank}</td>
                    <td className="py-3 px-4">
                      <code className="text-xs bg-background px-2 py-1 rounded">
                        {holder.address}
                      </code>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {holder.totalBalance}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-muted-foreground">
                      {holder.tokenCount}
                    </td>
                    <td className="py-3 px-4 text-right text-sm text-muted-foreground">
                      {holder.percentage?.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {result.holders.length > 50 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Showing top 50 of {result.holders.length} holders. Export to CSV for full list.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
