# Hybrid Snapshot System - Complete Guide

## 🎯 Overview

The Hybrid Snapshot System provides optimized snapshot generation for NFT collections, automatically choosing the best strategy based on contract type and query complexity.

**Key Features:**
- ✅ Real-time snapshots for ERC-721 and single-token ERC-1155
- ✅ Database-optimized snapshots for complex multi-token queries
- ✅ Advanced query builder for artist use cases
- ✅ 15+ pre-configured presets for common scenarios
- ✅ Automatic quick-sync for recent blockchain data

---

## 📊 Strategy Selection

### ERC-721 Contracts
**Always uses RPC real-time strategy**
- Fetches current holder list from Transfer events
- Calls `balanceOf(address)` for each holder
- ✅ Always accurate, always current
- ⚡ Fast for collections with < 10k holders

### ERC-1155 Single Token
**Uses RPC real-time strategy**
- Fetches holders for specific token ID
- Uses `balanceOfBatch(addresses[], tokenIds[])` for efficiency
- ✅ Real-time accuracy
- ⚡ Single RPC call per 1000 holders

### ERC-1155 Multiple Tokens
**Uses database + quick sync strategy**
- Syncs last 100 blocks (~20 minutes) automatically
- Reads from optimized database queries
- ✅ Efficient for complex multi-token queries
- 📊 Supports advanced filtering

---

## 🚀 Quick Start

### Basic Usage

```typescript
import { HybridSnapshotGenerator } from '@/lib/blockchain/hybrid-snapshot-generator'

const generator = new HybridSnapshotGenerator()

// Current snapshot - automatic strategy selection
const result = await generator.generateSnapshot({
  contractAddress: '0x...',
  contractType: 'ERC1155',
  tokenIds: ['1']  // Optional: specific tokens
})

console.log(`Found ${result.metadata.totalHolders} holders`)
console.log(`Data source: ${result.metadata.dataSource}`)
```

### API Endpoints

#### Simple Hybrid Snapshot
```bash
# Single token (real-time)
GET /api/contracts/0x.../snapshot/advanced?tokenId=1

# Multiple tokens (database + quick sync)
GET /api/contracts/0x.../snapshot/advanced?tokenIds=1,5,10

# All tokens
GET /api/contracts/0x.../snapshot/advanced
```

#### Preset-Based Query
```bash
# Use pre-configured preset
GET /api/contracts/0x.../snapshot/advanced?preset=airdrop-all-holders

# Preset with custom tokens
GET /api/contracts/0x.../snapshot/advanced?preset=whitelist-complete-sets&tokenIds=1,5,10

# See all available presets
GET /api/snapshot/presets
```

#### Advanced Query Builder
```bash
# Complex query with filters
GET /api/contracts/0x.../snapshot/advanced?\
  queryMode=advanced&\
  tokenMode=exact&\
  tokenIds=1,5&\
  hasCompleteSets=true&\
  minBalance=10&\
  sortBy=balance&\
  limit=100
```

---

## 🎨 Artist Use Cases

### 1. Airdrop Campaigns

#### All Holders
```bash
GET /api/contracts/0x.../snapshot/advanced?preset=airdrop-all-holders
```
Returns every wallet holding at least 1 token.

#### Specific Token Holders
```bash
GET /api/contracts/0x.../snapshot/advanced?\
  preset=airdrop-specific-tokens&\
  tokenIds=1,2,3,4,5
```
Returns holders of ANY of the specified tokens (Season 1, for example).

#### Whale Holders
```bash
GET /api/contracts/0x.../snapshot/advanced?\
  preset=airdrop-whales&\
  minBalance=10
```
Returns top holders with significant balances.

### 2. Whitelist Generation

#### Complete Set Holders
```bash
GET /api/contracts/0x.../snapshot/advanced?\
  preset=whitelist-complete-sets&\
  tokenIds=1,2,3,4,5,6,7,8,9,10
```
Returns ONLY holders who own ALL 10 specified tokens.

#### Minimum Token Count
```bash
GET /api/contracts/0x.../snapshot/advanced?\
  preset=whitelist-minimum-tokens&\
  minTokenCount=5
```
Returns holders with at least 5 different tokens.

