import { Metadata } from 'next'
import Link from 'next/link'
import { Calendar, Clock, ArrowRight, TrendingUp } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Blog - ClickCreate',
  description: 'Latest updates, features, and insights from the ClickCreate team',
}

const posts = [
  {
    title: 'Introducing ClickCreate: Advanced NFT Analytics for Everyone',
    excerpt: 'Today we are excited to launch ClickCreate, a comprehensive NFT analytics platform designed to make holder tracking and snapshot generation accessible to all creators and communities.',
    date: 'November 1, 2025',
    readTime: '4 min read',
    category: 'Announcement',
    featured: true,
  },
  {
    title: 'Daily Sync Limits: Fair Usage for All Users',
    excerpt: 'Learn about our new daily sync quota system that ensures fair access to blockchain data while maintaining platform performance.',
    date: 'November 1, 2025',
    readTime: '3 min read',
    category: 'Feature',
    featured: false,
  },
  {
    title: 'How to Create Perfect Allowlists with Token Range Filtering',
    excerpt: 'A deep dive into using advanced token filtering to create precise holder snapshots for airdrops and special access.',
    date: 'October 28, 2025',
    readTime: '6 min read',
    category: 'Tutorial',
    featured: false,
  },
  {
    title: 'Understanding NFT Holder Analytics',
    excerpt: 'What metrics matter when analyzing NFT communities? We break down the key data points and how to use them.',
    date: 'October 25, 2025',
    readTime: '8 min read',
    category: 'Education',
    featured: false,
  },
  {
    title: 'Multi-Chain Support Coming Soon',
    excerpt: 'We are expanding beyond Ethereum! Get a preview of our upcoming support for Polygon, Arbitrum, Base, and more.',
    date: 'October 20, 2025',
    readTime: '5 min read',
    category: 'Roadmap',
    featured: false,
  },
  {
    title: 'ClickCreate API Beta Launch',
    excerpt: 'Integrate NFT analytics directly into your dApp. Our new REST API is now available in beta.',
    date: 'October 15, 2025',
    readTime: '4 min read',
    category: 'Announcement',
    featured: false,
  },
]

const categories = [
  'All Posts',
  'Announcements',
  'Features',
  'Tutorials',
  'Education',
  'Roadmap',
]

export default function BlogPage() {
  const featuredPost = posts.find(post => post.featured)
  const regularPosts = posts.filter(post => !post.featured)

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-6 py-16 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <TrendingUp className="h-4 w-4" />
              Blog
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Updates &{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Insights
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              The latest news, product updates, and educational content from the ClickCreate team.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16 lg:px-8">
        {/* Categories */}
        <div className="mb-12 flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-all hover:border-primary/50 hover:bg-accent/10"
            >
              {category}
            </button>
          ))}
        </div>

        {/* Featured Post */}
        {featuredPost && (
          <Link
            href="#"
            className="group relative mb-16 block overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative grid md:grid-cols-2 gap-8 p-8">
              <div className="flex flex-col justify-center">
                <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  Featured Post
                </div>
                <h2 className="mb-4 text-3xl font-bold group-hover:text-primary transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="mb-6 text-muted-foreground">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {featuredPost.date}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {featuredPost.readTime}
                  </div>
                </div>
                <div className="mt-6 flex items-center text-primary">
                  Read full article
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
              <div className="relative aspect-video rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  Featured Image
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Blog Posts Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {regularPosts.map((post, index) => (
            <Link
              key={index}
              href="#"
              className="group relative overflow-hidden rounded-lg border border-border bg-card transition-all hover:border-primary/50"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 opacity-0 transition-opacity group-hover:opacity-5" />
              <div className="relative">
                {/* Thumbnail */}
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10">
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {post.category}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                      {post.category}
                    </span>
                    <span>•</span>
                    <span>{post.readTime}</span>
                  </div>

                  <h3 className="mb-2 text-lg font-semibold group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>

                  <p className="mb-4 text-sm text-muted-foreground line-clamp-2">
                    {post.excerpt}
                  </p>

                  <div className="flex items-center text-xs text-muted-foreground">
                    <Calendar className="mr-1 h-3 w-3" />
                    {post.date}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Newsletter CTA */}
        <div className="mt-16 rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-8 text-center">
          <h2 className="mb-4 text-2xl font-bold">Stay Updated</h2>
          <p className="mb-6 text-muted-foreground max-w-2xl mx-auto">
            Subscribe to our newsletter to get the latest updates, feature announcements, and educational content delivered to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 rounded-md border border-border bg-background px-4 py-2 text-sm focus:border-primary/50 focus:outline-none"
            />
            <button className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90">
              Subscribe
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
