/**
 * Snapshot Presets
 * Pre-configured queries for common artist use cases
 */

import { SnapshotQuery, TokenSelection, HolderFilters } from './advanced-query-builder'

export interface SnapshotPreset {
  id: string
  name: string
  description: string
  category: 'airdrop' | 'whitelist' | 'analysis' | 'marketing' | 'custom'
  icon: string  // Lucide icon name
  query: Partial<SnapshotQuery>
  requiresTokenInput?: boolean  // If true, user must specify tokens
  recommended: boolean
  examples?: string[]
}

export const SNAPSHOT_PRESETS: SnapshotPreset[] = [
  // ============================================
  // AIRDROP CAMPAIGNS
  // ============================================
  {
    id: 'airdrop-all-holders',
    name: 'All Holders (Airdrop)',
    description: 'Every wallet holding at least 1 token - perfect for general airdrops',
    category: 'airdrop',
    icon: 'Gift',
    recommended: true,
    query: {
      tokenSelection: { mode: 'all' },
      holderFilters: { minBalance: 1 },
      sortBy: 'balance',
      sortOrder: 'desc'
    },
    examples: [
      'Airdrop to all community members',
      'General token distribution',
      'Community rewards'
    ]
  },
  {
    id: 'airdrop-specific-tokens',
    name: 'Specific Token Holders',
    description: 'Holders of particular token IDs - target specific collections',
    category: 'airdrop',
    icon: 'Target',
    requiresTokenInput: true,
    recommended: true,
    query: {
      tokenSelection: { mode: 'any' },
      holderFilters: { minBalance: 1 },
      sortBy: 'balance',
      sortOrder: 'desc'
    },
    examples: [
      'Airdrop to Season 1 holders',
      'Reward specific artwork owners',
      'Target rare token holders'
    ]
  },
  {
    id: 'airdrop-whales',
    name: 'Whale Holders',
    description: 'Top holders with significant balances - reward loyal collectors',
    category: 'airdrop',
    icon: 'TrendingUp',
    recommended: false,
    query: {
      tokenSelection: { mode: 'all' },
      holderFilters: { minBalance: 10 },
      sortBy: 'balance',
      sortOrder: 'desc',
      limit: 100
    },
    examples: [
      'VIP airdrops for top collectors',
      'Whale appreciation rewards',
      'Large holder incentives'
    ]
  },
  {
    id: 'airdrop-diverse-collectors',
    name: 'Diverse Collectors',
    description: 'Holders with multiple different tokens - reward collection diversity',
    category: 'airdrop',
    icon: 'Layers',
    recommended: false,
    query: {
      tokenSelection: { mode: 'all' },
      holderFilters: { minTokenCount: 5 },
      sortBy: 'tokenCount',
      sortOrder: 'desc'
    },
    examples: [
      'Reward diverse collectors',
      'Incentivize collection building',
      'Target multi-token holders'
    ]
  },

  // ============================================
  // WHITELIST GENERATION
  // ============================================
  {
    id: 'whitelist-complete-sets',
    name: 'Complete Set Holders',
    description: 'Wallets owning ALL specified tokens - strictest whitelist criteria',
    category: 'whitelist',
    icon: 'CheckCircle',
    requiresTokenInput: true,
    recommended: true,
    query: {
      tokenSelection: { mode: 'exact' },
      holderFilters: { hasCompleteSets: true },
      sortBy: 'balance',
      sortOrder: 'desc'
    },
    examples: [
      'Exclusive whitelist for complete collection',
      'Season completion rewards',
      'Full set holder benefits'
    ]
  },
  {
    id: 'whitelist-minimum-tokens',
    name: 'Minimum Token Count',
    description: 'Holders with at least N different tokens - flexible whitelist',
    category: 'whitelist',
    icon: 'ListChecks',
    recommended: true,
    query: {
      tokenSelection: { mode: 'all' },
      holderFilters: { minTokenCount: 3 },
      sortBy: 'tokenCount',
      sortOrder: 'desc'
    },
    examples: [
      'Whitelist for active collectors',
      'Multi-token holder benefits',
      'Tiered whitelist levels'
    ]
  },
  {
    id: 'whitelist-og-holders',
    name: 'OG Holders (Historical)',
    description: 'Early supporters at a specific date - reward original community',
    category: 'whitelist',
    icon: 'Crown',
    recommended: false,
    query: {
      tokenSelection: { mode: 'all' },
      timeFrame: { type: 'historical' },
      holderFilters: { minBalance: 1 },
      sortBy: 'balance',
      sortOrder: 'desc'
    },
    examples: [
      'OG holder recognition',
      'Early supporter rewards',
      'Historical holder snapshot'
    ]
  },

  // ============================================
  // HOLDER ANALYSIS
  // ============================================
  {
    id: 'analysis-token-distribution',
    name: 'Token Distribution',
    description: 'Complete holder list with balance distribution - full analytics',
    category: 'analysis',
    icon: 'BarChart3',
    recommended: true,
    query: {
      tokenSelection: { mode: 'all' },
      sortBy: 'balance',
      sortOrder: 'desc'
    },
    examples: [
      'Analyze holder distribution',
      'Calculate Gini coefficient',
      'Study collection metrics'
    ]
  },
  {
    id: 'analysis-top-100',
    name: 'Top 100 Holders',
    description: 'Largest holders by balance - understand concentration',
    category: 'analysis',
    icon: 'Medal',
    recommended: false,
    query: {
      tokenSelection: { mode: 'all' },
      sortBy: 'balance',
      sortOrder: 'desc',
      limit: 100
    },
    examples: [
      'Identify top collectors',
      'Analyze whale concentration',
      'Track major holders'
    ]
  },
  {
    id: 'analysis-specific-range',
    name: 'Token Range Analysis',
    description: 'Analyze specific token ID range - segment analysis',
    category: 'analysis',
    icon: 'Filter',
    recommended: false,
    query: {
      tokenSelection: { mode: 'range' },
      sortBy: 'balance',
      sortOrder: 'desc'
    },
    examples: [
      'Analyze specific series',
      'Study token rarity tiers',
      'Compare token segments'
    ]
  },

  // ============================================
  // MARKETING & ENGAGEMENT
  // ============================================
  {
    id: 'marketing-new-holders',
    name: 'New Holders (Recent)',
    description: 'Holders who joined recently - target new community members',
    category: 'marketing',
    icon: 'UserPlus',
    recommended: false,
    query: {
      tokenSelection: { mode: 'all' },
      holderFilters: { minBalance: 1 },
      sortBy: 'balance',
      sortOrder: 'desc'
    },
    examples: [
      'Welcome new holders',
      'Onboarding campaigns',
      'New member engagement'
    ]
  },
  {
    id: 'marketing-single-token',
    name: 'Single Token Holders',
    description: 'Holders with exactly 1 token - upsell opportunities',
    category: 'marketing',
    icon: 'User',
    recommended: false,
    query: {
      tokenSelection: { mode: 'all' },
      holderFilters: {
        minBalance: 1,
        maxBalance: 1
      },
      sortBy: 'address',
      sortOrder: 'asc'
    },
    examples: [
      'Upsell to single-token holders',
      'Encourage collection building',
      'Cross-sell campaigns'
    ]
  },

  // ============================================
  // CUSTOM QUERIES
  // ============================================
  {
    id: 'custom-exact-match',
    name: 'Exact Token Match',
    description: 'Holders with ONLY specified tokens (no other tokens)',
    category: 'custom',
    icon: 'Sparkles',
    requiresTokenInput: true,
    recommended: false,
    query: {
      tokenSelection: { mode: 'exact' },
      sortBy: 'balance',
      sortOrder: 'desc'
    },
    examples: [
      'Pure Season 1 holders',
      'Exclusive token combination',
      'Specialized holder segment'
    ]
  },
  {
    id: 'custom-exclude-tokens',
    name: 'Exclude Specific Tokens',
    description: 'Holders excluding certain token IDs - negative filtering',
    category: 'custom',
    icon: 'Filter',
    requiresTokenInput: true,
    recommended: false,
    query: {
      tokenSelection: { mode: 'custom' },
      sortBy: 'balance',
      sortOrder: 'desc'
    },
    examples: [
      'Exclude special edition holders',
      'Filter out specific tokens',
      'Inverse token selection'
    ]
  }
]

