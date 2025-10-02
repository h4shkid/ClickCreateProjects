'use client'

import Image from 'next/image'
import { CheckCircle, ExternalLink, Copy, Heart } from 'lucide-react'
import { useContract } from '@/lib/contracts/ContractContext'
import { ContractSwitcher } from './ContractSwitcher'
import { useState } from 'react'

export function ContractHeader() {
  const { contract, isLoading, error } = useContract()
  const [copied, setCopied] = useState(false)
  const [favorited, setFavorited] = useState(false)

  const handleCopyAddress = async () => {
    if (contract?.address) {
      await navigator.clipboard.writeText(contract.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleOpenSea = () => {
    if (contract?.address && contract?.chainId) {
      const openseaUrl = contract.chainId === 1 
        ? `https://opensea.io/assets/ethereum/${contract.address}`
        : `https://opensea.io/collection/${contract.address}`
      window.open(openseaUrl, '_blank')
    }
  }

  const getChainIcon = (chainId: number) => {
    switch (chainId) {
      case 1:
        return (
          <div className="group/icon relative">
            <svg className="w-5 h-5 text-blue-500 cursor-help" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/>
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
              Ethereum
            </div>
          </div>
        )
      case 137:
        return (
          <div className="group/icon relative">
            <svg className="w-5 h-5 text-purple-500 cursor-help" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0L1.608 6v12L12 24l10.392-6V6L12 0zm-1.575 4.5L18 8.25v7.5l-7.575 3.75L18 8.25v7.5l-7.575 3.75L2.425 15.75v-7.5L10.425 4.5z"/>
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">
              Polygon
            </div>
          </div>
        )
      default:
        return (
          <span className="text-xs text-muted-foreground">
            Chain {chainId}
          </span>
        )
    }
  }

  if (isLoading) {
    return (
      <div className="bg-card/20 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-background/50 rounded-xl animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-background/50 rounded animate-pulse" />
              <div className="h-4 w-96 bg-background/50 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-card/20 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Contract Not Found</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!contract) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-card/40 to-card/20 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Left Side - Contract Info */}
          <div className="flex items-start gap-4 flex-1">
            {/* Contract Logo */}
            <div className="relative">
              {contract.imageUrl ? (
                <div className="w-16 h-16 relative rounded-xl overflow-hidden bg-background shadow-lg ring-2 ring-border/50 flex-shrink-0">
                  <Image
                    src={contract.imageUrl}
                    alt={contract.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-border/50">
                  <span className="text-2xl font-bold text-primary">
                    {contract.name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
            </div>

            {/* Contract Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-foreground truncate">
                  {contract.name}
                </h1>
                <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-full flex items-center gap-1 font-medium">
                  {contract.contractType}
                  <div className="scale-75">
                    {getChainIcon(contract.chainId)}
                  </div>
                </span>
                {contract.isVerified && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
              </div>

              {/* Address */}
              <div className="flex items-center gap-2 mb-3">
                <code className="text-sm text-muted-foreground font-mono bg-background/50 px-3 py-1 rounded-lg border border-border/50">
                  {contract.address}
                </code>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              {contract.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {contract.description}
                </p>
              )}

              {/* Stats */}
              {contract.holderCount && (
                <div className="flex items-center gap-4 mt-3 text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="font-medium">{contract.holderCount.toLocaleString()}</span>
                    <span>holders</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center gap-3">
            {/* Contract Switcher */}
            <ContractSwitcher currentAddress={contract.address} />
            {contract.websiteUrl && (
              <a
                href={contract.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 border border-border/50 hover:border-primary/50"
                title="Visit website"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            )}

            <button
              onClick={handleOpenSea}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-background/50 border border-border/50 hover:border-primary/50 font-medium"
              title="View on OpenSea"
            >
              OpenSea
            </button>

            <button
              onClick={() => setFavorited(!favorited)}
              className={`p-3 transition-colors rounded-lg border border-border/50 hover:border-primary/50 ${
                favorited 
                  ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }`}
              title={favorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart className={`w-5 h-5 ${favorited ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>

        {/* Copy Notification */}
        {copied && (
          <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-lg text-sm">
            Address copied!
          </div>
        )}
      </div>
    </div>
  )
}