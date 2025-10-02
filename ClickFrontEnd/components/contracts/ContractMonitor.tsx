'use client'

import { useState, useEffect } from 'react'
import { useContract } from '@/lib/contracts/ContractContext'
import { Activity, Play, Pause, RotateCcw, ExternalLink, Circle, ArrowRight, Calendar } from 'lucide-react'

interface BlockchainEvent {
  id: string
  type: 'Transfer' | 'TransferSingle' | 'TransferBatch' | 'Mint' | 'Burn'
  from?: string
  to?: string
  tokenId?: string
  amount?: string
  blockNumber: number
  transactionHash: string
  timestamp: string
  gasUsed?: string
  gasPrice?: string
}

interface ContractMonitorProps {
  contractAddress: string
}

export function ContractMonitor({ contractAddress }: ContractMonitorProps) {
  const { contract, isLoading } = useContract()
  const [events, setEvents] = useState<BlockchainEvent[]>([])
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [filter, setFilter] = useState<'all' | 'transfer' | 'mint' | 'burn'>('all')

  useEffect(() => {
    const fetchRecentEvents = async () => {
      setLoadingEvents(true)
      try {
        const response = await fetch(`/api/contracts/${contractAddress}/events/recent?limit=50`)
        const data = await response.json()
        
        if (data.success) {
          setEvents(data.events || [])
        }
      } catch (err) {
        console.error('Failed to load events:', err)
      } finally {
        setLoadingEvents(false)
      }
    }

    if (contractAddress) {
      fetchRecentEvents()
    }
  }, [contractAddress])

  // Real-time monitoring simulation
  useEffect(() => {
    if (!isMonitoring) return

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/contracts/${contractAddress}/events/recent?limit=5`)
        const data = await response.json()
        
        if (data.success && data.events?.length > 0) {
          setEvents(prev => {
            const newEvents = data.events.filter((newEvent: BlockchainEvent) => 
              !prev.some(existingEvent => existingEvent.id === newEvent.id)
            )
            return [...newEvents, ...prev].slice(0, 100) // Keep last 100 events
          })
        }
      } catch (err) {
        console.error('Failed to fetch new events:', err)
      }
    }, 10000) // Poll every 10 seconds

    return () => clearInterval(interval)
  }, [isMonitoring, contractAddress])

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInSeconds = Math.floor((now.getTime() - time.getTime()) / 1000)

    if (diffInSeconds < 60) return `${diffInSeconds}s ago`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  const getEventColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'transfer':
      case 'transfersingle':
      case 'transferbatch':
        return 'bg-blue-500'
      case 'mint':
        return 'bg-green-500'
      case 'burn':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getEventIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'mint':
        return '+'
      case 'burn':
        return '-'
      default:
        return '→'
    }
  }

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true
    if (filter === 'transfer') return event.type.toLowerCase().includes('transfer')
    if (filter === 'mint') return event.type.toLowerCase() === 'mint'
    if (filter === 'burn') return event.type.toLowerCase() === 'burn'
    return true
  })

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
    <div className="space-y-6">
      {/* Monitor Controls */}
      <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Real-time Monitor</h2>
              <p className="text-sm text-muted-foreground">Track blockchain events as they happen</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-background/50 rounded-lg border border-border">
              <Circle className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm text-muted-foreground">
                {isMonitoring ? 'Live' : 'Paused'}
              </span>
            </div>
            
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                isMonitoring 
                  ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                  : 'bg-green-500/20 text-green-500 hover:bg-green-500/30'
              }`}
            >
              {isMonitoring ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start
                </>
              )}
            </button>
          </div>
        </div>

        {/* Event Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          {[
            { key: 'all', label: 'All Events' },
            { key: 'transfer', label: 'Transfers' },
            { key: 'mint', label: 'Mints' },
            { key: 'burn', label: 'Burns' }
          ].map((filterOption) => (
            <button
              key={filterOption.key}
              onClick={() => setFilter(filterOption.key as any)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                filter === filterOption.key
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
            >
              {filterOption.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event Stream */}
      <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Event Stream</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
            </span>
            <button 
              onClick={() => window.location.reload()}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50"
              title="Refresh events"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {loadingEvents ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
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
        ) : filteredEvents.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-4 p-4 bg-background/50 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                <div className={`w-8 h-8 ${getEventColor(event.type)} rounded-full flex items-center justify-center text-white text-sm font-medium`}>
                  {getEventIcon(event.type)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground capitalize">{event.type}</span>
                    {event.tokenId && (
                      <span className="text-sm px-2 py-0.5 bg-primary/10 text-primary rounded">
                        #{event.tokenId}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {event.from && event.to ? (
                      <>
                        <span className="font-mono">{formatAddress(event.from)}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="font-mono">{formatAddress(event.to)}</span>
                      </>
                    ) : event.to ? (
                      <span className="font-mono">To: {formatAddress(event.to)}</span>
                    ) : event.from ? (
                      <span className="font-mono">From: {formatAddress(event.from)}</span>
                    ) : null}
                    
                    {event.amount && (
                      <>
                        <span>•</span>
                        <span>Amount: {event.amount}</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="w-3 h-3" />
                    <span>Block {event.blockNumber.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatTimeAgo(event.timestamp)}</span>
                    <a
                      href={`https://etherscan.io/tx/${event.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded"
                      title="View on Etherscan"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Activity className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-foreground mb-2">No events found</h4>
            <p className="text-muted-foreground">
              {filter === 'all' 
                ? 'No recent blockchain events for this contract' 
                : `No ${filter} events found`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}