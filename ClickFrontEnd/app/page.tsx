'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { Database, Camera, Sliders, Download, User, Globe } from 'lucide-react'
import HeroSection from '@/components/ui/HeroSection'
import FeatureCard from '@/components/ui/FeatureCard'
import StatsCard from '@/components/ui/StatsCard'
import CTASection from '@/components/ui/CTASection'

const features = [
  {
    title: 'Multi-Contract Support',
    description: 'Analyze any ERC-721 or ERC-1155 contract across blockchains with automatic detection and validation.',
    icon: Database,
    gradient: 'from-primary to-orange-600',
  },
  {
    title: 'Current & Historical Snapshots',
    description: 'Generate instant snapshots for any date with 100% on-chain accuracy from blockchain events.',
    icon: Camera,
    gradient: 'from-accent to-yellow-600',
  },
  {
    title: 'Advanced Token Filtering',
    description: 'Filter by token IDs, ranges, exact match modes to find complete or partial holders.',
    icon: Sliders,
    gradient: 'from-orange-600 to-primary',
  },
  {
    title: 'CSV/JSON Export',
    description: 'Download holder lists with token details ready for airdrops, allowlists, and analytics.',
    icon: Download,
    gradient: 'from-primary to-accent',
  },
  {
    title: 'User Profiles & Collections',
    description: 'Save your collections, track blockchain sync status, and manage multiple contracts in one place.',
    icon: User,
    gradient: 'from-yellow-600 to-accent',
  },
  {
    title: 'OpenSea Integration',
    description: 'Automatic collection metadata, images, descriptions, and ENS name resolution.',
    icon: Globe,
    gradient: 'from-accent to-primary',
  },
]

export default function HomePage() {
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState([
    { label: 'Tracked Collections', value: '0', trend: '+0%' },
    { label: 'Snapshots Generated', value: '0', trend: '+0%' },
  ])

  useEffect(() => {
    setMounted(true)
    fetchStats()
  }, [])
  
  const fetchStats = async () => {
    try {
      console.log('📊 Fetching dashboard statistics...')
      
      const response = await axios.get('/api/dashboard/stats')
      
      if (response.data.success) {
        const { totalContracts, totalSnapshots } = response.data.data

        // Format the numbers for display
        const formatNumber = (num: number) => {
          if (num === 0) return '0'
          if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
          return num.toString()
        }

        setStats([
          {
            label: 'Tracked Collections',
            value: totalContracts > 0 ? formatNumber(totalContracts) : '0',
            trend: totalContracts > 0 ? 'Active' : 'Getting started'
          },
          {
            label: 'Snapshots Generated',
            value: totalSnapshots > 0 ? formatNumber(totalSnapshots) : '0',
            trend: totalSnapshots > 0 ? 'Analytics ready' : 'Ready to use'
          },
        ])

        console.log('✅ Dashboard stats updated:', { totalContracts, totalSnapshots })
      }
    } catch (error) {
      console.error('❌ Failed to fetch dashboard stats:', error)

      // Fallback to basic display if API fails
      setStats([
        { label: 'Tracked Collections', value: '0', trend: 'Starting up' },
        { label: 'Snapshots Generated', value: '0', trend: 'Ready to use' },
      ])
    }
  }

  if (!mounted) return null

  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Stats Section */}
      <section className="relative py-20 px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <StatsCard
                key={stat.label}
                {...stat}
                delay={index * 0.1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 px-6 lg:px-8">
        <div className="container mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Powerful Features for
              <span className="gradient-text"> NFT Analytics</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to track, analyze, and manage your NFT collection with enterprise-grade tools.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                {...feature}
                delay={index * 0.1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="relative py-20 px-6 lg:px-8">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started with NFT analytics in three simple steps
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="relative">
              <div className="card-glass group">
                <div className="absolute -top-4 -left-4 h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-xl font-bold text-background">1</span>
                </div>
                <div className="pt-4">
                  <h3 className="text-xl font-semibold mb-2">Add Any Collection</h3>
                  <p className="text-muted-foreground">
                    Enter any ERC-721 or ERC-1155 contract address. Automatic detection and OpenSea metadata integration.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="card-glass group">
                <div className="absolute -top-4 -left-4 h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-xl font-bold text-background">2</span>
                </div>
                <div className="pt-4">
                  <h3 className="text-xl font-semibold mb-2">Generate Snapshot</h3>
                  <p className="text-muted-foreground">
                    Create current or historical snapshots with optional token filtering and exact match modes.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="card-glass group">
                <div className="absolute -top-4 -left-4 h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <span className="text-xl font-bold text-background">3</span>
                </div>
                <div className="pt-4">
                  <h3 className="text-xl font-semibold mb-2">Export Your Data</h3>
                  <p className="text-muted-foreground">
                    Download CSV or JSON with holder addresses, balances, and token lists ready for any use.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection />
    </>
  )
}