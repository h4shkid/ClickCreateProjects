'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, Home } from 'lucide-react'
import { useContract } from '@/lib/contracts/ContractContext'

interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[]
  contractAddress?: string
  contractName?: string
}

export function Breadcrumbs({ items, contractAddress, contractName }: BreadcrumbsProps) {
  const pathname = usePathname()
  const { contract } = useContract()
  
  // Use contract from context if available
  const displayName = contractName || contract?.name
  
  // Auto-generate breadcrumbs if not provided
  const breadcrumbItems = items || generateBreadcrumbs(pathname, contractAddress, displayName)

  if (breadcrumbItems.length <= 1) {
    return null // Don't show breadcrumbs for home page or single-level pages
  }

  return (
    <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
      {breadcrumbItems.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <ChevronRight className="w-4 h-4 mx-2" />}
          
          {index === 0 && (
            <Home className="w-4 h-4 mr-1" />
          )}
          
          {item.href && !item.isActive ? (
            <Link 
              href={item.href}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className={item.isActive ? 'text-foreground font-medium' : ''}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}

function generateBreadcrumbs(pathname: string, contractAddress?: string, contractName?: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean)
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Home', href: '/' }
  ]

  // Handle contract-specific pages
  if (segments[0] === 'contracts' && segments[1]) {
    breadcrumbs.push({
      label: 'Discover',
      href: '/contracts'
    })
    
    const address = segments[1]
    const displayName = contractName ? 
      `${contractName} (${formatAddress(address)})` : 
      formatAddress(address)
    
    breadcrumbs.push({
      label: displayName,
      href: `/contracts/${address}`
    })

    // Add specific page if there's a third segment
    if (segments[2]) {
      const pageMap: Record<string, string> = {
        'analytics': 'Analytics',
        'gallery': 'Gallery', 
        'snapshot': 'Snapshot',
        'holders': 'Holders',
        'monitor': 'Monitor'
      }
      
      breadcrumbs.push({
        label: pageMap[segments[2]] || segments[2],
        isActive: true
      })
    }
  } 
  // Handle legacy global pages
  else if (segments.length > 0) {
    const pageMap: Record<string, string> = {
      'contracts': 'Discover',
      'snapshot': 'Snapshot',
      'analytics': 'Analytics',
      'gallery': 'Gallery',
      'monitor': 'Monitor'
    }
    
    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1
      breadcrumbs.push({
        label: pageMap[segment] || segment,
        href: isLast ? undefined : `/${segments.slice(0, index + 1).join('/')}`,
        isActive: isLast
      })
    })
  }

  return breadcrumbs
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}