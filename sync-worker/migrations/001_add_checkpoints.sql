-- Sync checkpoints table for crash recovery
CREATE TABLE IF NOT EXISTS sync_checkpoints (
  contract_address VARCHAR(42) PRIMARY KEY,
  last_block BIGINT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_updated ON sync_checkpoints(updated_at DESC);
