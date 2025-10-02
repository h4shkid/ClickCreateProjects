import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/layout/Navigation'
import Footer from '@/components/layout/Footer'
import { WalletProvider } from '@/lib/providers/WalletProvider'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'ClickCreate - NFT Snapshot & Analytics Platform',
  description: 'Generate instant holder snapshots, track real-time transfers, and analyze your NFT ecosystem with powerful analytics.',
  keywords: 'NFT, blockchain, analytics, snapshot, Ethereum, ERC-1155, holder tracking',
  authors: [{ name: 'ClickCreate' }],
  openGraph: {
    title: 'ClickCreate - NFT Snapshot & Analytics Platform',
    description: 'Generate instant holder snapshots and analyze your NFT ecosystem',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased custom-scrollbar">
        <WalletProvider>
          <div className="relative flex min-h-screen flex-col">
            <Navigation />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
          {/* Background effects */}
          <div className="fixed inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
            <div className="grid-pattern absolute inset-0 opacity-20" />
          </div>
        </WalletProvider>
      </body>
    </html>
  )
}