### 3. Holder Analysis

#### Token Distribution
```bash
GET /api/contracts/0x.../snapshot/advanced?preset=analysis-token-distribution
```
Complete holder list with distribution metrics.

#### Top 100 Holders
```bash
GET /api/contracts/0x.../snapshot/advanced?preset=analysis-top-100
```
Largest holders by balance.

---

## 🔧 Advanced Query Builder

### Query Modes

#### 1. Exact Match
Holders with EXACTLY the specified tokens (no other tokens).

```typescript
{
  tokenSelection: {
    mode: 'exact',
    tokenIds: ['1', '5']
  },
  holderFilters: {
    hasCompleteSets: true
  }
}
```

**Example:** Find holders who ONLY own tokens 1 and 5 (pure Season 1 collectors).

#### 2. Any Match
Holders with AT LEAST ONE of the specified tokens.

```typescript
{
  tokenSelection: {
    mode: 'any',
    tokenIds: ['1', '2', '3']
  }
}
```

**Example:** Find anyone holding token 1 OR 2 OR 3.

#### 3. All Tokens
No filter - all tokens in collection.

```typescript
{
  tokenSelection: {
    mode: 'all'
  }
}
```

#### 4. Range with Exclusions
Token ID range with optional exclusions.

```typescript
{
  tokenSelection: {
    mode: 'range',
    range: { start: 1, end: 50 },
    excludeTokens: ['13', '26']  // Exclude unlucky numbers
  }
}
```

**Example:** All tokens from 1-50 except 13 and 26.

### Holder Filters

```typescript
{
  holderFilters: {
    minBalance: 10,              // At least 10 total tokens
    maxBalance: 100,             // At most 100 tokens
    minTokenCount: 5,            // At least 5 different token IDs
    maxTokenCount: 20,           // At most 20 different token IDs
    hasCompleteSets: true,       // Must own complete set
    minSetsCount: 2              // At least 2 complete sets
  }
}
```

### Complete Example

```typescript
import { AdvancedQueryBuilder } from '@/lib/processing/advanced-query-builder'

const queryBuilder = new AdvancedQueryBuilder()

const result = await queryBuilder.executeQuery({
  contractAddress: '0x...',
  tokenSelection: {
    mode: 'exact',
    tokenIds: ['1', '5', '10', '15', '20']
  },
  holderFilters: {
    hasCompleteSets: true,
    minSetsCount: 2  // At least 2 complete sets
  },
  sortBy: 'balance',
  sortOrder: 'desc',
  limit: 50
})

// Result
result.holders.forEach(holder => {
  console.log(`${holder.address}: ${holder.completeSets} complete sets`)
})
```

---

## 📋 Available Presets

### Airdrop Category
- `airdrop-all-holders` - Every holder (⭐ Recommended)
- `airdrop-specific-tokens` - Specific token holders (⭐ Recommended)
- `airdrop-whales` - Large holders (min 10 tokens)
- `airdrop-diverse-collectors` - Multiple different tokens (min 5)

### Whitelist Category
- `whitelist-complete-sets` - Complete set owners (⭐ Recommended)
- `whitelist-minimum-tokens` - Min token count (⭐ Recommended)
- `whitelist-og-holders` - Historical snapshot (early supporters)

### Analysis Category
- `analysis-token-distribution` - Full distribution (⭐ Recommended)
- `analysis-top-100` - Top 100 holders
- `analysis-specific-range` - Token range analysis

### Marketing Category
- `marketing-new-holders` - Recent holders
- `marketing-single-token` - Single token holders (upsell opportunity)

### Custom Category
- `custom-exact-match` - ONLY specified tokens
- `custom-exclude-tokens` - Exclude specific tokens

---

## 🧪 Testing

Run the test suite:

```bash
cd ClickFrontEnd
npx tsx scripts/test-hybrid-snapshot.ts
```

This will test:
1. ✅ ERC-1155 single token (real-time)
2. ✅ ERC-1155 multiple tokens (database + quick sync)
3. ✅ Advanced query builder
4. ✅ Snapshot presets
5. ✅ Query statistics

---

## ⚡ Performance Optimization

### Quick Sync Configuration

