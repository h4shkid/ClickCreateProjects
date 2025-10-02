import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  mainnet,
  polygon,
  arbitrum,
  base,
} from 'wagmi/chains'
import { defineChain } from 'viem'

// Define Shape chain
const shape = defineChain({
  id: 360,
  name: 'Shape',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://mainnet.shape.network'] },
  },
  blockExplorers: {
    default: {
      name: 'Shape Explorer',
      url: 'https://shapescan.xyz',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11',
      blockCreated: 761_926,
    },
  },
  iconUrl: '/shape-icon.png',
  iconBackground: '#000000',
})

export const wagmiConfig = getDefaultConfig({
  appName: 'ClickFrontEnd NFT Analytics',
  projectId: 'ab0ba184122cc8c74ac00c9b82f5e863',
  chains: [mainnet, polygon, arbitrum, base, shape],
  ssr: true, // If your dApp uses server side rendering (SSR)
})