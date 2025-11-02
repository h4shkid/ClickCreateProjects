import { Metadata } from 'next'
import { FileText, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service - ClickCreate',
  description: 'ClickCreate Terms of Service and usage guidelines',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container relative mx-auto px-6 py-16 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <FileText className="h-4 w-4" />
              Terms of Service
            </div>
            <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Terms of{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Service
              </span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Please read these terms carefully before using ClickCreate.
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
          {/* Important Notice */}
          <div className="mb-12 rounded-lg border border-orange-500/20 bg-orange-500/10 p-6">
            <div className="flex gap-4">
              <AlertCircle className="h-6 w-6 flex-shrink-0 text-orange-500" />
              <div>
                <h3 className="mb-2 font-semibold text-orange-500">Important Notice</h3>
                <p className="text-sm text-muted-foreground">
                  By connecting your wallet and using ClickCreate, you agree to these terms. If you do not agree, please do not use our services.
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="prose prose-invert max-w-none space-y-12">
            {/* 1. Acceptance */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">1. Acceptance of Terms</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  These Terms of Service ("Terms") govern your access to and use of ClickCreate ("Service", "Platform", "we", "us", or "our"). By accessing or using the Service, you agree to be bound by these Terms and our Privacy Policy.
                </p>
                <p>
                  We reserve the right to modify these Terms at any time. Continued use of the Service after changes are posted constitutes acceptance of the modified Terms.
                </p>
              </div>
            </section>

            {/* 2. Service Description */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">2. Service Description</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  ClickCreate provides NFT analytics, holder tracking, and snapshot generation tools. The Service connects to public blockchain data and presents it in accessible formats.
                </p>
                <p>
                  We provide the Service "as is" without warranties of any kind. While we strive for accuracy, blockchain data may be incomplete, delayed, or incorrect due to factors outside our control.
                </p>
              </div>
            </section>

            {/* 3. User Accounts */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">3. User Accounts</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  To use certain features, you must connect a Web3 wallet. You are responsible for:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Maintaining the security of your private keys and wallet</li>
                  <li>All activities that occur under your wallet address</li>
                  <li>Ensuring you have the legal right to use the wallet</li>
                </ul>
                <p>
                  We never ask for or store your private keys, seed phrases, or passwords. Never share these with anyone claiming to be from ClickCreate.
                </p>
              </div>
            </section>

            {/* 4. Usage Limits */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">4. Usage Limits and Fair Use</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  To ensure fair access for all users, we implement the following limits:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Daily Sync Limit:</strong> 2 new collection syncs per day per wallet</li>
                  <li><strong>Rate Limits:</strong> API endpoints have rate limits to prevent abuse</li>
                  <li><strong>IP Binding:</strong> One wallet per IP address (24-hour window)</li>
                </ul>
                <p>
                  Violation of these limits or attempts to circumvent them may result in temporary or permanent suspension of your access.
                </p>
              </div>
            </section>

            {/* 5. Prohibited Activities */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">5. Prohibited Activities</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  You agree not to:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Use the Service for any illegal purpose or in violation of any laws</li>
                  <li>Attempt to gain unauthorized access to our systems or data</li>
                  <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                  <li>Use automated tools (bots, scrapers) without our written permission</li>
                  <li>Abuse rate limits or attempt to overload our infrastructure</li>
                  <li>Impersonate another user or wallet address</li>
                  <li>Transmit malware, viruses, or malicious code</li>
                  <li>Use the Service to spam, harass, or harm others</li>
                </ul>
              </div>
            </section>

            {/* 6. Intellectual Property */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">6. Intellectual Property</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  The Service, including its design, code, logos, and content, is owned by ClickCreate and protected by copyright, trademark, and other intellectual property laws.
                </p>
                <p>
                  Blockchain data accessed through our Service is publicly available. You retain ownership of any data you generate (snapshots, exports), but we may use anonymized, aggregated data for platform improvement.
                </p>
              </div>
            </section>

            {/* 7. Data Accuracy */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">7. Data Accuracy and Disclaimers</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  While we strive for accuracy, we do not guarantee that:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Blockchain data is complete or up-to-date</li>
                  <li>NFT metadata is accurate or available</li>
                  <li>The Service will be uninterrupted or error-free</li>
                  <li>Results will meet your specific requirements</li>
                </ul>
                <p>
                  <strong>You use the Service at your own risk.</strong> Always verify critical data independently before making important decisions.
                </p>
              </div>
            </section>

            {/* 8. Limitation of Liability */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">8. Limitation of Liability</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  To the maximum extent permitted by law, ClickCreate and its team members shall not be liable for:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Any indirect, incidental, special, or consequential damages</li>
                  <li>Loss of profits, data, or business opportunities</li>
                  <li>Damages resulting from inaccurate data or service interruptions</li>
                  <li>Any losses related to cryptocurrency, NFTs, or blockchain transactions</li>
                </ul>
                <p>
                  Our total liability for any claim arising from these Terms or the Service shall not exceed $100 USD.
                </p>
              </div>
            </section>

            {/* 9. Indemnification */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">9. Indemnification</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  You agree to indemnify and hold harmless ClickCreate, its team members, and affiliates from any claims, damages, liabilities, and expenses (including legal fees) arising from:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Your use of the Service</li>
                  <li>Your violation of these Terms</li>
                  <li>Your violation of any third-party rights</li>
                  <li>Any actions taken based on data from our Service</li>
                </ul>
              </div>
            </section>

            {/* 10. Termination */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">10. Termination</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  We reserve the right to suspend or terminate your access to the Service at any time, for any reason, including violation of these Terms.
                </p>
                <p>
                  You may stop using the Service at any time by disconnecting your wallet. Contact us to request deletion of your account and associated data.
                </p>
              </div>
            </section>

            {/* 11. Governing Law */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">11. Governing Law</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  These Terms are governed by and construed in accordance with the laws of the jurisdiction where ClickCreate operates, without regard to conflict of law principles.
                </p>
                <p>
                  Any disputes arising from these Terms or the Service shall be resolved through binding arbitration, except where prohibited by law.
                </p>
              </div>
            </section>

            {/* 12. Changes to Service */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">12. Changes to the Service</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  We reserve the right to modify, suspend, or discontinue any part of the Service at any time without notice. We are not liable for any modification, suspension, or discontinuance.
                </p>
              </div>
            </section>

            {/* 13. Contact */}
            <section>
              <h2 className="mb-4 text-2xl font-bold">13. Contact Information</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  If you have questions about these Terms, please contact us:
                </p>
                <div className="rounded-lg border border-border bg-card p-6 not-prose">
                  <div className="space-y-2 text-sm">
                    <p><strong>Email:</strong> legal@clickcreate.io</p>
                    <p><strong>Website:</strong> <Link href="/" className="text-primary hover:underline">snapshot.clickcreate.io</Link></p>
                    <p><strong>Support:</strong> <Link href="/contact" className="text-primary hover:underline">Contact Page</Link></p>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 rounded-lg border border-border bg-gradient-to-br from-primary/10 to-accent/10 p-8 text-center">
            <h2 className="mb-4 text-xl font-bold">Questions About These Terms?</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              We're happy to clarify any part of our Terms of Service.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
