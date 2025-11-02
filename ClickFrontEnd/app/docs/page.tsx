import { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Code, Zap, Database, Shield, FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Documentation - ClickCreate',
  description: 'Complete documentation for ClickCreate NFT analytics platform',
}

const sections = [
  {
    title: 'Getting Started',
    icon: Zap,
    description: 'Quick start guide to begin using ClickCreate',
    links: [
      { label: 'Introduction', href: '#introduction' },
      { label: 'Connect Your Wallet', href: '#wallet' },
      { label: 'Add Your First Collection', href: '#first-collection' },
      { label: 'Generate Snapshots', href: '#snapshots' },
    ]
  },
  {
    title: 'Features',
    icon: BookOpen,
    description: 'Learn about all platform features',
    links: [
      { label: 'Collection Analytics', href: '#analytics' },
      { label: 'Holder Tracking', href: '#holders' },
      { label: 'Token Gallery', href: '#gallery' },
      { label: 'Advanced Filtering', href: '#filtering' },
      { label: 'Export Options', href: '#export' },
    ]
  },
  {
    title: 'API Integration',
    icon: Code,
    description: 'Integrate ClickCreate into your applications',
    links: [
      { label: 'API Reference', href: '/api-reference' },
      { label: 'Authentication', href: '#auth' },
      { label: 'Rate Limits', href: '#limits' },
      { label: 'Webhooks', href: '#webhooks' },
    ]
  },
  {
    title: 'Data & Privacy',
    icon: Shield,
    description: 'How we handle your data',
    links: [
      { label: 'Data Sources', href: '#sources' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Security', href: '#security' },
      { label: 'GDPR Compliance', href: '#gdpr' },
    ]
  },
]

const faqs = [
  {
    question: 'How does ClickCreate sync blockchain data?',
    answer: 'ClickCreate uses direct blockchain RPC connections (Alchemy, QuickNode) to fetch Transfer events and reconstruct ownership state. Data is cached in our database for fast queries.'
  },
  {
    question: 'What blockchains are supported?',
    answer: 'Currently we support Ethereum Mainnet, with plans to expand to Polygon, Arbitrum, Base, and other EVM-compatible chains.'
  },
  {
    question: 'How often is data updated?',
    answer: 'Collections sync automatically when added. You can manually refresh data anytime. Real-time sync workers keep popular collections up to date.'
  },
  {
    question: 'What is the daily sync limit?',
    answer: 'Free users can add 2 new collections per day. Existing collections (already in our database) can be added instantly without limit.'
  },
  {
    question: 'Can I export holder data?',
    answer: 'Yes! Generate snapshots and export to CSV, JSON, or use our advanced filtering for custom queries.'
  },
]

export default function DocumentationPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-6 py-16 lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <FileText className="h-4 w-4" />
              Documentation
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Everything you need to know about{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                ClickCreate
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Comprehensive guides, tutorials, and API documentation to help you get the most out of our NFT analytics platform.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16 lg:px-8">
        {/* Documentation Sections */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2 mb-24">
          {sections.map((section) => {
            const Icon = section.icon
            return (
              <div
                key={section.title}
                className="group relative overflow-hidden rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/50"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 opacity-0 transition-opacity group-hover:opacity-5" />
                <div className="relative">
                  <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{section.title}</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {section.description}
                  </p>
                  <ul className="space-y-2">
                    {section.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          className="group/link inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
                        >
                          <span className="mr-2 text-primary opacity-0 transition-opacity group-hover/link:opacity-100">→</span>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">
              Quick answers to common questions about ClickCreate
            </p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-card p-6"
              >
                <h3 className="mb-3 text-lg font-semibold">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-24 rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-8 text-center">
          <h2 className="mb-4 text-2xl font-bold">Need More Help?</h2>
          <p className="mb-6 text-muted-foreground">
            Can't find what you're looking for? Reach out to our team.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Contact Support
            </Link>
            <Link
              href="/tutorials"
              className="inline-flex items-center justify-center rounded-md border border-border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent/10"
            >
              View Tutorials
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
