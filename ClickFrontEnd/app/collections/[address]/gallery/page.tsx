'use client'

import { useParams } from 'next/navigation'
import { ContractGallery } from '@/components/contracts/ContractGallery'

export default function CollectionGalleryPage() {
  const params = useParams()
  const contractAddress = params.address as string

  return (
    <div className="min-h-screen pt-24 px-6 lg:px-8">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Collection <span className="gradient-text">Gallery</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Browse all NFTs in this collection with metadata and visual presentations
          </p>
        </div>

        <ContractGallery contractAddress={contractAddress} />
      </div>
    </div>
  )
}
