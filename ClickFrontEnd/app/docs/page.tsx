'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Database, Camera, Sliders, Download, User, Globe, Wallet, Zap, Shield, Clock, CheckCircle, ArrowRight, Search, BookOpen } from 'lucide-react'

export default function DocumentationPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const quickStartSteps = [
    {
      number: '1',
      title: 'Connect Your Wallet',
      description: 'Click "Connect Wallet" and choose your preferred wallet provider (MetaMask, WalletConnect, etc.)',
      icon: Wallet,
      color: 'from-primary to-orange-600',
    },
    {
      number: '2',
      title: 'Add a Collection',
      description: 'Paste any ERC-721 or ERC-1155 contract address. We automatically detect and validate it.',
      icon: Database,
      color: 'from-accent to-yellow-600',
    },
    {
      number: '3',
      title: 'Sync Blockchain Data',
      description: 'Click "Sync Blockchain" to fetch all transfer events and build the holder state.',
      icon: Zap,
      color: 'from-orange-600 to-primary',
    },
    {
      number: '4',
      title: 'Generate Snapshot',
      description: 'Choose current or historical date, apply filters, and export to CSV/JSON.',
      icon: Camera,
      color: 'from-primary to-accent',
    },
  ]

  const features = [
    {
      title: 'Multi-Contract Support',
      description: 'Track unlimited NFT collections from any contract address.',
      details: [
        'Automatic ERC-721/ERC-1155 detection',
        'Multi-blockchain support (Ethereum, Polygon, etc.)',
        'OpenSea metadata integration',
        'Collection search and discovery',
      ],
      icon: Database,
      gradient: 'from-primary to-orange-600',
    },
    {
      title: 'Snapshot Generation',
      description: 'Generate holder lists at any point in time with blockchain accuracy.',
      details: [
        'Current state snapshots (instant)',
        'Historical snapshots (any date/block)',
        'Advanced token filtering (ID ranges, exact match)',
        'Export to CSV or JSON format',
      ],
      icon: Camera,
      gradient: 'from-accent to-yellow-600',
    },
    {
      title: 'User Profiles',
      description: 'Manage your collections and track sync status in one place.',
      details: [
        'Personal dashboard with all your collections',
        'Real-time sync progress tracking',
        'Collection analytics and statistics',
        'ENS name resolution',
      ],
      icon: User,
      gradient: 'from-orange-600 to-primary',
    },
    {
      title: 'Advanced Filtering',
      description: 'Powerful filtering options for precise holder queries.',
      details: [
        'Filter by token ID ranges (e.g., 1-100, 500-600)',
        'Exact match mode (only holders with ALL tokens)',
        'Minimum balance filtering',
        'Holder count and distribution analytics',
      ],
      icon: Sliders,
      gradient: 'from-primary to-accent',
    },
  ]

  const dataFlow = [
    {
      step: 'Blockchain',
      description: 'Direct RPC connection to Ethereum via Alchemy/QuickNode',
      icon: Globe,
    },
    {
      step: 'Events',
      description: 'Fetch all Transfer events from deployment to latest block',
      icon: Zap,
    },
    {
      step: 'Database',
      description: 'Store and process events to build current holder state',
      icon: Database,
    },
    {
      step: 'Snapshots',
      description: 'Generate accurate holder lists at any point in time',
      icon: Camera,
    },
  ]

  const limits = [
    {
      title: 'Daily Sync Limit',
      value: '2 new collections',
      description: 'Add 2 new collections per day. Existing collections are unlimited.',
      icon: Clock,
      color: 'text-primary',
    },
    {
      title: 'Snapshots',
      value: 'Unlimited',
      description: 'Generate as many snapshots as you need. No restrictions.',
      icon: CheckCircle,
      color: 'text-green-400',
    },
    {
      title: 'Export Formats',
      value: 'CSV & JSON',
      description: 'Download holder data in your preferred format.',
      icon: Download,
      color: 'text-accent',
    },
    {
      title: 'Data Security',
      value: 'Non-custodial',
      description: 'We never ask for or store private keys. Read-only access.',
      icon: Shield,
      color: 'text-blue-400',
    },
  ]

  const faqs = [
    {
      question: 'What is the difference between NEW and EXISTING collections?',
      answer: 'NEW collections are contracts not in our database - they require full blockchain sync and count toward your daily limit. EXISTING collections (added by other users) can be added instantly without using your quota.',
    },
    {
      question: 'How accurate is the holder data?',
      answer: 'Our data is 100% on-chain accurate. We fetch all Transfer events directly from Ethereum and rebuild holder state. Historical snapshots reflect the exact holder state at that block/date.',
    },
    {
      question: 'Can I track collections on multiple blockchains?',
      answer: 'Currently we support Ethereum Mainnet. We are actively working on expanding to Polygon, Arbitrum, Base, and other EVM-compatible chains.',
    },
    {
      question: 'What happens when I hit the daily sync limit?',
      answer: 'You can still add existing collections (already in our database) instantly. The limit resets every day at 00:00 UTC. Check your quota badge in the header.',
    },
    {
      question: 'How long does blockchain sync take?',
      answer: 'Sync time depends on collection size and blockchain history. Most collections sync in 1-5 minutes. Large collections (10k+ NFTs with years of history) may take longer. You can track progress in real-time.',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-6 py-16 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <BookOpen className="h-4 w-4" />
              Documentation
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Master{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                NFT Analytics
              </span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Everything you need to know about tracking holders, generating snapshots, and managing your NFT collections.
            </p>

            {/* Search */}
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card pl-12 pr-4 py-3 text-foreground placeholder-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16 lg:px-8">
        {/* Quick Start */}
        <div className="mb-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Quick Start Guide</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get up and running in 4 simple steps. Generate your first snapshot in under 5 minutes.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {quickStartSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/50"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 transition-opacity group-hover:opacity-5`} />
                  <div className="relative">
                    <div className="mb-4 flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${step.color} text-white font-bold text-lg`}>
                        {step.number}
                      </div>
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Features */}
        <div className="mb-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Platform Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Comprehensive toolkit for NFT holder analysis and snapshot generation.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <div
                  key={index}
                  className="group relative overflow-hidden rounded-lg border border-border bg-card p-8 transition-all hover:border-primary/50"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 transition-opacity group-hover:opacity-5`} />
                  <div className="relative">
                    <div className={`mb-4 inline-flex rounded-lg bg-gradient-to-br ${feature.gradient} p-3 text-white`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                    <p className="mb-4 text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                    <ul className="space-y-2">
                      {feature.details.map((detail, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Direct blockchain connection for 100% accurate, verifiable holder data.
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-accent to-primary hidden lg:block" />
            <div className="space-y-8">
              {dataFlow.map((item, index) => {
                const Icon = item.icon
                return (
                  <div key={index} className="relative">
                    <div className="flex items-center gap-8">
                      <div className="flex-1 text-right">
                        {index % 2 === 0 && (
                          <div className="inline-block rounded-lg border border-border bg-card p-6 text-left">
                            <div className="flex items-center gap-3 mb-2">
                              <Icon className="h-5 w-5 text-primary" />
                              <h3 className="font-semibold">{item.step}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                        )}
                      </div>
                      <div className="hidden lg:flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-background text-primary font-bold z-10">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        {index % 2 === 1 && (
                          <div className="inline-block rounded-lg border border-border bg-card p-6">
                            <div className="flex items-center gap-3 mb-2">
                              <Icon className="h-5 w-5 text-primary" />
                              <h3 className="font-semibold">{item.step}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="lg:hidden mt-4 rounded-lg border border-border bg-card p-6">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white text-sm font-bold">
                          {index + 1}
                        </div>
                        <Icon className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{item.step}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Limits & Security */}
        <div className="mb-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Limits & Security</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Fair usage policies and security measures to protect your data.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {limits.map((limit, index) => {
              const Icon = limit.icon
              return (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-card p-6"
                >
                  <Icon className={`h-8 w-8 mb-3 ${limit.color}`} />
                  <div className={`mb-1 text-2xl font-bold ${limit.color}`}>
                    {limit.value}
                  </div>
                  <h3 className="mb-2 font-semibold">{limit.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {limit.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Frequently Asked Questions</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Common questions about using ClickCreate.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-card p-6"
              >
                <h3 className="mb-3 text-lg font-semibold">{faq.question}</h3>
                <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to Get Started?</h2>
          <p className="mb-8 text-muted-foreground max-w-2xl mx-auto">
            Connect your wallet and add your first collection in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contracts"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Browse Collections
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/tutorials"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-8 py-3 text-sm font-medium transition-colors hover:bg-accent/10"
            >
              Watch Tutorials
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
