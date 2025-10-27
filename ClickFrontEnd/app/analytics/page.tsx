'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart, ComposedChart } from 'recharts'
import { TrendingUp, Users, Activity, Package, RefreshCw, ArrowUp, ArrowDown, Layers, Zap, Award, TrendingDown } from 'lucide-react'
import axios from 'axios'
import Link from 'next/link'

// Type definitions
interface PlatformAnalytics {
  overview: {
    totalContracts: number
    erc721Count: number
    erc1155Count: number
    verifiedCount: number
    totalHolders: number
    totalTransfers: number
    transfers24h: number
    transfers7d: number
    transfers30d: number
    activeContracts24h: number
  }
  erc721: {
    contracts: number
    holders: number
    tokens: number
    transfers: number
    topContracts: ContractMetric[]
  }
  erc1155: {
    contracts: number
    holders: number
    tokens: number
    transfers: number
    topContracts: ContractMetric[]
  }
  timeSeries: TimeSeriesData[]
  distribution: {
    contractTypes: { type: string; count: number; percentage: number }[]
    holderSizes: { range: string; count: number }[]
  }
  topPerformers: {
    byHolders: ContractMetric[]
    byActivity: ContractMetric[]
    byGrowth: ContractMetric[]
  }
}

interface ContractMetric {
  address: string
  name: string
  symbol: string
  contractType: 'ERC721' | 'ERC1155'
  holders: number
  transfers: number
  totalSupply: string
  growth?: number
}

interface TimeSeriesData {
  date: string
  erc721Transfers: number
  erc1155Transfers: number
  totalTransfers: number
  uniqueTraders: number
}

