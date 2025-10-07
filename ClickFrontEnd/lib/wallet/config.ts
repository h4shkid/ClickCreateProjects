// Wallet integration configuration using Reown AppKit (formerly Web3Modal)
// DISABLED: Using RainbowKit instead to avoid WalletConnect initialization conflicts
// NOTE: Only keeping imports needed for utility functions at the end of this file
import { mainnet, polygon, arbitrum, base } from 'viem/chains'
// import { createAppKit } from '@reown/appkit'
// import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
// import { createConfig, http, WagmiProvider } from 'wagmi'
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// import { createSIWEConfig } from '@reown/appkit-siwe'

// Project configuration
// const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'your-project-id'

// Wagmi adapter (DISABLED)
// const wagmiAdapter = new WagmiAdapter({
//   networks: [mainnet, polygon, arbitrum, base],
//   projectId,
//   ssr: true
// })

// SIWE (Sign-In with Ethereum) configuration (DISABLED)
/*
const siweConfig = createSIWEConfig({
  // This function will be called when the user signs in
  createMessage: ({ nonce, address, chainId }) => {
    return `Welcome to Multi-Contract NFT Analytics Platform!

This request will not trigger a blockchain transaction or cost any gas fees.

Wallet address: ${address}
Chain ID: ${chainId}
Nonce: ${nonce}

By signing this message, you agree to our Terms of Service and Privacy Policy.`
  },
  
  // Verify the signature on our backend
  verifyMessage: async ({ message, signature, cacao }) => {
    try {
      const response = await fetch('/api/auth/verify-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          signature,
          cacao
        })
      })
      
      const result = await response.json()
      return result.success
    } catch (error) {
      console.error('SIWE verification failed:', error)
      return false
    }
  },
  
  // Get user session
  getSession: async () => {
    try {
      const response = await fetch('/api/auth/session')
      const session = await response.json()
      return session.success ? session.data : null
    } catch (error) {
      console.error('Failed to get session:', error)
      return null
    }
  },
  
  // Sign out user
  signOut: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      return true
    } catch (error) {
      console.error('Failed to sign out:', error)
      return false
    }
  }
})
*/

// Create the AppKit modal (DISABLED - using RainbowKit instead)
// This config is kept for reference but not initialized to avoid conflicts
// export const appKit = createAppKit({
//   adapters: [wagmiAdapter],
//   networks: [mainnet, polygon, arbitrum, base],
//   defaultNetwork: mainnet,
//   projectId,
//   siweConfig,
//   metadata: {
//     name: 'Multi-Contract NFT Analytics',
//     description: 'Universal NFT analytics platform for any ERC-721/ERC-1155 collection',
//     url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost:3000',
//     icons: ['/favicon.ico']
//   },
//   features: {
//     analytics: true, // Enable analytics
//     email: false, // Disable email auth for Web3-only experience
//     socials: [] // Disable social auth for Web3-only experience
//   },
//   themeMode: 'dark',
//   themeVariables: {
//     '--w3m-color-mix': '#FF6B35',
//     '--w3m-color-mix-strength': 20,
//     '--w3m-accent': '#FF6B35',
//     '--w3m-border-radius-master': '8px'
//   }
// })

// Export wagmi config (DISABLED - using RainbowKit config instead from lib/wagmi/config.ts)
// export const wagmiConfig = wagmiAdapter.wagmiConfig

// Export QueryClient for React Query (DISABLED - using WalletProvider's QueryClient instead)
// export const queryClient = new QueryClient({
//   defaultOptions: {
//     queries: {
//       staleTime: 60 * 1000, // 1 minute
//       retry: 2
//     }
//   }
// })

// Supported wallet types
export const SUPPORTED_WALLETS = [
  'MetaMask',
  'WalletConnect',
  'Coinbase Wallet',
  'Rainbow',
  'Trust Wallet'
] as const

// Chain configurations with RPC endpoints
export const CHAIN_CONFIGS = {
  [mainnet.id]: {
    ...mainnet,
    rpcUrls: {
      default: {
        http: [
          `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
          'https://ethereum.publicnode.com',
          'https://rpc.ankr.com/eth'
        ]
      }
    }
  },
  [polygon.id]: {
    ...polygon,
    rpcUrls: {
      default: {
        http: [
          `https://polygon-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
          'https://polygon.llamarpc.com',
          'https://rpc.ankr.com/polygon'
        ]
      }
    }
  },
  [arbitrum.id]: {
    ...arbitrum,
    rpcUrls: {
      default: {
        http: [
          `https://arb-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
          'https://arbitrum.llamarpc.com',
          'https://rpc.ankr.com/arbitrum'
        ]
      }
    }
  },
  [base.id]: {
    ...base,
    rpcUrls: {
      default: {
        http: [
          `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
          'https://mainnet.base.org',
          'https://rpc.ankr.com/base'
        ]
      }
    }
  }
} as const

// Utility functions
export function getChainName(chainId: number): string {
  const chain = Object.values(CHAIN_CONFIGS).find(c => c.id === chainId)
  return chain?.name || `Chain ${chainId}`
}

export function isChainSupported(chainId: number): boolean {
  return chainId in CHAIN_CONFIGS
}

export function getExplorerUrl(chainId: number, txHash?: string, address?: string): string {
  const chain = CHAIN_CONFIGS[chainId as keyof typeof CHAIN_CONFIGS]
  if (!chain?.blockExplorers?.default?.url) return '#'
  
  const baseUrl = chain.blockExplorers.default.url
  if (txHash) return `${baseUrl}/tx/${txHash}`
  if (address) return `${baseUrl}/address/${address}`
  return baseUrl
}