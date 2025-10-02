'use client'

import { useEffect, useRef, useState } from 'react'

interface StatsCardProps {
  label: string
  value: string
  trend: string
  delay?: number
}

export default function StatsCard({ label, value, trend, delay = 0 }: StatsCardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [count, setCount] = useState(0)
  const cardRef = useRef<HTMLDivElement>(null)
  
  const isPositive = trend.startsWith('+')
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''))
  // Extract only alphabetic suffixes (like K, M, B), not commas
  const suffix = value.replace(/[0-9.,\s]/g, '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay * 1000)
        }
      },
      { threshold: 0.1 }
    )

    if (cardRef.current) {
      observer.observe(cardRef.current)
    }

    return () => observer.disconnect()
  }, [delay])

  useEffect(() => {
    if (isVisible) {
      const duration = 2000 // 2 seconds
      const steps = 60
      const increment = numericValue / steps
      let current = 0

      const timer = setInterval(() => {
        current += increment
        if (current >= numericValue) {
          setCount(numericValue)
          clearInterval(timer)
        } else {
          setCount(current)
        }
      }, duration / steps)

      return () => clearInterval(timer)
    }
  }, [isVisible, numericValue])

  return (
    <div
      ref={cardRef}
      className={`card-glass transition-all duration-700 ${
        isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
    >
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground mb-2">{label}</span>
        <div className="flex items-end justify-between">
          <span className="text-2xl md:text-3xl font-bold gradient-text">
            {Math.round(count).toLocaleString()}{suffix}
          </span>
          <span className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {trend}
          </span>
        </div>
      </div>
    </div>
  )
}