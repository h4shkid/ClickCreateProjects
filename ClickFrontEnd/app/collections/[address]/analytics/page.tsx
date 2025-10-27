'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts'
import { TrendingUp, Users, Activity, Package, RefreshCw, ArrowUp, ArrowDown, ArrowLeft, Layers, Award, TrendingDown, ExternalLink } from 'lucide-react'
import axios from 'axios'

// Type definitions
interface ContractAnalytics {
  contract: {
    address: string
    name: string
    symbol: string
    contractType: 'ERC721' | 'ERC1155'
    isVerified: boolean
  }
  overview: {
    totalHolders: number
    uniqueTokens: number
    totalSupply: string
    avgHoldingPerUser: string
  }
  events: {
    totalTransfers: number
    last24hTransfers: number
    uniqueSenders: number
    uniqueReceivers: number
    firstBlock: number
    lastBlock: number
  }
  distribution: Array<{ range: string; holders: number; total_balance: number }>
  topHolders: Array<{
    address: string
    balance: string
    tokenCount: number
    percentage: string | number
  }>
  tokenActivity: Array<{
    token_id: string
    holders: number
    total_supply: string
    max_holding: string
  }>
  timeSeries: Array<{
    blockRange?: number
    minBlock?: number
    maxBlock?: number
    date?: string
    events: number
    uniqueFrom?: number
    uniqueTo?: number
    unique_from?: number
    unique_to?: number
  }>
  growth: {
    newHolders24h: number
    newHolders7d: number
    volumeChange24h: number
    activeAddresses24h: number
  }
  advanced?: {
    giniCoefficient: number
    whaleConcentration: number
    volume24h: string
    volume7d: string
    volume30d: string
  }
}

