'use client'

import { useState, useEffect } from 'react'
import { Image as ImageIcon } from 'lucide-react'

interface NFTImageProps {
  src?: string
  alt: string
  className?: string
  fallbackText?: string
  onLoad?: () => void
  onError?: () => void
}

export default function NFTImage({ 
  src, 
  alt, 
  className = '', 
  fallbackText,
  onLoad,
  onError 
}: NFTImageProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)
  const [retryCount, setRetryCount] = useState(0)
  const [currentSrc, setCurrentSrc] = useState(src)
  const maxRetries = 3

  useEffect(() => {
    setImageError(false)
    setImageLoading(true)
    setRetryCount(0)
    setCurrentSrc(src)
  }, [src])

  const handleImageError = () => {
    if (retryCount < maxRetries && src) {
      // Retry with a delay
      setTimeout(() => {
        setRetryCount(prev => prev + 1)
        // Add a cache-busting parameter for retry
        const separator = src.includes('?') ? '&' : '?'
        setCurrentSrc(`${src}${separator}retry=${retryCount + 1}`)
      }, 1000 * (retryCount + 1)) // Exponential backoff
    } else {
      setImageError(true)
      setImageLoading(false)
      onError?.()
    }
  }

  const handleImageLoad = () => {
    setImageLoading(false)
    setImageError(false)
    onLoad?.()
  }

  if (!src || imageError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20 ${className}`}>
        <ImageIcon className="w-16 h-16 text-primary/40 mb-2" />
        <span className="text-xs text-muted-foreground text-center px-2">
          {fallbackText || alt}
        </span>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {imageLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
          <div className="animate-pulse">
            <ImageIcon className="w-16 h-16 text-primary/40" />
          </div>
        </div>
      )}
      <img
        src={currentSrc}
        alt={alt}
        className={`w-full h-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  )
}