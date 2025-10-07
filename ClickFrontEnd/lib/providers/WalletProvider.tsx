'use client'

import { useState } from 'react'
import '@rainbow-me/rainbowkit/styles.css'
import {
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit'
import { WagmiProvider } from 'wagmi'
import {
  QueryClientProvider,
  QueryClient,
} from '@tanstack/react-query'
import { wagmiConfig } from '../wagmi/config'

export function WalletProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // Create a client instance per component mount to avoid SSR issues
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Disable automatic refetching to prevent hydration issues
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        staleTime: 1000 * 60 * 60, // 1 hour
      },
    },
  }))

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#FF6B35',
            accentColorForeground: 'white',
            borderRadius: 'medium',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}