'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAuth } from '@/lib/hooks/useAuth'
import { useAccount } from 'wagmi'

// Authorized wallet address for Snapshot page access
const AUTHORIZED_SNAPSHOT_WALLET = '0x4Ae8B436e50f762Fa8fad29Fd548b375fEe968AC'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/snapshot', label: 'Snapshot' },
  { href: '/collections', label: 'Collections' },
  { href: '/profile', label: 'Profile' },
]

export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const { isAuthenticated, user } = useAuth()
  const { isConnected, address } = useAccount()
  
  // Check if connected wallet is authorized for Snapshot access
  const isAuthorizedForSnapshot = address?.toLowerCase() === AUTHORIZED_SNAPSHOT_WALLET.toLowerCase()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className={`fixed top-0 z-50 w-full transition-all duration-300 ${
      scrolled ? 'glass border-b border-border/50' : ''
    }`}>
      <nav className="container mx-auto px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center space-x-3">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-accent opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-background">C</span>
              </div>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              ClickCreate
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems
              .filter(item => {
                // Show Snapshot page only for authorized wallet
                if (item.href === '/snapshot') {
                  return isAuthorizedForSnapshot
                }
                // Show profile only for connected wallet users
                // Collections is now public - everyone can see
                if (item.href === '/profile') {
                  return isConnected
                }
                return true
              })
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    pathname === item.href
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            <ConnectButton
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
              showBalance={{
                smallScreen: false,
                largeScreen: true,
              }}
            />
            {isAuthenticated && user?.username && (
              <div className="text-sm text-muted-foreground">
                Welcome, {user.username}
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-card/50 transition-colors"
            aria-label="Toggle menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden animate-slide-in">
            <div className="space-y-1 pb-4">
              {navItems
                .filter(item => {
                  // Show Snapshot page only for authorized wallet
                  if (item.href === '/snapshot') {
                    return isAuthorizedForSnapshot
                  }
                  // Show profile and collections only for connected wallet users
                  if (item.href === '/my-collections' || item.href === '/profile') {
                    return isConnected
                  }
                  return true
                })
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      pathname === item.href
                        ? 'text-primary bg-primary/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              <div className="pt-4 space-y-2">
                <div className="flex justify-center">
                  <ConnectButton
                    accountStatus="address"
                    showBalance={false}
                  />
                </div>
                {isAuthenticated && user?.username && (
                  <div className="text-center text-sm text-muted-foreground">
                    Welcome, {user.username}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}