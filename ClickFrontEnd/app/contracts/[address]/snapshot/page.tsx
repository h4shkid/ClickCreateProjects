'use client'

import { useParams } from 'next/navigation'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Shield, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { ContractSnapshot } from '@/components/contracts/ContractSnapshot'

// Authorized wallet address for Snapshot page access
const AUTHORIZED_SNAPSHOT_WALLET = '0x4Ae8B436e50f762Fa8fad29Fd548b375fEe968AC'

export default function ContractSnapshotPage() {
  const params = useParams()
  const contractAddress = params.address as string
  const { isConnected, address } = useAccount()
  
  // Check if connected wallet is authorized for Snapshot access
  const isAuthorizedForSnapshot = address?.toLowerCase() === AUTHORIZED_SNAPSHOT_WALLET.toLowerCase()
  
  // If not connected or not authorized, show access control message
  if (!isConnected || !isAuthorizedForSnapshot) {
    return (
      <div className="min-h-screen pt-24 px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="card-glass max-w-md w-full text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Shield className="w-8 h-8 text-orange-400" />
                </div>
              </div>
              
              <h1 className="text-2xl font-bold mb-4">Access Restricted</h1>
              
              {!isConnected ? (
                <>
                  <p className="text-muted-foreground mb-6">
                    Please connect your wallet to access the Snapshot page.
                  </p>
                  <div className="flex justify-center">
                    <ConnectButton />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-muted-foreground mb-4">
                    This page is restricted to authorized internal use only.
                  </p>
                  <p className="text-sm text-muted-foreground/70 mb-6">
                    Connected: <span className="font-mono text-xs">{address}</span>
                  </p>
                  <div className="text-sm text-orange-400">
                    Access denied - unauthorized wallet address
                  </div>
                </>
              )}
              
              <div className="mt-6">
                <Link 
                  href={`/contracts/${contractAddress}`}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Contract
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Snapshot</h1>
        <p className="text-muted-foreground">
          Generate current and historical snapshots for this contract
        </p>
      </div>
      
      <ContractSnapshot contractAddress={contractAddress} />
    </div>
  )
}