# Snapshot System - Quick Reference Card

## 🚀 Common Commands

```bash
# Test hybrid snapshot system
npx tsx scripts/test-hybrid-snapshot.ts

# Full blockchain sync
npx tsx scripts/sync-blockchain.ts

# Validate data integrity
npx tsx scripts/validate-data.ts --verbose

# Start development server
npm run dev
```

---

## 📊 API Quick Reference

### Simple Snapshots

```bash
# Current snapshot (single token) - Real-time RPC
GET /api/contracts/{address}/snapshot/advanced?tokenId=1

# Current snapshot (multiple tokens) - Database + Quick Sync
GET /api/contracts/{address}/snapshot/advanced?tokenIds=1,5,10

# All tokens - Database
GET /api/contracts/{address}/snapshot/advanced
```

### Presets (Most Common)

```bash
# Airdrop to all holders
GET /api/contracts/{address}/snapshot/advanced?preset=airdrop-all-holders

# Whitelist for complete set
GET /api/contracts/{address}/snapshot/advanced?preset=whitelist-complete-sets&tokenIds=1,5,10

# Whale holders (10+ tokens)
GET /api/contracts/{address}/snapshot/advanced?preset=airdrop-whales

# List all presets
GET /api/snapshot/presets
```

### Advanced Queries

```bash
# Exact match: ONLY tokens 1 AND 5
GET /api/contracts/{address}/snapshot/advanced?\
  queryMode=advanced&\
  tokenMode=exact&\
  tokenIds=1,5&\
  hasCompleteSets=true

# Any match: token 1 OR 5 OR 10
GET /api/contracts/{address}/snapshot/advanced?\
  queryMode=advanced&\
  tokenMode=any&\
  tokenIds=1,5,10&\
  minBalance=2

# Range with exclusions: 1-50 except 13
GET /api/contracts/{address}/snapshot/advanced?\
  queryMode=advanced&\
  tokenMode=range&\
  rangeStart=1&\
  rangeEnd=50&\
  excludeTokens=13
```

---

## 🎨 Preset Categories

### Airdrop
- `airdrop-all-holders` ⭐ - All holders
- `airdrop-specific-tokens` ⭐ - Specific tokens
- `airdrop-whales` - Large holders (10+)
- `airdrop-diverse-collectors` - Multiple tokens (5+)

### Whitelist
- `whitelist-complete-sets` ⭐ - Complete sets only
- `whitelist-minimum-tokens` ⭐ - Min token count
- `whitelist-og-holders` - Historical holders

### Analysis
- `analysis-token-distribution` ⭐ - Full distribution
- `analysis-top-100` - Top 100 holders
- `analysis-specific-range` - Token range

### Marketing
- `marketing-new-holders` - Recent holders
- `marketing-single-token` - Single token (upsell)

### Custom
- `custom-exact-match` - Exact tokens only
- `custom-exclude-tokens` - Exclude specific tokens

---

## 🔧 Strategy Selection

| Contract Type | Token Count | Strategy | Data Source |
|---------------|-------------|----------|-------------|
| ERC-721 | Any | RPC Real-time | `balanceOf` calls |
| ERC-1155 | 1 | RPC Real-time | `balanceOfBatch` |
| ERC-1155 | Multiple | Database + Sync | `current_state` table |
| ERC-1155 | All | Database | `current_state` table |

---

## 📝 Query Modes

### Exact Match
ONLY specified tokens (no other tokens allowed)
```typescript
tokenSelection: { mode: 'exact', tokenIds: ['1', '5'] }
```

### Any Match
AT LEAST ONE of specified tokens
```typescript
tokenSelection: { mode: 'any', tokenIds: ['1', '5', '10'] }
```

### All Tokens
Every token in collection
```typescript
tokenSelection: { mode: 'all' }
```

