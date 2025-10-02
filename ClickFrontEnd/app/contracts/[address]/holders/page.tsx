'use client'

import { useParams } from 'next/navigation'
import { ContractHolders } from '@/components/contracts/ContractHolders'

export default function ContractHoldersPage() {
  const params = useParams()
  const contractAddress = params.address as string

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Holders</h1>
        <p className="text-muted-foreground">
          Analyze token holders and distribution patterns for this contract
        </p>
      </div>
      
      <ContractHolders contractAddress={contractAddress} />
    </div>
  )
}