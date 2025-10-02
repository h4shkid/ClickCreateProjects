-- Multi-Contract NFT Analytics Platform Database Schema
-- Supports any ERC-721/ERC-1155 contract with user profiles and shared caching

-- =====================================================
-- CORE TABLES FOR MULTI-CONTRACT SUPPORT
-- =====================================================

-- Contracts registry: Track all supported contracts
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  address TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  symbol TEXT,
  contract_type TEXT CHECK(contract_type IN ('ERC721', 'ERC1155')) NOT NULL,
  chain_id INTEGER DEFAULT 1, -- 1=Ethereum, 137=Polygon, 42161=Arbitrum, 8453=Base, 360=Shape
  creator_address TEXT,
  deployment_block INTEGER,
  total_supply TEXT DEFAULT '0',
  max_supply TEXT,
  is_verified BOOLEAN DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  description TEXT,
  website_url TEXT,
  twitter_url TEXT,
  discord_url TEXT,
  metadata_json TEXT, -- Full contract metadata
  added_by_user_id INTEGER, -- Who added this contract
  usage_count INTEGER DEFAULT 0, -- Track popularity
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contracts_address ON contracts(address);
CREATE INDEX IF NOT EXISTS idx_contracts_type ON contracts(contract_type);
CREATE INDEX IF NOT EXISTS idx_contracts_verified ON contracts(is_verified);
CREATE INDEX IF NOT EXISTS idx_contracts_usage ON contracts(usage_count);

-- User profiles with wallet-based authentication
CREATE TABLE IF NOT EXISTS user_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT NOT NULL UNIQUE COLLATE NOCASE,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  profile_image_url TEXT,
  is_public BOOLEAN DEFAULT 1,
  is_active BOOLEAN DEFAULT 1,
  email TEXT, -- Optional for notifications
  twitter_handle TEXT,
  discord_handle TEXT,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_users_username ON user_profiles(username);
CREATE INDEX IF NOT EXISTS idx_users_public ON user_profiles(is_public);

-- User snapshot history with privacy controls
CREATE TABLE IF NOT EXISTS user_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  snapshot_type TEXT CHECK(snapshot_type IN ('current', 'historical')) NOT NULL,
  block_number INTEGER,
  snapshot_name TEXT, -- User-defined name
  description TEXT,
  total_holders INTEGER,
  total_supply TEXT,
  unique_tokens INTEGER,
  total_transfers INTEGER,
  gini_coefficient REAL,
  snapshot_data TEXT, -- JSON with full snapshot data
  export_format TEXT CHECK(export_format IN ('json', 'csv', 'both')),
  is_public BOOLEAN DEFAULT 1,
  is_featured BOOLEAN DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user ON user_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_contract ON user_snapshots(contract_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_type ON user_snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_snapshots_public ON user_snapshots(is_public);
CREATE INDEX IF NOT EXISTS idx_snapshots_block ON user_snapshots(block_number);

-- Contract synchronization status per contract
CREATE TABLE IF NOT EXISTS contract_sync_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  sync_type TEXT CHECK(sync_type IN ('initial', 'incremental', 'full_refresh')) NOT NULL,
  start_block INTEGER NOT NULL,
  end_block INTEGER NOT NULL,
  current_block INTEGER NOT NULL,
  total_events INTEGER DEFAULT 0,
  processed_events INTEGER DEFAULT 0,
  failed_events INTEGER DEFAULT 0,
  status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed', 'paused')) DEFAULT 'pending',
  error_message TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contract_id, sync_type, start_block, end_block)
);

CREATE INDEX IF NOT EXISTS idx_sync_contract ON contract_sync_status(contract_id);
CREATE INDEX IF NOT EXISTS idx_sync_status ON contract_sync_status(status);
CREATE INDEX IF NOT EXISTS idx_sync_type ON contract_sync_status(sync_type);

-- Shared blockchain data cache to reduce API calls
CREATE TABLE IF NOT EXISTS blockchain_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT NOT NULL UNIQUE, -- Format: "method:contract:params_hash"
  contract_address TEXT NOT NULL,
  method_name TEXT NOT NULL, -- balanceOf, tokenURI, totalSupply, etc.
  params_hash TEXT NOT NULL, -- SHA256 of serialized parameters
  result_data TEXT NOT NULL, -- JSON result
  block_number INTEGER, -- Block at which this was cached
  expires_at DATETIME NOT NULL,
  hit_count INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_key ON blockchain_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_contract ON blockchain_cache(contract_address);
CREATE INDEX IF NOT EXISTS idx_cache_method ON blockchain_cache(method_name);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON blockchain_cache(expires_at);

-- User favorites/bookmarks for quick access
CREATE TABLE IF NOT EXISTS user_favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  favorite_type TEXT CHECK(favorite_type IN ('contract', 'snapshot')) NOT NULL,
  target_id INTEGER, -- snapshot_id if type is 'snapshot'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, contract_id, favorite_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_contract ON user_favorites(contract_id);

-- =====================================================
-- MODIFY EXISTING TABLES FOR MULTI-CONTRACT SUPPORT
-- =====================================================

-- Add contract_address to events table (for existing data migration)
ALTER TABLE events ADD COLUMN contract_address TEXT DEFAULT '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';

-- Add contract_address to current_state table
ALTER TABLE current_state ADD COLUMN contract_address TEXT DEFAULT '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';

-- Add contract_address to nft_metadata table
ALTER TABLE nft_metadata ADD COLUMN contract_address TEXT DEFAULT '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';

