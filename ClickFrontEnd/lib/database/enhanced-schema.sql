-- Enhanced NFT Snapshot Tool Database Schema for Complete History
-- Supports full ERC-1155 contract history from genesis

-- Keep existing tables (events, current_state, etc.) and add new ones

-- Token metadata history: Track URI changes over time
CREATE TABLE IF NOT EXISTS token_metadata_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  uri TEXT,
  metadata_json TEXT,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metadata_token ON token_metadata_history(token_id);
CREATE INDEX IF NOT EXISTS idx_metadata_block ON token_metadata_history(block_number);

-- Minting history: Track token creation events
CREATE TABLE IF NOT EXISTS minting_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  minter_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  uri TEXT,
  extension_address TEXT,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_mint_token ON minting_history(token_id);
CREATE INDEX IF NOT EXISTS idx_mint_minter ON minting_history(minter_address);
CREATE INDEX IF NOT EXISTS idx_mint_block ON minting_history(block_number);

-- Burn history: Track destroyed tokens
CREATE TABLE IF NOT EXISTS burn_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  burner_address TEXT NOT NULL,
  amount TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_burn_token ON burn_history(token_id);
CREATE INDEX IF NOT EXISTS idx_burn_address ON burn_history(burner_address);

-- Approval history: Track operator approvals
CREATE TABLE IF NOT EXISTS approval_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_address TEXT NOT NULL,
  operator_address TEXT NOT NULL,
  approved BOOLEAN NOT NULL,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_approval_owner ON approval_history(owner_address);
CREATE INDEX IF NOT EXISTS idx_approval_operator ON approval_history(operator_address);

-- Extension registry: Track contract extensions
CREATE TABLE IF NOT EXISTS extension_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  extension_address TEXT NOT NULL UNIQUE,
  base_uri TEXT,
  is_blacklisted BOOLEAN DEFAULT 0,
  registered_block INTEGER NOT NULL,
  registered_tx TEXT NOT NULL,
  unregistered_block INTEGER,
  unregistered_tx TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_extension_address ON extension_registry(extension_address);

-- Token extensions mapping
CREATE TABLE IF NOT EXISTS token_extensions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  extension_address TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(token_id)
);

CREATE INDEX IF NOT EXISTS idx_token_ext_token ON token_extensions(token_id);
CREATE INDEX IF NOT EXISTS idx_token_ext_extension ON token_extensions(extension_address);

-- Royalty configurations
CREATE TABLE IF NOT EXISTS royalty_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT,
  extension_address TEXT,
  receivers TEXT NOT NULL, -- JSON array of addresses
  basis_points TEXT NOT NULL, -- JSON array of basis points
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_royalty_token ON royalty_config(token_id);
CREATE INDEX IF NOT EXISTS idx_royalty_extension ON royalty_config(extension_address);

-- Token supply tracking
CREATE TABLE IF NOT EXISTS token_supply (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL UNIQUE,
  total_supply TEXT NOT NULL,
  circulating_supply TEXT NOT NULL,
  burned_amount TEXT DEFAULT '0',
  last_updated_block INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supply_token ON token_supply(token_id);

-- Ownership timeline: Track complete ownership history
CREATE TABLE IF NOT EXISTS ownership_timeline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  balance TEXT NOT NULL,
  acquired_block INTEGER NOT NULL,
  acquired_tx TEXT NOT NULL,
  disposed_block INTEGER,
  disposed_tx TEXT,
  holding_duration INTEGER, -- in blocks
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_timeline_token ON ownership_timeline(token_id);
CREATE INDEX IF NOT EXISTS idx_timeline_owner ON ownership_timeline(owner_address);
CREATE INDEX IF NOT EXISTS idx_timeline_acquired ON ownership_timeline(acquired_block);
CREATE INDEX IF NOT EXISTS idx_timeline_disposed ON ownership_timeline(disposed_block);

-- Collection statistics
CREATE TABLE IF NOT EXISTS collection_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stat_date DATE NOT NULL,
  total_tokens INTEGER NOT NULL,
  total_holders INTEGER NOT NULL,
  total_supply TEXT NOT NULL,
  total_transfers INTEGER NOT NULL,
  total_volume TEXT NOT NULL,
  unique_traders INTEGER NOT NULL,
  most_traded_token TEXT,
  whale_concentration REAL, -- percentage held by top 10
  gini_coefficient REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stat_date)
);

CREATE INDEX IF NOT EXISTS idx_stats_date ON collection_stats(stat_date);

-- Sync progress tracking for large historical syncs
CREATE TABLE IF NOT EXISTS sync_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_id TEXT NOT NULL UNIQUE,
  start_block INTEGER NOT NULL,
  end_block INTEGER NOT NULL,
  current_block INTEGER NOT NULL,
  total_events INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  started_at DATETIME,
  completed_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_progress_status ON sync_progress(status);
CREATE INDEX IF NOT EXISTS idx_progress_sync_id ON sync_progress(sync_id);

-- Raw event logs for reprocessing
CREATE TABLE IF NOT EXISTS raw_event_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_number INTEGER NOT NULL,
  transaction_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  address TEXT NOT NULL,
  topics TEXT NOT NULL, -- JSON array
  data TEXT NOT NULL,
  event_signature TEXT,
  processed BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(transaction_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_raw_block ON raw_event_logs(block_number);
CREATE INDEX IF NOT EXISTS idx_raw_processed ON raw_event_logs(processed);
CREATE INDEX IF NOT EXISTS idx_raw_signature ON raw_event_logs(event_signature);

-- Additional indexes for existing tables
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_composite ON events(token_id, block_number);
CREATE INDEX IF NOT EXISTS idx_state_balance ON current_state(balance);

-- Views for common queries
CREATE VIEW IF NOT EXISTS token_current_info AS
SELECT 
  cs.token_id,
  cs.address as owner_address,
  cs.balance,
  ts.total_supply,
  ts.circulating_supply,
  ts.burned_amount,
  nm.name,
  nm.description,
  nm.image_url,
  te.extension_address
FROM current_state cs
LEFT JOIN token_supply ts ON cs.token_id = ts.token_id
LEFT JOIN nft_metadata nm ON cs.token_id = nm.token_id
LEFT JOIN token_extensions te ON cs.token_id = te.token_id
WHERE cs.balance > 0;

CREATE VIEW IF NOT EXISTS holder_portfolio AS
SELECT 
  address,
  COUNT(DISTINCT token_id) as unique_tokens,
  SUM(CAST(balance AS INTEGER)) as total_balance,
  MAX(last_updated_block) as last_activity
FROM current_state
WHERE balance > 0
GROUP BY address;