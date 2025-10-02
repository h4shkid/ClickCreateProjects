'use client'

import { useParams } from 'next/navigation'
import { ContractAnalytics } from '@/components/contracts/ContractAnalytics'

export default function ContractAnalyticsPage() {
  const params = useParams()
  const contractAddress = params.address as string

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          Detailed analytics and insights for this contract
        </p>
      </div>
      
      <ContractAnalytics contractAddress={contractAddress} />
    </div>
  )
}