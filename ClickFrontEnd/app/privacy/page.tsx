import { Metadata } from 'next'
import { Shield, Eye, Lock, Database, UserCheck, FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy - ClickCreate',
  description: 'ClickCreate Privacy Policy and data handling practices',
}

const sections = [
  {
    icon: Database,
    title: 'Information We Collect',
    content: [
      {
        subtitle: 'Wallet Address',
        text: 'When you connect your wallet, we store your Ethereum address to associate your collections and snapshots with your account. This is the primary identifier we use.',
      },
      {
        subtitle: 'On-Chain Data',
        text: 'We collect publicly available blockchain data including NFT transfers, holder balances, and token metadata. This data is already public on the Ethereum blockchain.',
      },
      {
        subtitle: 'Usage Analytics',
        text: 'We collect anonymous usage data (pages viewed, features used, timestamps) to improve our platform. This data is not linked to your wallet address.',
      },
      {
        subtitle: 'IP Address',
        text: 'Your IP address is temporarily logged for security purposes and to prevent abuse. We do not permanently store or share IP addresses.',
      },
    ],
  },
  {
    icon: Eye,
    title: 'How We Use Your Information',
    content: [
      {
        subtitle: 'Service Delivery',
        text: 'We use your wallet address to provide you with personalized analytics, save your collections, and generate snapshots.',
      },
      {
        subtitle: 'Platform Improvement',
        text: 'Anonymous usage data helps us understand which features are most valuable and where we should focus development efforts.',
      },
      {
        subtitle: 'Security & Abuse Prevention',
        text: 'We use IP binding to prevent spam and abuse. Each IP address can only be associated with one wallet for 24 hours.',
      },
      {
        subtitle: 'Communications',
        text: 'If you opt in, we may send updates about new features, platform changes, or important security notices.',
      },
    ],
  },
  {
    icon: Lock,
    title: 'Data Security',
    content: [
      {
        subtitle: 'Encryption',
        text: 'All data transmitted between your browser and our servers is encrypted using industry-standard TLS/SSL protocols.',
      },
      {
        subtitle: 'Database Security',
        text: 'Our PostgreSQL database is hosted on secure infrastructure with regular backups, access controls, and monitoring.',
      },
      {
        subtitle: 'No Private Keys',
        text: 'We never ask for or store your private keys, seed phrases, or passwords. Wallet connections are handled entirely client-side using RainbowKit.',
      },
      {
        subtitle: 'Limited Access',
        text: 'Only essential team members have access to production systems, and all access is logged and monitored.',
      },
    ],
  },
  {
    icon: UserCheck,
    title: 'Your Rights',
    content: [
      {
        subtitle: 'Access Your Data',
        text: 'You can view all data associated with your wallet address through your profile page.',
      },
      {
        subtitle: 'Delete Your Data',
        text: 'Contact us to request deletion of your account and associated data. Note that public blockchain data cannot be deleted.',
      },
      {
        subtitle: 'Opt Out',
        text: 'You can disconnect your wallet at any time to stop using our services.',
      },
      {
        subtitle: 'Data Portability',
        text: 'Export your collections and snapshots in standard formats (CSV, JSON) at any time.',
      },
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-6 py-16 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <Shield className="h-4 w-4" />
              Privacy Policy
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Your Privacy{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Matters
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              We're committed to protecting your privacy and being transparent about how we handle your data.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Last updated: November 1, 2025
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-16 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Summary */}
          <div className="mb-16 rounded-lg border border-primary/20 bg-primary/5 p-8">
            <h2 className="mb-4 text-xl font-bold">Privacy Summary</h2>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="text-primary">✓</span>
                <span>We only collect your wallet address and publicly available blockchain data</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">✓</span>
                <span>We never ask for private keys, seed phrases, or passwords</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">✓</span>
                <span>Your data is encrypted in transit and at rest</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">✓</span>
                <span>You can delete your account and data at any time</span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary">✓</span>
                <span>We don't sell your data to third parties</span>
              </li>
            </ul>
          </div>

          {/* Detailed Sections */}
          <div className="space-y-16">
            {sections.map((section, index) => {
              const Icon = section.icon
              return (
                <div key={index}>
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="text-2xl font-bold">{section.title}</h2>
                  </div>
                  <div className="space-y-6 pl-13">
                    {section.content.map((item, itemIndex) => (
                      <div key={itemIndex}>
                        <h3 className="mb-2 font-semibold">{item.subtitle}</h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Third-Party Services */}
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold">Third-Party Services</h2>
              </div>
              <div className="space-y-4 pl-13">
                <p className="text-muted-foreground leading-relaxed">
                  ClickCreate uses the following third-party services to provide our platform:
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  <li>
                    <strong>Alchemy / QuickNode:</strong> Blockchain RPC providers for fetching on-chain data
                  </li>
                  <li>
                    <strong>OpenSea API:</strong> For fetching NFT metadata and collection information
                  </li>
                  <li>
                    <strong>Vercel:</strong> Hosting and deployment platform
                  </li>
                  <li>
                    <strong>RainbowKit:</strong> Wallet connection interface (client-side only)
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  Each service has its own privacy policy. We recommend reviewing their policies if you have concerns.
                </p>
              </div>
            </div>

            {/* Children's Privacy */}
            <div>
              <h2 className="mb-4 text-2xl font-bold">Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                ClickCreate is not intended for users under the age of 18. We do not knowingly collect personal information from children. If you believe we have inadvertently collected such information, please contact us immediately.
              </p>
            </div>

            {/* Changes to Policy */}
            <div>
              <h2 className="mb-4 text-2xl font-bold">Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this privacy policy from time to time. We will notify users of significant changes by posting a notice on our platform or sending an email to registered users. Your continued use of ClickCreate after changes are posted constitutes acceptance of the updated policy.
              </p>
            </div>

            {/* Contact */}
            <div>
              <h2 className="mb-4 text-2xl font-bold">Questions or Concerns?</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                If you have questions about this privacy policy or how we handle your data, please contact us:
              </p>
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="space-y-2 text-sm">
                  <p><strong>Email:</strong> privacy@clickcreate.xyz</p>
                  <p><strong>Discord:</strong> Join our community server</p>
                  <p><strong>Twitter:</strong> @ClickCreate</p>
                </div>
              </div>
            </div>
          </div>

          {/* GDPR & CCPA */}
          <div className="mt-16 rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-8">
            <h2 className="mb-4 text-xl font-bold">GDPR & CCPA Compliance</h2>
            <p className="text-sm text-muted-foreground mb-4">
              ClickCreate complies with GDPR (EU) and CCPA (California) privacy regulations. You have the right to:
            </p>
            <ul className="grid md:grid-cols-2 gap-3 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Access your personal data</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Request data deletion</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Opt out of data collection</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Data portability</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
