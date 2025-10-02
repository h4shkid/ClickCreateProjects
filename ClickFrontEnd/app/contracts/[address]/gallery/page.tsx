'use client'

import { useParams } from 'next/navigation'
import { ContractGallery } from '@/components/contracts/ContractGallery'

export default function ContractGalleryPage() {
  const params = useParams()
  const contractAddress = params.address as string

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Gallery</h1>
        <p className="text-muted-foreground">
          Browse NFTs and collection metadata for this contract
        </p>
      </div>
      
      <ContractGallery contractAddress={contractAddress} />
    </div>
  )
}