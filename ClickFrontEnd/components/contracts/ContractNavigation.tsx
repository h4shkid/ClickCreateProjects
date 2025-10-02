'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  BarChart3, 
  Images, 
  Camera, 
  Activity, 
  Users, 
  Home,
  ArrowLeft
} from 'lucide-react'

interface ContractNavigationProps {
  contractAddress: string
}

export function ContractNavigation({ contractAddress }: ContractNavigationProps) {
  const pathname = usePathname()

  const navItems = [
    {
      label: 'Overview',
      href: `/contracts/${contractAddress}`,
      icon: Home,
      exact: true
    },
    {
      label: 'Analytics',
      href: `/contracts/${contractAddress}/analytics`,
      icon: BarChart3
    },
    {
      label: 'Gallery',
      href: `/contracts/${contractAddress}/gallery`,
      icon: Images
    },
    {
      label: 'Snapshot',
      href: `/contracts/${contractAddress}/snapshot`,
      icon: Camera
    },
    {
      label: 'Monitor',
      href: `/contracts/${contractAddress}/monitor`,
      icon: Activity
    },
    {
      label: 'Holders',
      href: `/contracts/${contractAddress}/holders`,
      icon: Users
    }
  ]

  const isActive = (href: string, exact = false) => {
    if (exact) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="border-b border-border bg-card/20 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4">
        {/* Back to Discovery */}
        <div className="py-3 border-b border-border/50">
          <Link 
            href="/contracts"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contract Discovery
          </Link>
        </div>

        {/* Contract Navigation Tabs */}
        <nav className="flex overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href, item.exact)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap
                  ${active
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}