'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Search, ExternalLink, Users, Hash, Activity, Plus } from 'lucide-react'
import QuickAddCollection from '@/components/collections/QuickAddCollection'

interface Collection {
  id: string
  address: string
  name: string
  symbol: string
  contractType: 'ERC721' | 'ERC1155'
  chainId: number
  description?: string
  imageUrl?: string
  isVerified: boolean
  holderCount: number
  uniqueTokens: number
  totalSupply: string
  usageCount: number
  createdAt: string
  lastActivityAt?: string
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddCollection, setShowAddCollection] = useState(false)

  useEffect(() => {
    fetchCollections()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredCollections(collections)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredCollections(
        collections.filter(c =>
          c.name.toLowerCase().includes(query) ||
          c.symbol.toLowerCase().includes(query) ||
          c.address.toLowerCase().includes(query)
        )
      )
    }
  }, [searchQuery, collections])

  const fetchCollections = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/collections')
      const data = await response.json()
      if (data.success) {
        setCollections(data.data.collections || [])
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error)
    } finally {
      setLoading(false)
    }
  }

  const getChainName = (chainId: number) => {
    const chains: Record<number, string> = {
      1: 'Ethereum',
      137: 'Polygon',
      42161: 'Arbitrum',
      8453: 'Base',
      360: 'Shape'
    }
    return chains[chainId] || `Chain ${chainId}`
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US')
  }

  return (
    <div className="min-h-screen pt-24 px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Collections</h1>
              <p className="text-gray-400">
                Browse all NFT collections tracked on the platform
              </p>
            </div>
            <button
              onClick={() => setShowAddCollection(true)}
              className="btn-primary flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Collection
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, symbol, or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mb-6 flex items-center justify-between text-sm text-gray-400">
          <div>
            <span className="font-medium text-white">{filteredCollections.length}</span> collections
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        </div>

        {/* Table View */}
        {loading ? (
          <div className="glass-card p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
            <p className="mt-4 text-gray-400">Loading collections...</p>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-gray-400">
              {searchQuery ? 'No collections found matching your search' : 'No collections available yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddCollection(true)}
                className="btn-primary mt-4 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add First Collection
              </button>
            )}
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-sm font-semibold text-gray-400">Collection</th>
                    <th className="text-left p-4 text-sm font-semibold text-gray-400">Chain</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-400">Holders</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-400">Items</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-400">Supply</th>
                    <th className="text-center p-4 text-sm font-semibold text-gray-400">Type</th>
                    <th className="text-right p-4 text-sm font-semibold text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCollections.map((collection) => (
                    <tr
                      key={collection.id}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      {/* Collection Name & Image */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                            {collection.imageUrl ? (
                              <Image
                                src={collection.imageUrl}
                                alt={collection.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600">
                                <Hash className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white truncate">{collection.name}</span>
                              {collection.isVerified && (
                                <span className="text-blue-400 text-xs"></span>
                              )}
                            </div>
                            <span className="text-sm text-gray-400">{collection.symbol}</span>
                          </div>
                        </div>
                      </td>

                      {/* Chain */}
                      <td className="p-4">
                        <span className="text-sm text-gray-300">
                          {getChainName(collection.chainId)}
                        </span>
                      </td>

                      {/* Holders */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-white font-medium">
                            {formatNumber(collection.holderCount)}
                          </span>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Hash className="w-4 h-4 text-gray-400" />
                          <span className="text-white font-medium">
                            {formatNumber(collection.uniqueTokens)}
                          </span>
                        </div>
                      </td>

                      {/* Supply */}
                      <td className="p-4 text-right">
                        <span className="text-gray-300">
                          {formatNumber(parseInt(collection.totalSupply))}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="p-4 text-center">
                        <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                          collection.contractType === 'ERC721'
                            ? 'bg-purple-500/20 text-purple-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {collection.contractType}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/collections/${collection.address}`}
                            className="btn-secondary text-sm px-3 py-1.5"
                          >
                            View
                          </Link>
                          <Link
                            href={`/collections/${collection.address}/snapshot`}
                            className="btn-primary text-sm px-3 py-1.5"
                          >
                            Snapshot
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Quick Add Collection Modal */}
      <QuickAddCollection
        isOpen={showAddCollection}
        onClose={() => setShowAddCollection(false)}
        onSuccess={() => {
          setShowAddCollection(false)
          fetchCollections() // Refresh list
        }}
      />
    </div>
  )
}
