-- ClickCreate NFT Analytics Platform - Postgres Migration
-- Migrated from SQLite to Postgres for Vercel deployment

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Contracts table
CREATE TABLE contracts (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  name TEXT,
  symbol TEXT,
  contract_type VARCHAR(10) CHECK(contract_type IN ('ERC721', 'ERC1155')) NOT NULL,
  chain_id INTEGER DEFAULT 1,
  creator_address VARCHAR(42),
  deployment_block BIGINT,
  total_supply NUMERIC DEFAULT 0,
  max_supply NUMERIC,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  website_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  metadata_json JSONB,
  added_by_user_id INTEGER,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  image_url TEXT,
  banner_image_url TEXT
);

CREATE INDEX idx_contracts_address ON contracts(LOWER(address));
CREATE INDEX idx_contracts_type ON contracts(contract_type);
CREATE INDEX idx_contracts_verified ON contracts(is_verified);
CREATE INDEX idx_contracts_usage ON contracts(usage_count);

-- User profiles table
CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL UNIQUE,
  username VARCHAR(255) UNIQUE,
  display_name TEXT,
  bio TEXT,
  profile_image_url TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  email TEXT,
  twitter_handle TEXT,
  discord_handle TEXT,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_wallet ON user_profiles(LOWER(wallet_address));
CREATE INDEX idx_users_username ON user_profiles(username);
CREATE INDEX idx_users_public ON user_profiles(is_public);

-- Events table (blockchain transfer events)
CREATE TABLE events (
  id BIGSERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  block_timestamp BIGINT NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  log_index INTEGER NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  operator VARCHAR(42) NOT NULL,
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42) NOT NULL,
  token_id VARCHAR(78) NOT NULL,
  amount VARCHAR(78) NOT NULL,
  batch_data JSONB,
  contract_address VARCHAR(42) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(transaction_hash, log_index)
);

CREATE INDEX idx_events_block ON events(block_number);
CREATE INDEX idx_events_address_from ON events(LOWER(from_address));
CREATE INDEX idx_events_address_to ON events(LOWER(to_address));
CREATE INDEX idx_events_token ON events(token_id);
CREATE INDEX idx_events_timestamp ON events(block_timestamp);
CREATE INDEX idx_events_contract ON events(LOWER(contract_address));

-- Current state table (holder balances)
CREATE TABLE current_state (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  token_id VARCHAR(78) NOT NULL,
  balance VARCHAR(78) NOT NULL,
  last_updated_block BIGINT NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(address, token_id, contract_address)
);

CREATE INDEX idx_state_address ON current_state(LOWER(address));
CREATE INDEX idx_state_token ON current_state(token_id);
CREATE INDEX idx_state_updated ON current_state(last_updated_block);
CREATE INDEX idx_state_contract ON current_state(LOWER(contract_address));

-- Contract sync status
CREATE TABLE contract_sync_status (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  sync_type VARCHAR(20) CHECK(sync_type IN ('initial', 'incremental', 'full_refresh')) NOT NULL,
  start_block BIGINT NOT NULL,
  end_block BIGINT NOT NULL,
  current_block BIGINT NOT NULL,
  total_events INTEGER DEFAULT 0,
  processed_events INTEGER DEFAULT 0,
  failed_events INTEGER DEFAULT 0,
  status VARCHAR(20) CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'paused')) DEFAULT 'pending',
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contract_id, sync_type, start_block, end_block)
);

CREATE INDEX idx_sync_contract ON contract_sync_status(contract_id);
CREATE INDEX idx_sync_status ON contract_sync_status(status);
CREATE INDEX idx_sync_type ON contract_sync_status(sync_type);

-- User snapshots
CREATE TABLE user_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  snapshot_type VARCHAR(20) CHECK(snapshot_type IN ('current', 'historical')) NOT NULL,
  block_number BIGINT,
  snapshot_name TEXT,
  description TEXT,
  total_holders INTEGER,
  total_supply VARCHAR(78),
  unique_tokens INTEGER,
  total_transfers INTEGER,
  gini_coefficient REAL,
  snapshot_data JSONB,
  export_format VARCHAR(10) CHECK(export_format IN ('json', 'csv', 'both')),
  is_public BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_snapshots_user ON user_snapshots(user_id);