const COLORS = {
  primary: '#FF6B35',
  accent: '#FFA500',
  erc721: '#FF6B35',
  erc1155: '#00D9FF',
  // More distinct colors for pie chart - better contrast between slices
  gradient: ['#FF6B35', '#FFA500', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']
}

export default function CollectionAnalyticsPage() {
  const params = useParams()
  const address = params?.address as string

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ContractAnalytics | null>(null)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (address) {
      fetchAnalytics()
    }
  }, [address, timeRange])

  const fetchAnalytics = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await axios.get(`/api/contracts/${address}/analytics/summary`, {
        params: { timeRange }
      })

      if (res.data.success && res.data.analytics) {
        setData(res.data.analytics)
      } else {
        throw new Error('No analytics data received')
      }
    } catch (err: any) {
      console.error('Analytics error:', err)
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number | string | undefined) => {
    if (num === undefined || num === null) return '0'
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (isNaN(n)) return '0'
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
    return n.toLocaleString()
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
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

  const isERC721 = data.contract.contractType === 'ERC721'

  // Process distribution data for charts
  const distributionData = (data.distribution || []).map((d) => ({
    range: d.range,
    holders: d.holders,
    percentage: data.overview.totalHolders > 0
      ? Math.round((d.holders / data.overview.totalHolders) * 100)
      : 0
  }))

  // Process time series for charts
  const timeSeriesData = (data.timeSeries || []).map((ts) => {
    // Handle both old date format and new block range format
    let displayDate = 'Unknown';

    if (ts.date) {
      // Old format with actual dates
      displayDate = new Date(ts.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (ts.blockRange !== undefined) {
      // New format with block ranges - show block number ranges
      const blockRange = ts.blockRange || 0;
      displayDate = `Block ${(blockRange / 1000000).toFixed(1)}M`;
    }

    return {
      date: displayDate,
      transfers: ts.events || 0,
      traders: (ts.uniqueFrom || ts.unique_from || 0) + (ts.uniqueTo || ts.unique_to || 0)
    };
  }).reverse()

  return (
    <div className="min-h-screen pt-24 px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl">
        {/* Back Button & Header */}
        <div className="mb-8">
          <Link
            href={`/collections/${address}`}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Collection
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="gradient-text">Analytics</span>
              </h1>
              <div className="flex items-center gap-3">
                <h2 className="text-xl text-muted-foreground">{data.contract.name}</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  isERC721
                    ? 'bg-[#FF6B35]/20 text-[#FF6B35]'
                    : 'bg-[#00D9FF]/20 text-[#00D9FF]'
                }`}>
                  {data.contract.contractType}
                </span>
              </div>
            </div>
            <a
              href={`https://etherscan.io/address/${data.contract.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border hover:border-primary/50 rounded-lg transition-colors text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Etherscan
            </a>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-8">
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

        {/* Main Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Holders"
            value={data.overview.totalHolders}
            subtitle="Unique wallet addresses"
            icon={Users}
            trend={{
              value: data.growth.newHolders7d,
              label: `+${data.growth.newHolders7d} this week`
            }}
          />
          <StatCard
            title={isERC721 ? "Total NFTs" : "Unique Tokens"}
            value={data.overview.uniqueTokens}
            subtitle={isERC721 ? "Minted items" : "Token IDs"}
            icon={isERC721 ? Package : Layers}
            trend={null}
          />
          <StatCard
            title="Total Transfers"
            value={data.events.totalTransfers}
            subtitle={`${data.events.last24hTransfers} in last 24h`}
            icon={Activity}
            trend={{
              value: data.events.last24hTransfers,
              label: '24h activity'
            }}
          />
          <StatCard
            title="Total Supply"
            value={formatNumber(data.overview.totalSupply)}
            subtitle="Total circulating"
            icon={TrendingUp}
            trend={null}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Transfer Activity Timeline */}
          <div className="card-glass">
            <h2 className="text-xl font-semibold mb-6">Transfer Activity</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData}>
                <defs>
                  <linearGradient id="colorTransfers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '8px' }}
                  labelStyle={{ color: '#FAFAFA' }}
                />
                <Area
                  type="monotone"
                  dataKey="transfers"
                  name="Transfers"
                  stroke={COLORS.primary}
                  fillOpacity={1}
                  fill="url(#colorTransfers)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Holder Distribution Pie Chart */}
          <div className="card-glass">
            <h2 className="text-xl font-semibold mb-6">Holder Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => {
                    // Only show label for slices > 10% to avoid overlap
                    return entry.percentage > 10 ? `${entry.range}: ${entry.percentage}%` : ''
                  }}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="percentage"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.gradient[index % COLORS.gradient.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1A1A',
                    border: '1px solid #2A2A2A',
                    borderRadius: '8px',
                    color: '#FAFAFA'
                  }}
                  itemStyle={{ color: '#FAFAFA' }}
                  labelStyle={{ color: '#FAFAFA' }}
                  formatter={(value: any, name: any, props: any) => {
                    if (!props || !props.payload) return ['', ''];
                    const holders = props.payload.holders || 0;
                    const range = props.payload.range || '';
                    return [
                      `${holders.toLocaleString()} holders (${value || 0}%)`,
                      `${range} NFT${range === '1' ? '' : 's'}`
                    ];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value, entry: any) => `${entry.payload.range} NFT${entry.payload.range === '1' ? '' : 's'}: ${entry.payload.percentage}%`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Holders Table */}
        <div className="card-glass mb-8">
          <h2 className="text-xl font-semibold mb-6">Top Holders</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Rank</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Address</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Balance</th>
                  {!isERC721 && (
                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Tokens</th>
                  )}
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Share</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">View</th>
                </tr>
              </thead>
              <tbody>
                {data.topHolders.map((holder, index) => (
                  <tr key={holder.address} className="border-b border-border/50 hover:bg-card/20 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                        #{index + 1}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">{formatAddress(holder.address)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">
                      {formatNumber(holder.balance)}
                    </td>
                    {!isERC721 && (
                      <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                        {holder.tokenCount}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-right">
                      <span className="text-primary font-semibold">
                        {typeof holder.percentage === 'number'
                          ? holder.percentage.toFixed(2)
                          : holder.percentage}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <a
                        href={`https://etherscan.io/address/${holder.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Token Activity (ERC1155 only) */}
        {!isERC721 && data.tokenActivity && data.tokenActivity.length > 0 && (
          <div className="card-glass mb-8">
            <h2 className="text-xl font-semibold mb-6">Most Popular Token IDs</h2>
            <div className="space-y-3">
              {data.tokenActivity.map((token, index) => (
                <div
                  key={token.token_id}
                  className="flex items-center gap-4 p-4 bg-card/50 border border-border rounded-lg"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                    #{index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">Token ID #{token.token_id}</div>
                    <div className="text-sm text-muted-foreground">
                      {token.holders} holders • Supply: {formatNumber(token.total_supply)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Max Holding</div>
                    <div className="font-bold">{formatNumber(token.max_holding)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Stats Row */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Unique Addresses */}
          <div className="card-glass">
            <h3 className="text-lg font-semibold mb-4">Unique Addresses</h3>
            <div className="space-y-4">
              <MetricRow label="Total Holders" value={data.overview.totalHolders} />
              <MetricRow label="Unique Senders" value={data.events.uniqueSenders} />
              <MetricRow label="Unique Receivers" value={data.events.uniqueReceivers} />
              <MetricRow label="Active (24h)" value={data.growth.activeAddresses24h} />
            </div>
          </div>

          {/* Supply Statistics */}
          <div className="card-glass">
            <h3 className="text-lg font-semibold mb-4">Supply Statistics</h3>
            <div className="space-y-4">
              <MetricRow label="Total Supply" value={formatNumber(data.overview.totalSupply)} />
              <MetricRow label="Unique Tokens" value={data.overview.uniqueTokens} />
              <MetricRow label="Avg per Holder" value={parseFloat(data.overview.avgHoldingPerUser).toFixed(2)} />
              <MetricRow label="Holders" value={data.overview.totalHolders} />
            </div>
          </div>

          {/* Transfer Statistics */}
          <div className="card-glass">
            <h3 className="text-lg font-semibold mb-4">Transfer Statistics</h3>
            <div className="space-y-4">
              <MetricRow label="Total Transfers" value={data.events.totalTransfers} />
              <MetricRow label="24h Transfers" value={data.events.last24hTransfers} />
              <MetricRow label="First Block" value={data.events.firstBlock} />
              <MetricRow label="Latest Block" value={data.events.lastBlock} />
            </div>
          </div>
        </div>

        {/* Advanced Analytics (if available) */}
        {data.advanced && (
          <div className="card-glass mt-8">
            <h2 className="text-xl font-semibold mb-6">Advanced Metrics</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Gini Coefficient</p>
                <p className="text-3xl font-bold gradient-text">
                  {data.advanced.giniCoefficient?.toFixed(3) || 'N/A'}
                </p>
                <div className="mt-2 w-full bg-card rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-primary to-accent h-2 rounded-full"
                    style={{ width: `${(data.advanced.giniCoefficient || 0) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Wealth distribution inequality</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Whale Concentration</p>
                <p className="text-3xl font-bold gradient-text">
                  {data.advanced.whaleConcentration?.toFixed(1) || '0'}%
                </p>
                <p className="text-xs text-muted-foreground mt-2">Top 10 holders&apos; share</p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">24h Volume</p>
                <p className="text-3xl font-bold gradient-text">
                  {formatNumber(data.advanced.volume24h)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">Trading volume</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// HELPER COMPONENTS
function StatCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string
  value: number | string
  subtitle: string
  icon: any
  trend: { value: number; label: string } | null
}) {
  return (
    <div className="card-glass">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          {trend && trend.value > 0 && (
            <p className="text-xs flex items-center mt-1 text-green-500">
              <ArrowUp className="w-3 h-3 mr-1" />
              {trend.label}
            </p>
          )}
        </div>
        <Icon className="w-8 h-8 text-primary opacity-50" />
      </div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  )
}
