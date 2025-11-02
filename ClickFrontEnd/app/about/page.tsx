import { Metadata } from 'next'
import { Target, Users, Zap, Shield, Globe, Heart } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About Us - ClickCreate',
  description: 'Learn about ClickCreate and our mission to democratize NFT analytics',
}

const values = [
  {
    icon: Users,
    title: 'Community First',
    description: 'Built for creators, collectors, and communities. Every feature is designed with user needs in mind.',
  },
  {
    icon: Shield,
    title: 'Transparency',
    description: 'Open about our data sources, methods, and limitations. No black boxes, just clear analytics.',
  },
  {
    icon: Zap,
    title: 'Performance',
    description: 'Fast, reliable, and scalable. We optimize every query to deliver results in seconds, not minutes.',
  },
  {
    icon: Globe,
    title: 'Accessibility',
    description: 'Powerful analytics should be available to everyone, not just enterprises with large budgets.',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-6 py-24 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Building the future of{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                NFT Analytics
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              ClickCreate makes advanced holder tracking, snapshot generation, and collection analytics accessible to everyone in the Web3 ecosystem.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16 lg:px-8">
        {/* Mission Section */}
        <div className="mb-24 max-w-4xl mx-auto">
          <div className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <Target className="h-4 w-4" />
              Our Mission
            </div>
            <h2 className="mb-6 text-3xl font-bold">
              Democratizing NFT Data
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              We believe that powerful analytics tools shouldn't be locked behind enterprise paywalls or require technical expertise. ClickCreate was born from the frustration of trying to generate simple holder snapshots for community airdrops and discovering that most solutions were either too expensive, too complicated, or simply didn't work reliably.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="mb-4 text-xl font-semibold">The Problem</h3>
                <p className="text-muted-foreground">
                  NFT creators and communities need accurate holder data for airdrops, allowlists, and community management. But getting this data has traditionally required expensive tools, custom development, or error-prone manual processes.
                </p>
              </div>
              <div>
                <h3 className="mb-4 text-xl font-semibold">Our Solution</h3>
                <p className="text-muted-foreground">
                  A user-friendly platform that connects directly to blockchain data, processes it intelligently, and presents it in formats that creators actually need. No coding required, no enterprise pricing, just straightforward analytics.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="mb-24">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Our Values</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              These principles guide every decision we make, from product features to user support.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => {
              const Icon = value.icon
              return (
                <div
                  key={value.title}
                  className="relative overflow-hidden rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/50"
                >
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {value.description}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Heart className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h2 className="mb-4 text-2xl font-bold">Join Our Community</h2>
          <p className="mb-6 text-muted-foreground max-w-2xl mx-auto">
            ClickCreate is built with feedback from real users. Share your ideas, report bugs, or just say hello on our Discord server.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Join Discord
            </a>
            <a
              href="#"
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent/10"
            >
              Follow on Twitter
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
