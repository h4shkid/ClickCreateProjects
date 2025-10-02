'use client'

import { useState, useEffect } from 'react'
import { User, Settings, Download, History, Plus, Trash2, Edit2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAccount } from 'wagmi'
import Link from 'next/link'

interface UserProfile {
  username: string
  displayName?: string
  bio?: string
  profileImage?: string
  createdAt: string
}

interface SnapshotHistory {
  id: string
  contractAddress: string
  contractName: string
  tokenIds?: string[]
  type: 'current' | 'historical'
  blockNumber?: number
  holderCount: number
  createdAt: string
  exportFormat?: 'csv' | 'json'
}

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const { address, isConnected } = useAccount()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [snapshotHistory, setSnapshotHistory] = useState<SnapshotHistory[]>([])
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({
    displayName: '',
    bio: ''
  })

  useEffect(() => {
    if (isConnected) {
      // For now, create a basic profile from wallet address
      if (!profile) {
        setProfile({
          username: address?.slice(0, 8) + '...' + address?.slice(-4) || 'Anonymous',
          displayName: '',
          bio: '',
          createdAt: new Date().toISOString()
        })
      }
      // fetchProfile()
      // fetchSnapshotHistory()
    }
  }, [isConnected, address, profile])

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/users/profile')
      const data = await response.json()
      if (data.success) {
        setProfile(data.profile)
        setEditData({
          displayName: data.profile.displayName || '',
          bio: data.profile.bio || ''
        })
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    }
  }

  const fetchSnapshotHistory = async () => {
    try {
      const response = await fetch('/api/users/snapshots')
      const data = await response.json()
      if (data.success) {
        setSnapshotHistory(data.snapshots || [])
      }
    } catch (error) {
      console.error('Failed to fetch snapshot history:', error)
    }
  }

  const updateProfile = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })
      
      const data = await response.json()
      if (data.success) {
        setProfile({ ...profile!, ...editData })
        setEditMode(false)
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="animate-pulse space-y-6">
            <div className="bg-card/20 rounded-lg p-6">
              <div className="h-20 bg-background/50 rounded mb-4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-background/50 rounded w-1/4"></div>
                <div className="h-4 bg-background/50 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-bold mb-4">Profile</h1>
          <p className="text-muted-foreground mb-8">
            Please connect your wallet to view your profile
          </p>
          <Link 
            href="/"
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-24 px-6 lg:px-8">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Profile
          </h1>
          <p className="text-muted-foreground">
            Manage your account settings and view your activity
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {profile?.displayName || profile?.username || 'Anonymous'}
                </h2>
                <p className="text-muted-foreground text-sm font-mono">
                  {address}
                </p>
                {profile?.bio && (
                  <p className="text-muted-foreground mt-2">{profile.bio}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setEditMode(!editMode)}
              className="p-2 text-muted-foreground hover:text-primary transition-colors"
            >
              <Edit2 className="w-5 h-5" />
            </button>
          </div>

          {editMode && (
            <div className="border-t border-border pt-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Display Name</label>
                  <input
                    type="text"
                    value={editData.displayName}
                    onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:border-primary/50"
                    placeholder="Your display name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Bio</label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:border-primary/50"
                    rows={3}
                    placeholder="Tell us about yourself..."
                    maxLength={500}
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={updateProfile}
                    disabled={loading}
                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false)
                      setEditData({
                        displayName: profile?.displayName || '',
                        bio: profile?.bio || ''
                      })
                    }}
                    className="px-4 py-2 bg-card border border-border text-foreground rounded-md hover:bg-card/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Snapshots</p>
                <p className="text-2xl font-bold">{snapshotHistory.length}</p>
              </div>
              <History className="w-8 h-8 text-primary/60" />
            </div>
          </div>
          
          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Collections Tracked</p>
                <p className="text-2xl font-bold">
                  {new Set(snapshotHistory.map(s => s.contractAddress)).size}
                </p>
              </div>
              <Settings className="w-8 h-8 text-primary/60" />
            </div>
          </div>
          
          <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Exports</p>
                <p className="text-2xl font-bold">
                  {snapshotHistory.filter(s => s.exportFormat).length}
                </p>
              </div>
              <Download className="w-8 h-8 text-primary/60" />
            </div>
          </div>
        </div>

        {/* Recent Snapshots */}
        <div className="bg-card/20 backdrop-blur-sm border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Recent Snapshots</h3>
            <Link
              href="/snapshot"
              className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New
            </Link>
          </div>

          {snapshotHistory.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No snapshots yet</p>
              <Link
                href="/snapshot"
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-md transition-colors"
              >
                Create Your First Snapshot
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {snapshotHistory.slice(0, 5).map((snapshot) => (
                <div key={snapshot.id} className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                  <div>
                    <p className="font-medium">{snapshot.contractName}</p>
                    <p className="text-sm text-muted-foreground">
                      {snapshot.type === 'historical' ? `Block ${snapshot.blockNumber}` : 'Current'} • 
                      {snapshot.holderCount} holders • 
                      {new Date(snapshot.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {snapshot.exportFormat && (
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                        {snapshot.exportFormat.toUpperCase()}
                      </span>
                    )}
                    <span className={`px-2 py-1 rounded text-xs ${
                      snapshot.type === 'current' 
                        ? 'bg-blue-500/20 text-blue-400' 
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {snapshot.type}
                    </span>
                  </div>
                </div>
              ))}
              
              {snapshotHistory.length > 5 && (
                <div className="text-center pt-4">
                  <button className="text-primary hover:underline text-sm">
                    View all {snapshotHistory.length} snapshots
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}