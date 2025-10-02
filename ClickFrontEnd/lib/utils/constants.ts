// Core constants for the NFT Snapshot Tool

export const APP_NAME = 'NFT Snapshot Tool';

export const CHAIN_CONFIG = {
  mainnet: {
    id: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/',
  },
} as const;

export const BLOCK_RANGE = {
  DEFAULT_CHUNK_SIZE: 1000,
  MAX_CHUNK_SIZE: 5000,
  MIN_CHUNK_SIZE: 100,
} as const;

export const CACHE_CONFIG = {
  SNAPSHOT_TTL: 15 * 60 * 1000, // 15 minutes
  METADATA_TTL: 60 * 60 * 1000, // 1 hour
} as const;