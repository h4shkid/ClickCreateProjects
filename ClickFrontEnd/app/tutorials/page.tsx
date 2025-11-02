import { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, PlayCircle, FileText, Video, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Tutorials - ClickCreate',
  description: 'Step-by-step guides and video tutorials for ClickCreate',
}

const tutorials = [
  {
    title: 'Getting Started with ClickCreate',
    description: 'Learn the basics: connect your wallet, add collections, and generate your first snapshot',
    duration: '5 min read',
    type: 'article',
    level: 'Beginner',
    link: '#getting-started',
  },
  {
    title: 'Advanced Token Filtering',
    description: 'Master token range filtering to create precise holder snapshots for airdrops and allowlists',
    duration: '8 min read',
    type: 'article',
    level: 'Intermediate',
    link: '#advanced-filtering',
  },
  {
    title: 'Exporting Data for Airdrops',
    description: 'Complete guide to exporting holder data in formats compatible with popular airdrop tools',
    duration: '10 min read',
    type: 'article',
    level: 'Intermediate',
    link: '#airdrop-export',
  },
  {
    title: 'Historical Snapshots',
    description: 'Generate snapshots at specific block numbers or dates to see holder state in the past',
    duration: '6 min read',
    type: 'article',
    level: 'Advanced',
    link: '#historical',
  },
  {
    title: 'Using the API',
    description: 'Integrate ClickCreate into your dApp or automation workflow using our REST API',
    duration: '15 min read',
    type: 'article',
    level: 'Advanced',
    link: '#api-integration',
  },
  {
    title: 'Multi-Collection Analytics',
    description: 'Track multiple NFT collections simultaneously and compare holder distributions',
    duration: '7 min read',
    type: 'article',
    level: 'Intermediate',
    link: '#multi-collection',
  },
]

const videoTutorials = [
  {
    title: 'ClickCreate Platform Overview',
    description: 'Quick walkthrough of all major features',
    duration: '3:45',
    thumbnail: '/placeholder-video-1.jpg',
    link: '#video-1',
  },
  {
    title: 'Creating Your First Snapshot',
    description: 'Step-by-step guide to generating holder snapshots',
    duration: '5:20',
    thumbnail: '/placeholder-video-2.jpg',
    link: '#video-2',
  },
  {
    title: 'Advanced Filtering Techniques',
    description: 'Pro tips for complex holder queries',
    duration: '8:15',
    thumbnail: '/placeholder-video-3.jpg',
    link: '#video-3',
  },
]

const categories = [
  { name: 'All Tutorials', count: 9, icon: BookOpen },
  { name: 'Getting Started', count: 3, icon: PlayCircle },
  { name: 'Advanced', count: 4, icon: FileText },
  { name: 'Video Guides', count: 3, icon: Video },
]

export default function TutorialsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-6 py-16 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <BookOpen className="h-4 w-4" />
              Tutorials & Guides
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Learn to master{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                NFT Analytics
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Step-by-step tutorials, video guides, and best practices to get the most out of ClickCreate.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16 lg:px-8">
        {/* Categories */}
        <div className="grid gap-4 md:grid-cols-4 mb-12">
          {categories.map((category) => {
            const Icon = category.icon
            return (
              <button
                key={category.name}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:bg-accent/5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-medium">{category.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {category.count} guides
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Written Tutorials */}
        <div className="mb-16">
          <h2 className="mb-8 text-3xl font-bold">Written Guides</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {tutorials.map((tutorial, index) => (
              <Link
                key={index}
                href={tutorial.link}
                className="group relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 opacity-0 transition-opacity group-hover:opacity-5" />
                <div className="relative p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                      tutorial.level === 'Beginner'
                        ? 'bg-green-500/20 text-green-400'
                        : tutorial.level === 'Intermediate'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {tutorial.level}
                    </span>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {tutorial.duration}
                    </div>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold group-hover:text-primary transition-colors">
                    {tutorial.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {tutorial.description}
                  </p>
                  <div className="mt-4 flex items-center text-sm text-primary">
                    Read guide
                    <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Video Tutorials */}
        <div>
          <h2 className="mb-8 text-3xl font-bold">Video Tutorials</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {videoTutorials.map((video, index) => (
              <Link
                key={index}
                href={video.link}
                className="group relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 opacity-0 transition-opacity group-hover:opacity-5" />
                <div className="relative">
                  {/* Thumbnail Placeholder */}
                  <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-accent/20">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 text-white transition-transform group-hover:scale-110">
                        <PlayCircle className="h-8 w-8" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-xs text-white">
                      {video.duration}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="mb-1 font-semibold group-hover:text-primary transition-colors">
                      {video.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {video.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-8 text-center">
          <h2 className="mb-4 text-2xl font-bold">Can't Find What You're Looking For?</h2>
          <p className="mb-6 text-muted-foreground">
            Request a tutorial or suggest a topic you'd like us to cover.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            Request Tutorial
          </Link>
        </div>
      </div>
    </div>
  )
}