-- Create new composite indexes for multi-contract queries
CREATE INDEX IF NOT EXISTS idx_events_contract_token ON events(contract_address, token_id);
CREATE INDEX IF NOT EXISTS idx_events_contract_block ON events(contract_address, block_number);
CREATE INDEX IF NOT EXISTS idx_state_contract_address ON current_state(contract_address, address);
CREATE INDEX IF NOT EXISTS idx_state_contract_token ON current_state(contract_address, token_id);
CREATE INDEX IF NOT EXISTS idx_metadata_contract_token ON nft_metadata(contract_address, token_id);

-- =====================================================
-- ENHANCED ANALYTICS TABLES
-- =====================================================

-- Contract analytics summary
CREATE TABLE IF NOT EXISTS contract_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  analysis_date DATE NOT NULL,
  total_holders INTEGER NOT NULL,
  total_supply TEXT NOT NULL,
  unique_tokens INTEGER NOT NULL,
  total_transfers INTEGER NOT NULL,
  volume_24h TEXT DEFAULT '0',
  volume_7d TEXT DEFAULT '0',
  volume_30d TEXT DEFAULT '0',
  unique_traders_24h INTEGER DEFAULT 0,
  unique_traders_7d INTEGER DEFAULT 0,
  unique_traders_30d INTEGER DEFAULT 0,
  avg_holding_period REAL, -- in days
  whale_concentration REAL, -- % held by top 10 holders
  gini_coefficient REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(contract_id, analysis_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_contract_date ON contract_analytics(contract_id, analysis_date);

-- User activity tracking
CREATE TABLE IF NOT EXISTS user_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_type TEXT CHECK(activity_type IN ('login', 'snapshot_created', 'contract_added', 'profile_updated')) NOT NULL,
  contract_id INTEGER REFERENCES contracts(id) ON DELETE SET NULL,
  metadata TEXT, -- JSON for additional activity data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON user_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_date ON user_activity(created_at);

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- Contract overview with latest analytics
CREATE VIEW IF NOT EXISTS contract_overview AS
SELECT 
  c.id,
  c.address,
  c.name,
  c.symbol,
  c.contract_type,
  c.is_verified,
  c.usage_count,
  ca.total_holders,
  ca.total_supply,
  ca.unique_tokens,
  ca.gini_coefficient,
  ca.whale_concentration,
  COUNT(us.id) as snapshot_count,
  c.created_at
FROM contracts c
LEFT JOIN contract_analytics ca ON c.id = ca.contract_id 
  AND ca.analysis_date = (
    SELECT MAX(analysis_date) 
    FROM contract_analytics 
    WHERE contract_id = c.id
  )
LEFT JOIN user_snapshots us ON c.id = us.contract_id AND us.is_public = 1
WHERE c.is_active = 1
GROUP BY c.id;

-- User dashboard view
CREATE VIEW IF NOT EXISTS user_dashboard AS
SELECT 
  up.id as user_id,
  up.wallet_address,
  up.username,
  up.display_name,
  COUNT(DISTINCT us.contract_id) as tracked_contracts,
  COUNT(us.id) as total_snapshots,
  COUNT(CASE WHEN us.is_public = 1 THEN 1 END) as public_snapshots,
  COUNT(uf.id) as favorite_contracts,
  up.created_at as joined_date
FROM user_profiles up
LEFT JOIN user_snapshots us ON up.id = us.user_id
LEFT JOIN user_favorites uf ON up.id = uf.user_id AND uf.favorite_type = 'contract'
WHERE up.is_active = 1
GROUP BY up.id;

-- Popular contracts view
CREATE VIEW IF NOT EXISTS popular_contracts AS
SELECT 
  c.*,
  COUNT(DISTINCT us.user_id) as unique_users,
  COUNT(us.id) as total_snapshots,
  COUNT(uf.id) as favorite_count,
  ca.total_holders,
  ca.total_supply
FROM contracts c
LEFT JOIN user_snapshots us ON c.id = us.contract_id
LEFT JOIN user_favorites uf ON c.id = uf.contract_id AND uf.favorite_type = 'contract'
LEFT JOIN contract_analytics ca ON c.id = ca.contract_id 
  AND ca.analysis_date = (
    SELECT MAX(analysis_date) 
    FROM contract_analytics 
    WHERE contract_id = c.id
  )
WHERE c.is_active = 1
GROUP BY c.id
ORDER BY (COUNT(DISTINCT us.user_id) + COUNT(uf.id) * 2) DESC;

-- =====================================================
-- TRIGGERS FOR AUTOMATED MAINTENANCE
-- =====================================================

-- Update contract usage count when snapshots are created
CREATE TRIGGER IF NOT EXISTS update_contract_usage
  AFTER INSERT ON user_snapshots
BEGIN
  UPDATE contracts 
  SET usage_count = usage_count + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.contract_id;
END;

-- Update user last_login on activity
CREATE TRIGGER IF NOT EXISTS update_user_last_login
  AFTER INSERT ON user_activity
  WHEN NEW.activity_type = 'login'
BEGIN
  UPDATE user_profiles 
  SET last_login = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.user_id;
END;

-- Clean up expired cache entries
CREATE TRIGGER IF NOT EXISTS cleanup_expired_cache
  AFTER INSERT ON blockchain_cache
BEGIN
  DELETE FROM blockchain_cache 
  WHERE expires_at < datetime('now', '-1 day');
END;