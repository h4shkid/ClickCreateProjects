/**
 * ENS (Ethereum Name Service) Resolver
 * Resolves wallet addresses to ENS names
 */

import { normalize } from 'viem/ens'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

// Create a public client for ENS lookups
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http()
})

// Cache for ENS names to reduce API calls
const ensCache = new Map<string, string | null>()

/**
 * Resolve an Ethereum address to its ENS name
 * @param address - Ethereum address (0x...)
 * @returns ENS name or null if not found
 */
export async function resolveENS(address: string): Promise<string | null> {
  try {
    // Check cache first
    if (ensCache.has(address.toLowerCase())) {
      return ensCache.get(address.toLowerCase()) || null
    }

    // Resolve ENS name
    const ensName = await publicClient.getEnsName({
      address: address as `0x${string}`
    })

    // Cache the result
    ensCache.set(address.toLowerCase(), ensName)

    return ensName
  } catch (error) {
    console.error('ENS resolution error:', error)
    ensCache.set(address.toLowerCase(), null)
    return null
  }
}

/**
 * Resolve multiple addresses to ENS names in batch
 * @param addresses - Array of Ethereum addresses
 * @returns Map of address to ENS name
 */
export async function resolveENSBatch(addresses: string[]): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>()

  // Use Promise.allSettled to handle failures gracefully
  const promises = addresses.map(async (address) => {
    const ensName = await resolveENS(address)
    return { address, ensName }
  })

  const settled = await Promise.allSettled(promises)

  settled.forEach((result) => {
    if (result.status === 'fulfilled') {
      results.set(result.value.address.toLowerCase(), result.value.ensName)
    }
  })

  return results
}

/**
 * Format address with ENS name if available
 * @param address - Ethereum address
 * @param ensName - ENS name (optional)
 * @returns Formatted string
 */
export function formatAddressWithENS(address: string, ensName: string | null): string {
  if (ensName) {
    return `${ensName} (${address.slice(0, 6)}...${address.slice(-4)})`
  }
  return address
}

/**
 * Clear ENS cache
 */
export function clearENSCache(): void {
  ensCache.clear()
}
