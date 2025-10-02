'use client'

import { useState, useEffect } from 'react'

interface FavoriteContract {
  address: string
  name: string
  contractType: string
  chainId: number
  addedAt: string
}

const FAVORITES_KEY = 'contract_favorites'

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteContract[]>([])
  const [loading, setLoading] = useState(true)

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY)
      if (stored) {
        setFavorites(JSON.parse(stored))
      }
    } catch (error) {
      console.warn('Failed to load favorites from localStorage:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Save favorites to localStorage whenever favorites change
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
      } catch (error) {
        console.warn('Failed to save favorites to localStorage:', error)
      }
    }
  }, [favorites, loading])

  const addFavorite = (contract: {
    address: string
    name: string
    contractType: string
    chainId: number
  }) => {
    const favorite: FavoriteContract = {
      ...contract,
      addedAt: new Date().toISOString()
    }

    setFavorites(prev => {
      // Check if already exists
      if (prev.some(f => f.address.toLowerCase() === contract.address.toLowerCase())) {
        return prev
      }
      return [...prev, favorite]
    })
  }

  const removeFavorite = (address: string) => {
    setFavorites(prev => 
      prev.filter(f => f.address.toLowerCase() !== address.toLowerCase())
    )
  }

  const isFavorite = (address: string) => {
    return favorites.some(f => f.address.toLowerCase() === address.toLowerCase())
  }

  const toggleFavorite = (contract: {
    address: string
    name: string
    contractType: string
    chainId: number
  }) => {
    if (isFavorite(contract.address)) {
      removeFavorite(contract.address)
    } else {
      addFavorite(contract)
    }
  }

  const getFavoritesByChain = (chainId?: number) => {
    if (chainId === undefined) return favorites
    return favorites.filter(f => f.chainId === chainId)
  }

  const getFavoritesByType = (contractType?: string) => {
    if (!contractType) return favorites
    return favorites.filter(f => f.contractType === contractType)
  }

  const clearAllFavorites = () => {
    setFavorites([])
  }

  return {
    favorites,
    loading,
    addFavorite,
    removeFavorite,
    isFavorite,
    toggleFavorite,
    getFavoritesByChain,
    getFavoritesByType,
    clearAllFavorites
  }
}