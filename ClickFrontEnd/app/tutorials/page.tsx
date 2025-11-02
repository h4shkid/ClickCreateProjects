'use client'

import Link from 'next/link'
import { PlayCircle, CheckCircle, Clock, BookOpen, Image as ImageIcon, FileText, ArrowRight } from 'lucide-react'

export default function TutorialsPage() {
  const tutorials = [
    {
      title: 'Adding Your First Collection',
      description: 'Learn how to add any NFT collection using its contract address.',
      duration: '2 min',
      difficulty: 'Beginner',
      steps: [
        'Click "Add Collection" button',
        'Paste contract address (0x...)',
        'Verify collection details',
        'Click "Sync Blockchain"',
      ],
      image: '/tutorials/add-collection.png',
    },
    {
      title: 'Generating Current Snapshots',
      description: 'Create instant snapshots of current holder distribution.',
      duration: '3 min',
      difficulty: 'Beginner',
      steps: [
        'Navigate to collection page',
        'Click "Generate Snapshot"',
        'Select "Current State"',
        'Choose export format (CSV/JSON)',
        'Download your snapshot',
      ],
      image: '/tutorials/current-snapshot.png',
    },
    {
      title: 'Historical Snapshots',
      description: 'Generate holder lists at any point in the past.',
      duration: '4 min',
      difficulty: 'Intermediate',
      steps: [
        'Go to collection snapshot page',
        'Select "Historical Snapshot"',
        'Choose date or block number',
        'Wait for processing',
        'Export results',
      ],
      image: '/tutorials/historical-snapshot.png',
    },
    {
      title: 'Advanced Token Filtering',
      description: 'Use token ranges and exact match modes for precise queries.',
      duration: '5 min',
      difficulty: 'Intermediate',
      steps: [
        'Enable "Advanced Filters"',
        'Enter token ID ranges (e.g., 1-100, 500-600)',
        'Toggle "Exact Match" if needed',
        'Set minimum balance',
        'Generate filtered snapshot',
      ],
      image: '/tutorials/advanced-filters.png',
    },
    {
      title: 'Creating Airdrop Lists',
      description: 'Export holder data formatted for airdrop tools.',
      duration: '4 min',
      difficulty: 'Intermediate',
      steps: [
        'Generate snapshot with desired filters',
        'Choose CSV export format',
        'Open file in spreadsheet',
        'Copy wallet addresses',
        'Paste into airdrop tool',
      ],
      image: '/tutorials/airdrop-list.png',
    },
    {
      title: 'Managing Multiple Collections',
      description: 'Organize and track multiple NFT collections.',
      duration: '3 min',
      difficulty: 'Beginner',
      steps: [
        'Go to "My Collections" page',
        'View all your tracked collections',
        'Check sync status',
        'Quick access to snapshots',
        'Remove inactive collections',
      ],
      image: '/tutorials/manage-collections.png',
    },
  ]

  const quickTips = [
    {
      icon: CheckCircle,
      title: 'Existing vs New Collections',
      tip: 'Already-tracked collections add instantly. New collections need full blockchain sync and count toward daily limit.',
    },
    {
      icon: Clock,
      title: 'Sync Time',
      tip: 'Most collections sync in 1-5 minutes. Large historical collections may take longer. Track progress in real-time.',
    },
    {
      icon: FileText,
      title: 'Export Formats',
      tip: 'CSV for spreadsheets and airdrops. JSON for developers and custom tools.',
    },
    {
      icon: ImageIcon,
      title: 'Token Metadata',
      tip: 'Enable metadata in snapshot options to include token names and images. Useful for visual verification.',
    },
  ]

  const useCases = [
    {
      title: 'Airdrops & Allowlists',
      description: 'Generate accurate holder lists for token distributions and mint allowlists.',
      example: 'Create snapshot of holders with 5+ tokens for premium airdrop tier.',
      icon: '🎁',
    },
    {
      title: 'Community Analytics',
      description: 'Understand holder distribution, whale concentration, and community size.',
      example: 'Track top 10 holders and their percentage of total supply over time.',
      icon: '📊',
    },
    {
      title: 'Historical Research',
      description: 'Study holder changes around key events, launches, or market moves.',
      example: 'Compare holder distribution before and after major announcements.',
      icon: '🔍',
    },
    {
      title: 'Ownership Verification',
      description: 'Verify token ownership at specific dates for contests or claims.',
      example: 'Prove you held a token on a specific date for retroactive benefits.',
      icon: '✅',
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
              Tutorials
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Learn by{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Doing
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Step-by-step guides to master every feature. From beginner to advanced.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16 lg:px-8">
        {/* Tutorials Grid */}
        <div className="mb-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Step-by-Step Guides</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Follow along with detailed instructions and visual examples.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {tutorials.map((tutorial, index) => (
              <div
                key={index}
                className="group relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 opacity-0 transition-opacity group-hover:opacity-5" />

                {/* Thumbnail */}
                <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-accent/10">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <PlayCircle className="h-16 w-16 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute top-3 left-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                      tutorial.difficulty === 'Beginner'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {tutorial.difficulty}
                    </span>
                  </div>
                  <div className="absolute bottom-3 right-3 rounded bg-black/80 px-2 py-1 text-xs text-white flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {tutorial.duration}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="mb-2 text-lg font-semibold group-hover:text-primary transition-colors">
                    {tutorial.title}
                  </h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {tutorial.description}
                  </p>

                  {/* Steps Preview */}
                  <div className="mb-4 space-y-1.5">
                    {tutorial.steps.slice(0, 3).map((step, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {idx + 1}
                        </div>
                        <span>{step}</span>
                      </div>
                    ))}
                    {tutorial.steps.length > 3 && (
                      <div className="text-xs text-muted-foreground pl-7">
                        +{tutorial.steps.length - 3} more steps
                      </div>
                    )}
                  </div>

                  <button className="flex items-center text-sm text-primary group-hover:gap-2 transition-all">
                    Start Tutorial
                    <ArrowRight className="h-4 w-4 ml-1 group-hover:ml-0 transition-all" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Tips */}
        <div className="mb-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Quick Tips</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Pro tips to help you work faster and smarter.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {quickTips.map((tip, index) => {
              const Icon = tip.icon
              return (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-card p-6"
                >
                  <Icon className="h-8 w-8 mb-3 text-primary" />
                  <h3 className="mb-2 font-semibold">{tip.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {tip.tip}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Use Cases */}
        <div className="mb-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Common Use Cases</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Real-world examples of how teams and creators use ClickCreate.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-card p-8"
              >
                <div className="mb-4 text-4xl">{useCase.icon}</div>
                <h3 className="mb-2 text-xl font-semibold">{useCase.title}</h3>
                <p className="mb-4 text-muted-foreground">
                  {useCase.description}
                </p>
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                  <div className="mb-1 text-xs font-medium text-primary">Example:</div>
                  <p className="text-sm text-muted-foreground italic">
                    {useCase.example}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Video Placeholder */}
        <div className="mb-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Video Walkthrough</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Watch a complete platform walkthrough (Coming Soon)
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative aspect-video rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden">
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <PlayCircle className="h-20 w-20 text-primary mb-4" />
                <h3 className="text-xl font-semibold mb-2">Complete Platform Walkthrough</h3>
                <p className="text-muted-foreground">Video tutorial coming soon</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-12 text-center">
          <h2 className="mb-4 text-3xl font-bold">Ready to Try It Yourself?</h2>
          <p className="mb-8 text-muted-foreground max-w-2xl mx-auto">
            The best way to learn is by doing. Connect your wallet and follow along with the tutorials.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contracts"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Start Exploring
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-8 py-3 text-sm font-medium transition-colors hover:bg-accent/10"
            >
              Read Documentation
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