### Range
Token ID range with optional exclusions
```typescript
tokenSelection: {
  mode: 'range',
  range: { start: 1, end: 50 },
  excludeTokens: ['13', '26']
}
```

---

## 🎯 Common Filters

```typescript
holderFilters: {
  minBalance: 10,           // At least 10 tokens total
  maxBalance: 100,          // At most 100 tokens
  minTokenCount: 5,         // At least 5 different token IDs
  hasCompleteSets: true,    // Must own complete set
  minSetsCount: 2           // At least 2 complete sets
}
```

---

## 💻 Code Examples

### TypeScript

```typescript
import { HybridSnapshotGenerator } from '@/lib/blockchain/hybrid-snapshot-generator'
import { AdvancedQueryBuilder } from '@/lib/processing/advanced-query-builder'
import { getPreset, buildQueryFromPreset } from '@/lib/processing/snapshot-presets'

// Simple hybrid snapshot
const generator = new HybridSnapshotGenerator()
const result = await generator.generateSnapshot({
  contractAddress: '0x...',
  contractType: 'ERC1155',
  tokenIds: ['1']
})

// Advanced query
const queryBuilder = new AdvancedQueryBuilder()
const queryResult = await queryBuilder.executeQuery({
  contractAddress: '0x...',
  tokenSelection: { mode: 'exact', tokenIds: ['1', '5'] },
  holderFilters: { hasCompleteSets: true }
})

// Use preset
const preset = getPreset('airdrop-all-holders')!
const query = buildQueryFromPreset(preset, '0x...')
const presetResult = await queryBuilder.executeQuery(query)
```

### cURL

```bash
# Simple
curl "http://localhost:3000/api/contracts/0x.../snapshot/advanced?tokenId=1"

# Preset
curl "http://localhost:3000/api/contracts/0x.../snapshot/advanced?preset=airdrop-all-holders"

# Advanced POST
curl -X POST "http://localhost:3000/api/contracts/0x.../snapshot/advanced" \
  -H "Content-Type: application/json" \
  -d '{"query": {"tokenSelection": {"mode": "exact", "tokenIds": ["1", "5"]}}}'
```

---

## 🐛 Troubleshooting

### Sync Gap Warning
```bash
⚠️ Warning: Sync gap (500) > quick sync limit (100)
```
**Fix**: `npx tsx scripts/sync-blockchain.ts`

### Empty Results
```bash
Total Holders: 0
```
**Checklist**:
1. Contract synced? Check `syncGapBlocks`
2. Token IDs correct?
3. Run: `npx tsx scripts/validate-data.ts`

### Rate Limit
```bash
❌ Error: 429 Too Many Requests
```
**Fix**: Use database strategy or reduce batch size

---

## 📊 Response Format

```json
{
  "success": true,
  "data": {
    "holders": [
      {
        "address": "0x123...",
        "totalBalance": "15",
        "tokenCount": 3,
        "tokens": [
          { "tokenId": "1", "balance": "5" },
          { "tokenId": "5", "balance": "5" },
          { "tokenId": "10", "balance": "5" }
        ],
        "completeSets": 5,
        "percentage": 2.5,
        "rank": 1
      }
    ],
    "metadata": {
      "totalHolders": 1406,
      "totalSupply": "14260",
      "uniqueTokens": 96,
      "dataSource": "rpc-realtime",
      "blockNumber": 21234567
    }
  }
}
```

---

## 📚 Documentation Links

- **[HYBRID_SNAPSHOT_GUIDE.md](HYBRID_SNAPSHOT_GUIDE.md)** - Complete guide
- **[CLAUDE.md](CLAUDE.md)** - Main docs
- **[VALIDATION_GUIDE.md](VALIDATION_GUIDE.md)** - Validation
- **[TEST_COLLECTION_SNAPSHOTS.md](TEST_COLLECTION_SNAPSHOTS.md)** - Testing

---

**Quick Help**: `npx tsx scripts/test-hybrid-snapshot.ts`
