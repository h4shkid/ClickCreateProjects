-- NFT Snapshot Tool Database Schema

-- Events table: stores all blockchain events
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  block_timestamp INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- 'TransferSingle', 'TransferBatch', 'URI'
  operator TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  token_id TEXT NOT NULL, -- Store as TEXT for BigInt compatibility
  amount TEXT NOT NULL, -- Store as TEXT for BigInt compatibility
  batch_data TEXT, -- JSON for TransferBatch events
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(transaction_hash, log_index)
);

-- Current state table: tracks current holder balances
CREATE TABLE IF NOT EXISTS current_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL,
  token_id TEXT NOT NULL,
  balance TEXT NOT NULL, -- Store as TEXT for BigInt compatibility
  last_updated_block INTEGER NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(address, token_id)
);

-- Snapshot cache table: stores generated snapshots
CREATE TABLE IF NOT EXISTS snapshot_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT UNIQUE NOT NULL,
  block_number INTEGER,
  token_ids TEXT NOT NULL, -- JSON array
  holder_count INTEGER NOT NULL,
  total_supply TEXT NOT NULL,
  snapshot_data TEXT NOT NULL, -- JSON data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

-- NFT metadata table
CREATE TABLE IF NOT EXISTS nft_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT UNIQUE NOT NULL,
  name TEXT,
  description TEXT,
  image_url TEXT,
  external_url TEXT,
  attributes TEXT, -- JSON
  metadata_json TEXT, -- Full metadata JSON
  image_cached BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analytics summary table
CREATE TABLE IF NOT EXISTS analytics_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary_date DATE NOT NULL,
  token_id TEXT,
  unique_holders INTEGER,
  total_transfers INTEGER,
  total_volume TEXT,
  whale_count INTEGER, -- Holders with >1% of supply
  distribution_data TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(summary_date, token_id)
);

-- Sync status table: tracks blockchain sync progress
CREATE TABLE IF NOT EXISTS sync_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_address TEXT NOT NULL,
  last_synced_block INTEGER NOT NULL,
  sync_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'syncing', -- 'syncing', 'synced', 'error'
  error_message TEXT,
  UNIQUE(contract_address)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_block ON events(block_number);
CREATE INDEX IF NOT EXISTS idx_events_address_from ON events(from_address);
CREATE INDEX IF NOT EXISTS idx_events_address_to ON events(to_address);
CREATE INDEX IF NOT EXISTS idx_events_token ON events(token_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(block_timestamp);

CREATE INDEX IF NOT EXISTS idx_state_address ON current_state(address);
CREATE INDEX IF NOT EXISTS idx_state_token ON current_state(token_id);
CREATE INDEX IF NOT EXISTS idx_state_updated ON current_state(last_updated_block);

CREATE INDEX IF NOT EXISTS idx_cache_key ON snapshot_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON snapshot_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_metadata_token ON nft_metadata(token_id);

CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_summary(summary_date);
CREATE INDEX IF NOT EXISTS idx_analytics_token ON analytics_summary(token_id);

-- Analytics tables
CREATE TABLE IF NOT EXISTS analytics_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  data TEXT NOT NULL,
  expires_at INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON analytics_cache(key);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_cache(expires_at);

-- Merkle tree storage
CREATE TABLE IF NOT EXISTS merkle_trees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  root TEXT NOT NULL UNIQUE,
  token_id TEXT,
  block_number INTEGER,
  recipients_count INTEGER NOT NULL,
  total_amount TEXT NOT NULL,
  leaves_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_merkle_trees_root ON merkle_trees(root);
CREATE INDEX IF NOT EXISTS idx_merkle_trees_token ON merkle_trees(token_id);
CREATE INDEX IF NOT EXISTS idx_merkle_trees_created ON merkle_trees(created_at DESC);