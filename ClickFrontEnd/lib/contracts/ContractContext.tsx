'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface ContractMetadata {
  address: string
  name: string
  symbol: string
  contractType: 'ERC721' | 'ERC1155'
  chainId: number
  isVerified: boolean
  description?: string
  imageUrl?: string
  websiteUrl?: string
  twitterUrl?: string
  discordUrl?: string
  holderCount?: number
  totalSupply?: string
}

interface ContractContextValue {
  contract: ContractMetadata | null
  isLoading: boolean
  error: string | null
  refresh: () => void
}

const ContractContext = createContext<ContractContextValue | undefined>(undefined)

export function useContract() {
  const context = useContext(ContractContext)
  if (context === undefined) {
    throw new Error('useContract must be used within a ContractProvider')
  }
  return context
}

interface ContractProviderProps {
  address: string
  children: ReactNode
}

export function ContractProvider({ address, children }: ContractProviderProps) {
  const [contract, setContract] = useState<ContractMetadata | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContract = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch contract details from our API
      const response = await fetch(`/api/contracts/${address}`)
      
      if (!response.ok) {
        throw new Error('Contract not found')
      }

      const data = await response.json()
      
      if (data.success) {
        setContract(data.contract)
      } else {
        throw new Error(data.error || 'Failed to fetch contract')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setContract(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (address) {
      fetchContract()
    }
  }, [address])

  const value: ContractContextValue = {
    contract,
    isLoading,
    error,
    refresh: fetchContract
  }

  return (
    <ContractContext.Provider value={value}>
      {children}
    </ContractContext.Provider>
  )
}