CREATE INDEX idx_snapshots_contract ON user_snapshots(contract_id);
CREATE INDEX idx_snapshots_type ON user_snapshots(snapshot_type);
CREATE INDEX idx_snapshots_public ON user_snapshots(is_public);
CREATE INDEX idx_snapshots_block ON user_snapshots(block_number);

-- NFT Metadata
CREATE TABLE nft_metadata (
  id SERIAL PRIMARY KEY,
  token_id VARCHAR(78) NOT NULL,
  name TEXT,
  description TEXT,
  image TEXT,
  animation_url TEXT,
  external_url TEXT,
  attributes JSONB,
  raw_metadata JSONB,
  contract_address VARCHAR(42),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_id, contract_address)
);

CREATE INDEX idx_metadata_token ON nft_metadata(token_id);
CREATE INDEX idx_metadata_contract ON nft_metadata(LOWER(contract_address));

-- Blockchain cache
CREATE TABLE blockchain_cache (
  id SERIAL PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  contract_address VARCHAR(42) NOT NULL,
  method_name TEXT NOT NULL,
  params_hash TEXT NOT NULL,
  result_data JSONB NOT NULL,
  block_number BIGINT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cache_key ON blockchain_cache(cache_key);
CREATE INDEX idx_cache_contract ON blockchain_cache(LOWER(contract_address));
CREATE INDEX idx_cache_expires ON blockchain_cache(expires_at);

-- Analytics summary
CREATE TABLE analytics_summary (
  id SERIAL PRIMARY KEY,
  summary_date DATE NOT NULL,
  token_id VARCHAR(78),
  unique_holders INTEGER,
  total_transfers INTEGER,
  total_volume VARCHAR(78),
  whale_count INTEGER,
  distribution_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(summary_date, token_id)
);

CREATE INDEX idx_analytics_date ON analytics_summary(summary_date);
CREATE INDEX idx_analytics_token ON analytics_summary(token_id);

-- Sync status (legacy - kept for compatibility)
CREATE TABLE sync_status (
  id SERIAL PRIMARY KEY,
  contract_address VARCHAR(42) NOT NULL,
  last_synced_block BIGINT NOT NULL,
  sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'syncing',
  error_message TEXT,
  UNIQUE(contract_address)
);

-- Analytics cache
CREATE TABLE analytics_cache (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  expires_at BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analytics_cache_key ON analytics_cache(key);
CREATE INDEX idx_analytics_cache_expires ON analytics_cache(expires_at);

-- Merkle trees
CREATE TABLE merkle_trees (
  id SERIAL PRIMARY KEY,
  root TEXT NOT NULL UNIQUE,
  token_id VARCHAR(78),
  block_number BIGINT,
  recipients_count INTEGER NOT NULL,
  total_amount VARCHAR(78) NOT NULL,
  leaves_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_merkle_trees_root ON merkle_trees(root);
CREATE INDEX idx_merkle_trees_token ON merkle_trees(token_id);
CREATE INDEX idx_merkle_trees_created ON merkle_trees(created_at DESC);

-- Contract analytics
CREATE TABLE contract_analytics (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  total_holders INTEGER NOT NULL,
  total_supply VARCHAR(78) NOT NULL,
  unique_tokens INTEGER NOT NULL,
  total_transfers INTEGER NOT NULL,
  volume_24h VARCHAR(78) DEFAULT '0',
  volume_7d VARCHAR(78) DEFAULT '0',
  volume_30d VARCHAR(78) DEFAULT '0',
  unique_traders_24h INTEGER DEFAULT 0,
  unique_traders_7d INTEGER DEFAULT 0,
  unique_traders_30d INTEGER DEFAULT 0,
  avg_holding_period REAL,
  whale_concentration REAL,
  gini_coefficient REAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contract_id, analysis_date)
);

CREATE INDEX idx_analytics_contract_date ON contract_analytics(contract_id, analysis_date);

-- User activity
CREATE TABLE user_activity (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_user ON user_activity(user_id);
CREATE INDEX idx_activity_type ON user_activity(activity_type);
CREATE INDEX idx_activity_date ON user_activity(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_current_state_updated_at BEFORE UPDATE ON current_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
