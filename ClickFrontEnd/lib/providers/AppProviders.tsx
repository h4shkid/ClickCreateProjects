'use client'

import React, { ReactNode } from 'react'
// DISABLED: Using WalletProvider with RainbowKit instead
// import { WagmiProvider } from 'wagmi'
// import { QueryClientProvider } from '@tanstack/react-query'
// import { wagmiConfig, queryClient } from '@/lib/wallet/config'

interface AppProvidersProps {
  children: ReactNode
}

// DISABLED: Using WalletProvider with RainbowKit instead
// export function AppProviders({ children }: AppProvidersProps) {
//   return (
//     <WagmiProvider config={wagmiConfig}>
//       <QueryClientProvider client={queryClient}>
//         {children}
//       </QueryClientProvider>
//     </WagmiProvider>
//   )
// }

// HOC for pages that require authentication
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    // This will be implemented with the useRequireAuth hook
    return <Component {...props} />
  }
}

// Context for global app state if needed
export const AppContext = React.createContext<{
  // Global state will go here if needed
}>({})

export function useAppContext() {
  const context = React.useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppContext provider')
  }
  return context
}