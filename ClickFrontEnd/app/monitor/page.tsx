'use client'

import { useState, useEffect, useRef } from 'react'
import { Activity, Zap, Users, ArrowUpRight, ArrowDownRight, Wifi, WifiOff, RefreshCw, Play, Pause } from 'lucide-react'
import axios from 'axios'

interface Transfer {
  id: string
  from: string
  to: string
  tokenId: string
  amount: string
  timestamp: string
  blockNumber: number
  txHash: string
  type: 'mint' | 'burn' | 'transfer'
}

interface WebSocketStatus {
  connected: boolean
  reconnectAttempts: number
  lastHeartbeat: Date | null
}

export default function MonitorPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [wsStatus, setWsStatus] = useState<WebSocketStatus>({
    connected: false,
    reconnectAttempts: 0,
    lastHeartbeat: null
  })
  const [paused, setPaused] = useState(false)
  const [stats, setStats] = useState({
    totalTransfers: 0,
    activeAddresses: 0,
    volume24h: '0',
    avgBlockTime: 12
  })
  const [filter, setFilter] = useState<'all' | 'mint' | 'burn' | 'transfer'>('all')
  const ws = useRef<WebSocket | null>(null)
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null)

  // Fetch real events from database
  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/events/recent', {
        params: { limit: 50 }
      })
      
      if (response.data.success) {
        const events = response.data.data.events.map((e: any) => {
          let type: 'mint' | 'burn' | 'transfer' = 'transfer'
          if (e.from === '0x0000000000000000000000000000000000000000') type = 'mint'
          if (e.to === '0x0000000000000000000000000000000000000000') type = 'burn'
          
          return {
            id: e.id,
            from: e.from,
            to: e.to,
            tokenId: e.tokenId,
            amount: e.amount,
            timestamp: new Date(e.timestamp * 1000).toISOString(),
            blockNumber: e.blockNumber,
            txHash: e.transactionHash,
            type
          }
        })
        
        setTransfers(events)
        setStats({
          totalTransfers: response.data.data.stats.totalEvents || 0,
          activeAddresses: response.data.data.stats.activeAddresses || 0,
          volume24h: events.reduce((sum: number, e: Transfer) => sum + parseInt(e.amount || '1'), 0).toString(),
          avgBlockTime: 12
        })
      }
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchEvents()
    
    // Polling for new events (every 10 seconds)
    const interval = setInterval(() => {
      if (!paused) {
        fetchEvents()
      }
    }, 10000)
    
    return () => clearInterval(interval)
  }, [paused])

  useEffect(() => {
    // Simulate WebSocket connection status
    const connectWebSocket = () => {
      try {
        // For now, just show as connected since we're polling
        setWsStatus(prev => ({ ...prev, connected: true, reconnectAttempts: 0 }))
      } catch (error) {
        console.error('Connection error:', error)
        handleReconnect()
      }
    }

    const handleReconnect = () => {
      setWsStatus(prev => ({
        ...prev,
        connected: false,
        reconnectAttempts: prev.reconnectAttempts + 1
      }))
      
      const delay = Math.min(1000 * Math.pow(2, wsStatus.reconnectAttempts), 30000)
      reconnectTimeout.current = setTimeout(connectWebSocket, delay)
    }

    connectWebSocket()

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current)
      }
      if (ws.current) {
        ws.current.close()
      }
    }
  }, [paused])

  // Refresh data manually
  const handleRefresh = () => {
    setTransfers([])
    fetchEvents()
  }

  const filteredTransfers = transfers.filter(t => filter === 'all' || t.type === filter)

  const getTransferIcon = (type: string) => {
    switch (type) {
      case 'mint':
        return <ArrowDownRight className="w-4 h-4 text-green-500" />
      case 'burn':
        return <ArrowUpRight className="w-4 h-4 text-red-500" />
      default:
        return <ArrowUpRight className="w-4 h-4 text-primary" />
    }
  }

  const formatAddress = (address: string) => {
    if (address === '0x0000000000000000000000000000000000000000') {
      return 'Null Address'
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="min-h-screen pt-24 px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Real-time <span className="gradient-text">Monitoring</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Track transfers and holder changes as they happen
          </p>
        </div>

        {/* Connection Status */}
        <div className="card-glass mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {wsStatus.connected ? (
                  <>
                    <Wifi className="w-5 h-5 text-green-500" />
                    <span className="text-green-500 font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-5 h-5 text-red-500" />
                    <span className="text-red-500 font-medium">Disconnected</span>
                  </>
                )}
              </div>
              {wsStatus.reconnectAttempts > 0 && !wsStatus.connected && (
                <span className="text-sm text-muted-foreground">
                  Reconnecting... (Attempt {wsStatus.reconnectAttempts})
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setPaused(!paused)}
                className="btn-secondary flex items-center gap-2"
              >
                {paused ? (
                  <>
                    <Play className="w-4 h-4" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4" />
                    Pause
                  </>
                )}
              </button>
              <button
                onClick={handleRefresh}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card-glass">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Transfers</p>
                <p className="text-2xl font-bold">{stats.totalTransfers}</p>
              </div>
              <Activity className="w-8 h-8 text-primary opacity-50" />
            </div>
          </div>
          
          <div className="card-glass">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Addresses</p>
                <p className="text-2xl font-bold">{stats.activeAddresses}</p>
              </div>
              <Users className="w-8 h-8 text-primary opacity-50" />
            </div>
          </div>
          
          <div className="card-glass">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">24h Volume</p>
                <p className="text-2xl font-bold">{parseFloat(stats.volume24h).toFixed(0)}</p>
              </div>
              <Zap className="w-8 h-8 text-primary opacity-50" />
            </div>
          </div>
          
          <div className="card-glass">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Block Time</p>
                <p className="text-2xl font-bold">{stats.avgBlockTime}s</p>
              </div>
              <RefreshCw className="w-8 h-8 text-primary opacity-50" />
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {(['all', 'mint', 'burn', 'transfer'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${
                filter === type
                  ? 'bg-primary text-background'
                  : 'bg-card border border-border hover:border-primary/50'
              }`}
            >
              {type}
              {type !== 'all' && (
                <span className="ml-2 text-xs opacity-75">
                  ({transfers.filter(t => t.type === type).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Transfers Feed */}
        <div className="card-glass overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Live Transfer Feed
              {!paused && <span className="ml-2 h-2 w-2 bg-green-500 rounded-full animate-pulse" />}
            </h2>
          </div>
          
          <div className="max-h-[600px] overflow-y-auto">
            {filteredTransfers.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                No transfers to display. Waiting for blockchain events...
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTransfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    className="p-4 hover:bg-card/50 transition-colors animate-fade-in"
                  >
                    <div className="flex items-start gap-4">
                      {/* Type Icon */}
                      <div className="mt-1">
                        {getTransferIcon(transfer.type)}
                      </div>
                      
                      {/* Transfer Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium capitalize">
                            {transfer.type}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            Token #{transfer.tokenId}
                          </span>
                          <span className="text-sm text-primary font-medium">
                            Amount: {transfer.amount}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-mono">{formatAddress(transfer.from)}</span>
                          <span>→</span>
                          <span className="font-mono">{formatAddress(transfer.to)}</span>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Block: {transfer.blockNumber.toLocaleString()}</span>
                          <span>
                            {new Date(transfer.timestamp).toLocaleTimeString()}
                          </span>
                          <a
                            href={`https://etherscan.io/tx/${transfer.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            View TX ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}