By default, quick sync fetches the last 100 blocks (~20 minutes):

```typescript
await generator.generateSnapshot({
  contractAddress: '0x...',
  contractType: 'ERC1155',
  quickSyncBlocks: 200  // Sync last 200 blocks (~40 min)
})
```

### Pagination

For large result sets:

```typescript
const result = await queryBuilder.executeQuery({
  contractAddress: '0x...',
  tokenSelection: { mode: 'all' },
  limit: 100,
  offset: 0  // Page 1
})

// Next page
const page2 = await queryBuilder.executeQuery({
  contractAddress: '0x...',
  tokenSelection: { mode: 'all' },
  limit: 100,
  offset: 100  // Page 2
})
```

### Query Preview (Statistics)

Get statistics without full execution:

```typescript
const stats = await queryBuilder.getQueryStatistics({
  contractAddress: '0x...',
  tokenSelection: { mode: 'all' },
  holderFilters: { minBalance: 10 }
})

console.log(`Estimated ${stats.estimatedHolders} holders`)
console.log(`Total supply: ${stats.totalSupply}`)
```

---

## 🔍 Data Sources

### Real-time RPC (`rpc-realtime`)
- ✅ Always current (latest block)
- ✅ No database dependency
- ⚠️ Rate limited by RPC provider
- ⚠️ Slower for large collections

### Database Synced (`database-synced`)
- ✅ Fast for complex queries
- ✅ Supports historical snapshots
- ✅ Efficient for multi-token queries
- ⚠️ Requires sync (auto quick-sync included)

### Database Historical (`database-historical`)
- ✅ Point-in-time snapshots
- ✅ Date range comparisons
- ⚠️ Requires full sync up to target block

---

## 📝 API Response Format

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
      "query": { ... },
      "totalHolders": 1406,
      "totalSupply": "14260",
      "uniqueTokens": 96,
      "timestamp": "2025-01-06T...",
      "blockNumber": 21234567,
      "dataSource": "rpc-realtime",
      "lastSyncedBlock": 21234500,
      "syncGapBlocks": 67
    }
  }
}
```

---

## 🎓 Best Practices

### 1. Choose the Right Strategy
- **Current snapshot, all tokens** → Database is faster
- **Current snapshot, single token** → RPC is more accurate
- **Historical snapshot** → Always database

### 2. Use Presets When Possible
Presets are optimized and tested for common use cases.

### 3. Monitor Sync Gap
If `syncGapBlocks` > 1000, run full sync:
```bash
npx tsx scripts/sync-blockchain.ts
```

### 4. Validate Before Critical Operations
Run validation before important CSV exports:
```bash
npx tsx scripts/validate-data.ts --verbose
```

### 5. Use Query Statistics for Preview
Test queries with statistics before full execution:
```typescript
const stats = await queryBuilder.getQueryStatistics(query)
if (stats.estimatedHolders > 10000) {
  console.log('Large result set - consider pagination')
}
```

---

## 🐛 Troubleshooting

### Sync Gap Warning
```
⚠️ Warning: Sync gap (500) > quick sync limit (100)
```
**Solution:** Run full sync or increase `quickSyncBlocks`:
```bash
npx tsx scripts/sync-blockchain.ts
```

### Rate Limit Errors
```
❌ Error: 429 Too Many Requests
```
**Solution:** Use database strategy or reduce batch size.

### Empty Results
```
Total Holders: 0
```
**Checklist:**
1. Is contract synced? Check `syncGapBlocks`
2. Are token IDs correct?
3. Run validation: `npx tsx scripts/validate-data.ts`

---

## 🔗 Related Documentation

- **ClickFrontEnd/CLAUDE.md** - Main development guide
- **ClickFrontEnd/VALIDATION_GUIDE.md** - Data validation workflow
- **ClickFrontEnd/TEST_COLLECTION_SNAPSHOTS.md** - Testing guide

---

## 📞 Support

For issues or questions:
1. Check test suite: `npx tsx scripts/test-hybrid-snapshot.ts`
2. Review logs for data source and sync status
3. Validate database: `npx tsx scripts/validate-data.ts`

---

**Built with ❤️ for NFT artists and creators**