const COLORS = {
  primary: '#FF6B35',
  accent: '#FFA500',
  erc721: '#FF6B35',
  erc1155: '#00D9FF',
  gradient: ['#FF6B35', '#FFA500', '#FF8C42', '#CC5528', '#FF5500']
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PlatformAnalytics | null>(null)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d')
  const [activeTab, setActiveTab] = useState<'overview' | 'erc721' | 'erc1155' | 'comparison'>('overview')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const fetchAnalytics = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await axios.get('/api/analytics/platform', {
        params: { timeRange }
      })

      if (res.data.success && res.data.data) {
        setData(res.data.data)
      } else {
        throw new Error('No data received')
      }
    } catch (err: any) {
      console.error('Analytics error:', err)
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-center h-96">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <TrendingDown className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-2xl font-bold text-foreground">Unable to load analytics</h2>
            <p className="text-muted-foreground">{error || 'Please try again later'}</p>
            <button onClick={fetchAnalytics} className="btn-primary mt-4">
              Try Again
            </button>
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
            Platform <span className="gradient-text">Analytics</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Comprehensive insights across all tracked NFT contracts
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-6">
          {(['24h', '7d', '30d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                timeRange === range
                  ? 'bg-primary text-background'
                  : 'bg-card border border-border hover:border-primary/50'
              }`}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </button>
          ))}
          <button
            onClick={fetchAnalytics}
            className="ml-auto btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 border-b border-border">
          {[
            { id: 'overview', label: 'Platform Overview', icon: Activity },
            { id: 'erc721', label: 'ERC-721 Analytics', icon: Package },
            { id: 'erc1155', label: 'ERC-1155 Analytics', icon: Layers },
            { id: 'comparison', label: 'Contract Comparison', icon: TrendingUp }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all border-b-2 ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && <PlatformOverviewTab data={data} />}
        {activeTab === 'erc721' && <ERC721Tab data={data} />}
        {activeTab === 'erc1155' && <ERC1155Tab data={data} />}
        {activeTab === 'comparison' && <ComparisonTab data={data} />}
      </div>
    </div>
  )
}

// PLATFORM OVERVIEW TAB
function PlatformOverviewTab({ data }: { data: PlatformAnalytics }) {
  return (
    <div className="space-y-8">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Contracts"
          value={data.overview.totalContracts}
          subtitle={`${data.overview.erc721Count} ERC-721 • ${data.overview.erc1155Count} ERC-1155`}
          icon={Package}
          trend={null}
        />
        <StatCard
          title="Unique Holders"
          value={data.overview.totalHolders}
          subtitle="Across all contracts"
          icon={Users}
          trend={null}
        />
        <StatCard
          title="Total Transfers"
          value={data.overview.totalTransfers}
          subtitle={`${data.overview.transfers24h} in last 24h`}
          icon={Activity}
          trend={null}
        />
        <StatCard
          title="Active Contracts"
          value={data.overview.activeContracts24h}
          subtitle="Active in last 24h"
          icon={Zap}
          trend={null}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Transfer Activity Timeline */}
        <div className="card-glass">
          <h2 className="text-xl font-semibold mb-6">Transfer Activity</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.timeSeries}>
              <defs>
                <linearGradient id="colorERC721" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.erc721} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.erc721} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorERC1155" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.erc1155} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.erc1155} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
              <XAxis dataKey="date" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '8px' }}
                labelStyle={{ color: '#FAFAFA' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="erc721Transfers"
                name="ERC-721"
                stroke={COLORS.erc721}
                fillOpacity={1}
                fill="url(#colorERC721)"
              />
              <Area
                type="monotone"
                dataKey="erc1155Transfers"
                name="ERC-1155"
                stroke={COLORS.erc1155}
                fillOpacity={1}
                fill="url(#colorERC1155)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Contract Type Distribution */}
        <div className="card-glass">
          <h2 className="text-xl font-semibold mb-6">Contract Type Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.distribution.contractTypes}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.type}: ${entry.percentage}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="percentage"
              >
                {data.distribution.contractTypes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.erc721 : COLORS.erc1155} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '8px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Contracts by Holders */}
      <div className="card-glass">
        <h2 className="text-xl font-semibold mb-6">Top Contracts by Holders</h2>
        <div className="space-y-3">
          {data.topPerformers.byHolders.map((contract, index) => (
            <ContractRow key={contract.address} contract={contract} rank={index + 1} />
          ))}
        </div>
      </div>

      {/* Most Active Contracts */}
      <div className="card-glass">
        <h2 className="text-xl font-semibold mb-6">Most Active Contracts</h2>
        <div className="space-y-3">
          {data.topPerformers.byActivity.map((contract, index) => (
            <ContractRow key={contract.address} contract={contract} rank={index + 1} showTransfers />
          ))}
        </div>
      </div>

      {/* Holder Size Distribution */}
      <div className="card-glass">
        <h2 className="text-xl font-semibold mb-6">Contract Size Distribution</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.distribution.holderSizes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="range" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '8px' }}
            />
            <Bar dataKey="count" fill={COLORS.primary} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ERC721 TAB
function ERC721Tab({ data }: { data: PlatformAnalytics }) {
  return (
    <div className="space-y-8">
      {/* ERC721 Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="ERC-721 Contracts"
          value={data.erc721.contracts}
          subtitle={`${Math.round((data.erc721.contracts / data.overview.totalContracts) * 100)}% of total`}
          icon={Package}
          trend={null}
        />
        <StatCard
          title="Unique Holders"
          value={data.erc721.holders}
          subtitle="Across all ERC-721s"
          icon={Users}
          trend={null}
        />
        <StatCard
          title="Unique Tokens"
          value={data.erc721.tokens}
          subtitle="Total NFTs minted"
          icon={Award}
          trend={null}
        />
        <StatCard
          title="Total Transfers"
          value={data.erc721.transfers}
          subtitle="All-time transfers"
          icon={Activity}
          trend={null}
        />
      </div>

      {/* Top ERC721 Contracts */}
      <div className="card-glass">
        <h2 className="text-xl font-semibold mb-6">Top ERC-721 Contracts</h2>
        <div className="space-y-3">
          {data.erc721.topContracts.map((contract, index) => (
            <ContractRow key={contract.address} contract={contract} rank={index + 1} />
          ))}
          {data.erc721.topContracts.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No ERC-721 contracts tracked yet</p>
          )}
        </div>
      </div>

      {/* ERC721 Activity Chart */}
      <div className="card-glass">
        <h2 className="text-xl font-semibold mb-6">ERC-721 Transfer Activity</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data.timeSeries}>
            <defs>
              <linearGradient id="colorERC721Only" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.erc721} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.erc721} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="date" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '8px' }}
            />
            <Area
              type="monotone"
              dataKey="erc721Transfers"
              name="Transfers"
              stroke={COLORS.erc721}
              fillOpacity={1}
              fill="url(#colorERC721Only)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ERC1155 TAB
function ERC1155Tab({ data }: { data: PlatformAnalytics }) {
  return (
    <div className="space-y-8">
      {/* ERC1155 Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="ERC-1155 Contracts"
          value={data.erc1155.contracts}
          subtitle={`${Math.round((data.erc1155.contracts / data.overview.totalContracts) * 100)}% of total`}
          icon={Layers}
          trend={null}
        />
        <StatCard
          title="Unique Holders"
          value={data.erc1155.holders}
          subtitle="Across all ERC-1155s"
          icon={Users}
          trend={null}
        />
        <StatCard
          title="Unique Tokens"
          value={data.erc1155.tokens}
          subtitle="Total token IDs"
          icon={Award}
          trend={null}
        />
        <StatCard
          title="Total Transfers"
          value={data.erc1155.transfers}
          subtitle="All-time transfers"
          icon={Activity}
          trend={null}
        />
      </div>

      {/* Top ERC1155 Contracts */}
      <div className="card-glass">
        <h2 className="text-xl font-semibold mb-6">Top ERC-1155 Contracts</h2>
        <div className="space-y-3">
          {data.erc1155.topContracts.map((contract, index) => (
            <ContractRow key={contract.address} contract={contract} rank={index + 1} />
          ))}
          {data.erc1155.topContracts.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No ERC-1155 contracts tracked yet</p>
          )}
        </div>
      </div>

      {/* ERC1155 Activity Chart */}
      <div className="card-glass">
        <h2 className="text-xl font-semibold mb-6">ERC-1155 Transfer Activity</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data.timeSeries}>
            <defs>
              <linearGradient id="colorERC1155Only" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.erc1155} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.erc1155} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="date" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '8px' }}
            />
            <Area
              type="monotone"
              dataKey="erc1155Transfers"
              name="Transfers"
              stroke={COLORS.erc1155}
              fillOpacity={1}
              fill="url(#colorERC1155Only)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// COMPARISON TAB
function ComparisonTab({ data }: { data: PlatformAnalytics }) {
  const comparisonData = [
    {
      metric: 'Contracts',
      'ERC-721': data.erc721.contracts,
      'ERC-1155': data.erc1155.contracts
    },
    {
      metric: 'Holders',
      'ERC-721': data.erc721.holders,
      'ERC-1155': data.erc1155.holders
    },
    {
      metric: 'Tokens',
      'ERC-721': data.erc721.tokens,
      'ERC-1155': data.erc1155.tokens
    },
    {
      metric: 'Transfers',
      'ERC-721': data.erc721.transfers,
      'ERC-1155': data.erc1155.transfers
    }
  ]

  return (
    <div className="space-y-8">
      {/* Comparison Chart */}
      <div className="card-glass">
        <h2 className="text-xl font-semibold mb-6">ERC-721 vs ERC-1155 Comparison</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={comparisonData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="metric" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '8px' }}
            />
            <Legend />
            <Bar dataKey="ERC-721" fill={COLORS.erc721} />
            <Bar dataKey="ERC-1155" fill={COLORS.erc1155} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="card-glass">
          <h2 className="text-xl font-semibold mb-6 text-[#FF6B35]">ERC-721 Summary</h2>
          <div className="space-y-4">
            <MetricRow label="Contracts" value={data.erc721.contracts} />
            <MetricRow label="Unique Holders" value={data.erc721.holders} />
            <MetricRow label="Unique Tokens" value={data.erc721.tokens} />
            <MetricRow label="Total Transfers" value={data.erc721.transfers} />
            <MetricRow
              label="Avg Holders/Contract"
              value={data.erc721.contracts > 0 ? Math.round(data.erc721.holders / data.erc721.contracts) : 0}
            />
          </div>
        </div>

        <div className="card-glass">
          <h2 className="text-xl font-semibold mb-6 text-[#00D9FF]">ERC-1155 Summary</h2>
          <div className="space-y-4">
            <MetricRow label="Contracts" value={data.erc1155.contracts} />
            <MetricRow label="Unique Holders" value={data.erc1155.holders} />
            <MetricRow label="Unique Tokens" value={data.erc1155.tokens} />
            <MetricRow label="Total Transfers" value={data.erc1155.transfers} />
            <MetricRow
              label="Avg Holders/Contract"
              value={data.erc1155.contracts > 0 ? Math.round(data.erc1155.holders / data.erc1155.contracts) : 0}
            />
          </div>
        </div>
      </div>

      {/* Activity Timeline Comparison */}
      <div className="card-glass">
        <h2 className="text-xl font-semibold mb-6">Activity Timeline Comparison</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.timeSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
            <XAxis dataKey="date" stroke="#9CA3AF" />
            <YAxis stroke="#9CA3AF" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '8px' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="erc721Transfers"
              name="ERC-721 Transfers"
              stroke={COLORS.erc721}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="erc1155Transfers"
              name="ERC-1155 Transfers"
              stroke={COLORS.erc1155}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// HELPER COMPONENTS
function StatCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string
  value: number
  subtitle: string
  icon: any
  trend: { value: number; isPositive: boolean } | null
}) {
  return (
    <div className="card-glass">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold">{value.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          {trend && (
            <p className={`text-xs flex items-center mt-1 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {trend.isPositive ? <ArrowUp className="w-3 h-3 mr-1" /> : <ArrowDown className="w-3 h-3 mr-1" />}
              {trend.value}%
            </p>
          )}
        </div>
        <Icon className="w-8 h-8 text-primary opacity-50" />
      </div>
    </div>
  )
}

function ContractRow({ contract, rank, showTransfers = false }: {
  contract: ContractMetric
  rank: number
  showTransfers?: boolean
}) {
  return (
    <Link
      href={`/contracts/${contract.address}`}
      className="flex items-center gap-4 p-4 bg-card/50 hover:bg-card border border-border rounded-lg transition-all hover:border-primary/50"
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
        #{rank}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{contract.name}</h3>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            contract.contractType === 'ERC721'
              ? 'bg-[#FF6B35]/20 text-[#FF6B35]'
              : 'bg-[#00D9FF]/20 text-[#00D9FF]'
          }`}>
            {contract.contractType}
          </span>
        </div>
        <p className="text-sm text-muted-foreground font-mono">{contract.address.slice(0, 10)}...{contract.address.slice(-8)}</p>
      </div>
      <div className="text-right">
        <p className="font-bold">{contract.holders.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">holders</p>
      </div>
      {showTransfers && (
        <div className="text-right">
          <p className="font-bold">{contract.transfers.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">transfers</p>
        </div>
      )}
    </Link>
  )
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value.toLocaleString()}</span>
    </div>
  )
}