/**
 * Get preset by ID
 */
export function getPreset(id: string): SnapshotPreset | undefined {
  return SNAPSHOT_PRESETS.find(preset => preset.id === id)
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: SnapshotPreset['category']): SnapshotPreset[] {
  return SNAPSHOT_PRESETS.filter(preset => preset.category === category)
}

/**
 * Get recommended presets
 */
export function getRecommendedPresets(): SnapshotPreset[] {
  return SNAPSHOT_PRESETS.filter(preset => preset.recommended)
}

/**
 * Build query from preset with user inputs
 */
export function buildQueryFromPreset(
  preset: SnapshotPreset,
  contractAddress: string,
  userInputs?: {
    tokenIds?: string[]
    date?: string
    blockNumber?: number
    customFilters?: Partial<HolderFilters>
  }
): SnapshotQuery {
  const query: SnapshotQuery = {
    contractAddress,
    tokenSelection: {
      mode: preset.query.tokenSelection!.mode,
      ...preset.query.tokenSelection
    },
    holderFilters: preset.query.holderFilters,
    timeFrame: preset.query.timeFrame,
    sortBy: preset.query.sortBy || 'balance',
    sortOrder: preset.query.sortOrder || 'desc',
    limit: preset.query.limit,
    offset: preset.query.offset
  }

  // Apply user inputs
  if (userInputs) {
    if (userInputs.tokenIds) {
      query.tokenSelection.tokenIds = userInputs.tokenIds
    }

    if (userInputs.date && query.timeFrame) {
      query.timeFrame.date = userInputs.date
    }

    if (userInputs.blockNumber && query.timeFrame) {
      query.timeFrame.blockNumber = userInputs.blockNumber
    }

    if (userInputs.customFilters) {
      query.holderFilters = {
        ...query.holderFilters,
        ...userInputs.customFilters
      }
    }
  }

  return query
}

/**
 * Get preset categories with counts
 */
export function getPresetCategories(): Array<{
  category: SnapshotPreset['category']
  name: string
  count: number
  description: string
}> {
  const categories = [
    {
      category: 'airdrop' as const,
      name: 'Airdrop Campaigns',
      description: 'Token distribution and community rewards'
    },
    {
      category: 'whitelist' as const,
      name: 'Whitelist Generation',
      description: 'Exclusive access and eligibility lists'
    },
    {
      category: 'analysis' as const,
      name: 'Holder Analysis',
      description: 'Distribution metrics and insights'
    },
    {
      category: 'marketing' as const,
      name: 'Marketing & Engagement',
      description: 'Community targeting and growth'
    },
    {
      category: 'custom' as const,
      name: 'Custom Queries',
      description: 'Advanced filtering and combinations'
    }
  ]

  return categories.map(cat => ({
    ...cat,
    count: SNAPSHOT_PRESETS.filter(p => p.category === cat.category).length
  }))
}
