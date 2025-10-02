'use client'

import { useParams } from 'next/navigation'
import { ContractMonitor } from '@/components/contracts/ContractMonitor'

export default function ContractMonitorPage() {
  const params = useParams()
  const contractAddress = params.address as string

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Live Monitor</h1>
        <p className="text-muted-foreground">
          Real-time monitoring of blockchain events for this contract
        </p>
      </div>
      
      <ContractMonitor contractAddress={contractAddress} />
    </div>
  )
}