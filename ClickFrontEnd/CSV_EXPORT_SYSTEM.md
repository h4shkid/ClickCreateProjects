# CSV Export System - Complete Technical Documentation

**Version**: 2.0
**Last Updated**: 2025-10-29
**Author**: ClickCreate Team

---

## 📚 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [User Flow](#user-flow)
4. [API Workflow](#api-workflow)
5. [Token Filtering System](#token-filtering-system)
6. [Number of Sets Calculation](#number-of-sets-calculation)
7. [CSV Format Specification](#csv-format-specification)
8. [Common Issues & Solutions](#common-issues--solutions)
9. [Testing Guide](#testing-guide)
10. [Debugging Checklist](#debugging-checklist)

---

## Overview

The CSV Export System allows users to export NFT holder snapshots as downloadable CSV files. It supports:

- ✅ Current and historical snapshots
- ✅ Single token, multiple tokens, and token ranges (e.g., "51-55", "1-10, 15, 20-25")
- ✅ Exact match (all tokens) vs. Any match (at least one token)
- ✅ Full season mode (ClickCreate collections only)
- ✅ **Number of sets** calculation for token groups
- ✅ Multi-contract support (any ERC-721/ERC-1155 contract)

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                      │
├─────────────────────────────────────────────────────────────┤
│  /collections/[address]/snapshot  (Public - All Users)       │
│  /snapshot                        (Internal - Authorized)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │    FRONTEND EXPORT FUNCTION            │
        │    (exportData)                        │
        │                                        │
        │  Collects UI state:                    │
        │  - tokenIds, exactMatch                │
        │  - fullSeasonMode, selectedSeason      │
        │  - snapshotType, blockNumber           │
        │                                        │
        │  Calls: GET /api/export/csv            │
        └───────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │    CSV EXPORT API                     │
        │    /api/export/csv/route.ts           │
        │                                        │
        │  1. Parse params (tokenIds, etc.)      │
        │  2. Build snapshot API URL             │
        │  3. Call snapshot API internally       │
        │  4. Expand token ranges                │
        │  5. Calculate number_of_sets           │
        │  6. Format CSV with proper headers     │
        └───────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │    SNAPSHOT API                       │
        │    /api/contracts/[address]/snapshot/ │
        │                                        │
        │  - Queries blockchain data             │
        │  - Filters holders by token criteria   │
        │  - Returns: holders[], metadata{}      │
        └───────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │    DATABASE LAYER                     │
        │    (SQLite dev / PostgreSQL prod)     │
        │                                        │
        │  Tables:                               │
        │  - events (transfer history)           │
        │  - current_state (live balances)       │
        │  - contracts (collection metadata)     │
        └───────────────────────────────────────┘
```

---

## User Flow

### Step-by-Step: Exporting a Token Range Snapshot

**Scenario**: User wants CSV of all holders who own **ALL** tokens 51-55 (exact match)

#### 1. UI Configuration

**Page**: `/collections/0x300e7a5fb0ab08af367d5fb3915930791bb08c2b/snapshot`

```
┌────────────────────────────────────────────┐
│  Snapshot Type: [Current] Historical      │
│  Token IDs: [51-55                ]       │
│  Exact Match: (●) YES  ( ) NO             │
│                                            │
│  [Generate Snapshot]                       │
└────────────────────────────────────────────┘
```

#### 2. Generate Snapshot

**User clicks**: "Generate Snapshot"

**Frontend calls**:
```javascript
GET /api/contracts/0x300...b08c2b/snapshot/current?tokenIds=51-55&exactMatch=true
```

**API Response**:
```json
{
  "success": true,
  "data": {
    "snapshot": [
      { "holderAddress": "0x1234...", "balance": "15", "tokensOwned": ["51", "52", "53", "54", "55"] },
      { "holderAddress": "0x5678...", "balance": "8", "tokensOwned": ["51", "52", "53", "54", "55"] }
      // ... 125 more holders (127 total)
    ],
    "metadata": {
      "totalSupply": "635",
      "uniqueHolders": 127,
      "tokenIdList": ["51", "52", "53", "54", "55"],
      "timestamp": "2025-10-29T12:48:26.430Z"
    }
  }
}
```

**UI displays**: "Total Holders: **127**" (only exact matches)

#### 3. Export CSV

**User clicks**: "CSV" export button

**Frontend calls**:
```javascript
GET /api/export/csv?type=snapshot&contract=0x300...b08c2b&tokenIds=51-55&exactMatch=true
```

**CRITICAL PARAMETERS PASSED**:
- ✅ `tokenIds=51-55` (will be expanded to ["51", "52", "53", "54", "55"])
- ✅ `exactMatch=true` (only holders with ALL tokens)
- ✅ `contract=0x300...b08c2b` (enables number_of_sets calculation)

#### 4. CSV Generation Process

**Export API executes**:

```typescript
// 1. Parse tokenIds into array
requestedTokenIds = ["51", "52", "53", "54", "55"] // Expanded from "51-55"

// 2. Set flag
includeNumberOfSets = true // Because requestedTokenIds.length > 0

// 3. Define CSV headers (6 columns)
csvHeaders = [
  'wallet_id',
  'number_of_sets',      // ← INCLUDED
  'total_tokens_held',
  'token_ids_held',
  'snapshot_time',
  'token_id_list'
]

// 4. For each holder, query database
for (const holder of holders) {
  // Query how many of EACH token (51, 52, 53, 54, 55) the holder owns
  const tokenBreakdown = await db.query(`
    SELECT token_id, balance
    FROM current_state
    WHERE contract_address = '0x300...b08c2b'
    AND address = '${holder.address}'
    AND token_id IN ('51', '52', '53', '54', '55')
  `)

  // Example result for holder 0x1234:
  // [
  //   { token_id: "51", balance: 3 },
  //   { token_id: "52", balance: 3 },
  //   { token_id: "53", balance: 3 },
  //   { token_id: "54", balance: 3 },
  //   { token_id: "55", balance: 3 }
  // ]

  if (tokenBreakdown.length < 5) {
    // Missing some tokens → number_of_sets = 0
    row.number_of_sets = 0
  } else {
    // Find minimum balance across all tokens
    const minBalance = Math.min(3, 3, 3, 3, 3) // = 3
    row.number_of_sets = 3
  }
}
```

#### 5. Downloaded CSV

**Filename**: `snapshot_exact_match_current_1730206106526.csv`

**Content**:
```csv
wallet_id,number_of_sets,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0x1234abcd...,3,15,51;52;53;54;55,2025-10-29T12:48:26.430Z,51;52;53;54;55
0x5678efgh...,2,10,51;52;53;54;55,2025-10-29T12:48:26.430Z,51;52;53;54;55
0x9abc1234...,0,8,51;52;54,2025-10-29T12:48:26.430Z,51;52;53;54;55
```

**Column Explanations**:
- `wallet_id`: Holder's Ethereum address
- `number_of_sets`: How many **complete sets** of tokens 51-55 they own (minimum balance across all 5 tokens)
- `total_tokens_held`: Total NFTs owned (sum of all balances)
- `token_ids_held`: Which specific tokens they own (semicolon-separated)
- `snapshot_time`: When snapshot was taken
- `token_id_list`: Which tokens were queried (51;52;53;54;55)

---

## API Workflow

### Phase 1: Frontend Preparation

**File**: `app/collections/[address]/snapshot/page.tsx` (lines 327-390)

```typescript
const exportData = async (format: 'csv' | 'json') => {
  const params: any = {
    type: 'snapshot',
    contract: address
  }

  // CRITICAL: Add token filtering parameters
  if (fullSeasonMode && selectedSeason) {
    params.fullSeason = 'true'
    params.season = selectedSeason
  } else if (tokenIds) {
    const tokenIdList = tokenIds.split(',').map(id => id.trim())
    const hasRange = tokenIdList.some(id => id.includes('-'))

    if (tokenIdList.length === 1 && !hasRange) {
      params.tokenId = tokenIdList[0]  // Single token
    } else {
      params.tokenIds = tokenIds        // Range or multiple
    }

    if (exactMatch !== null) {
      params.exactMatch = exactMatch ? 'true' : 'false'
    }
  }

  if (snapshotType === 'historical' && snapshotData.blockNumber) {
    params.blockNumber = snapshotData.blockNumber
  }

  console.log('📤 Exporting with params:', params)

  const response = await axios.get(`/api/export/${format}`, { params })
  // ... download blob
}
```

**Key Parameters Passed**:
- `type`: 'snapshot' (export type)
- `contract`: Contract address (e.g., '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b')
- `tokenIds` OR `tokenId`: Token filter (e.g., "51-55", "1-10, 15", "42")
- `exactMatch`: 'true' (all tokens) or 'false' (any token)
- `fullSeason`: 'true' (season mode) with `season` name
- `blockNumber`: (historical only) Block number for time travel

---

### Phase 2: CSV Export API Processing

**File**: `app/api/export/csv/route.ts` (lines 21-270)

#### Step 2.1: Extract Query Parameters

```typescript
const contractAddress = searchParams.get('contract')
const tokenId = searchParams.get('tokenId')
const tokenIds = searchParams.get('tokenIds')
const blockNumber = searchParams.get('blockNumber')
const fullSeasonMode = searchParams.get('fullSeason') === 'true'
const seasonName = searchParams.get('season')
const exactMatch = searchParams.get('exactMatch')
```

#### Step 2.2: Build Snapshot API URL

```typescript
const params = new URLSearchParams()
if (tokenId) params.append('tokenId', tokenId)
if (tokenIds) params.append('tokenIds', tokenIds)
if (fullSeasonMode) params.append('fullSeason', 'true')
if (seasonName) params.append('season', seasonName)
if (exactMatch) params.append('exactMatch', exactMatch)

const snapshotUrl = blockNumber
  ? `${baseUrl}/api/contracts/${contractAddress}/snapshot/historical?blockNumber=${blockNumber}&${params}`
  : `${baseUrl}/api/contracts/${contractAddress}/snapshot/current?${params}`
```

#### Step 2.3: Fetch Snapshot Data

```typescript
const response = await fetch(snapshotUrl)
const result = await response.json()
const holders = result.data.snapshot || []
```

#### Step 2.4: Parse Token IDs for Expansion

```typescript
let requestedTokenIds: string[] = []

if (fullSeasonMode && seasonName) {
  // Get season tokens (e.g., Season 1: tokens 1-22)
  const seasonGroup = getSeasonGroup(seasonName)
  requestedTokenIds = seasonGroup.tokenIds.map(id => id.toString())
} else if (tokenIds) {
  // Expand ranges: "51-55" → ["51", "52", "53", "54", "55"]
  // Mixed format: "1-10, 15, 20-25" → ["1", "2", ..., "10", "15", "20", ..., "25"]
  const parts = tokenIds.split(',').map(id => id.trim()).filter(id => id)
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(n => parseInt(n.trim()))
      for (let i = start; i <= end; i++) {
        requestedTokenIds.push(i.toString())
      }
    } else {
      requestedTokenIds.push(part)
    }
  }
} else if (tokenId) {
  // Single token
  requestedTokenIds = [tokenId]
}

const includeNumberOfSets = requestedTokenIds.length > 0
```

**Example Expansions**:
- `"51-55"` → `["51", "52", "53", "54", "55"]` (5 tokens)
- `"1-10, 15, 20-25"` → `["1", "2", ..., "10", "15", "20", "21", ..., "25"]` (17 tokens)
- `"42"` → `["42"]` (1 token)

#### Step 2.5: Define CSV Headers

```typescript
const csvHeaders = includeNumberOfSets
  ? ['wallet_id', 'number_of_sets', 'total_tokens_held', 'token_ids_held', 'snapshot_time', 'token_id_list']
  : ['wallet_id', 'total_tokens_held', 'token_ids_held', 'snapshot_time', 'token_id_list']
```

**Result**:
- If tokens specified → **6 columns** (includes `number_of_sets`)
- No tokens specified → **5 columns** (no `number_of_sets`)

#### Step 2.6: Calculate Number of Sets per Holder

```typescript
const csvRows = await Promise.all(holders.map(async (holder) => {
  const row = {
    wallet_id: holder.holderAddress,
    total_tokens_held: holder.balance,
    token_ids_held: holder.tokensOwned?.join(';') || '',
    snapshot_time: timestamp,
    token_id_list: tokenIdListStr
  }

  if (includeNumberOfSets && requestedTokenIds.length > 0 && contractAddress) {
    // Query database for per-token breakdown
    const placeholders = requestedTokenIds.map(() => '?').join(',')

    const tokenBreakdown = await db.prepare(`
      SELECT token_id, CAST(balance AS INTEGER) as balance
      FROM current_state
      WHERE contract_address = ?
      AND address = ?
      AND token_id IN (${placeholders})
      AND CAST(balance AS INTEGER) > 0
    `).all(contractAddress, holder.holderAddress, ...requestedTokenIds)

    if (tokenBreakdown.length < requestedTokenIds.length) {
      // Missing some tokens → number_of_sets = 0
      row.number_of_sets = 0
    } else {
      // Find minimum balance across all requested tokens
      const minBalance = Math.min(...tokenBreakdown.map(t => parseInt(t.balance)))
      row.number_of_sets = minBalance
    }
  }

  return row
}))
```

**Example for Holder 0x1234**:

**Requested Tokens**: `["51", "52", "53", "54", "55"]`

**Database Query Result**:
```json
[
  { "token_id": "51", "balance": 3 },
  { "token_id": "52", "balance": 3 },
  { "token_id": "53", "balance": 5 },
  { "token_id": "54", "balance": 3 },
  { "token_id": "55", "balance": 4 }
]
```

**Calculation**:
- All 5 tokens present ✅
- Balances: `[3, 3, 5, 3, 4]`
- Minimum: `Math.min(3, 3, 5, 3, 4)` = **3**
- `number_of_sets = 3` ✅

**CSV Row**:
```csv
0x1234...,3,18,51;52;53;54;55,2025-10-29T12:48:26.430Z,51;52;53;54;55
```

#### Step 2.7: Format and Return CSV

```typescript
const csvData = convertToCSV(csvRows, csvHeaders)

return new NextResponse(csvData, {
  status: 200,
  headers: {
    'Content-Type': 'text/csv',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-cache'
  }
})
```

---

## Token Filtering System

### Supported Token Input Formats

| Format | Example | Result | Description |
|--------|---------|--------|-------------|
| **Single token** | `42` | `["42"]` | One specific token |
| **Multiple tokens** | `1, 5, 10` | `["1", "5", "10"]` | Comma-separated list |
| **Token range** | `1-100` | `["1", "2", ..., "100"]` | All tokens in range |
| **Mixed format** | `1-10, 15, 20-25` | `["1", ..., "10", "15", "20", ..., "25"]` | Ranges + individual |
| **Season mode** | Season 1 | `["1", "2", ..., "22"]` | Predefined season tokens |

### Exact Match Modes

#### Exact Match = YES (All Tokens)

**Query Logic**:
```sql
SELECT address, SUM(balance) as total_balance
FROM current_state
WHERE contract_address = ?
AND token_id IN (51, 52, 53, 54, 55)
GROUP BY address
HAVING COUNT(DISTINCT token_id) = 5  -- Must own ALL 5 tokens
```

**Result**: Only holders who own **every** token in the list

**Use Case**: Find complete set collectors (e.g., holders of full monthly drop)

#### Exact Match = NO (Any Token)

**Query Logic**:
```sql
SELECT address, SUM(balance) as total_balance
FROM current_state
WHERE contract_address = ?
AND token_id IN (51, 52, 53, 54, 55)
GROUP BY address
-- No HAVING clause - returns anyone owning at least one
```

**Result**: All holders who own **at least one** token in the list

**Use Case**: Find all participants in a drop (even partial holders)

---

## Number of Sets Calculation

### What is "Number of Sets"?

**Definition**: For a given group of tokens, how many **complete sets** does a holder own?

**Formula**: `MIN(balance across all requested tokens)`

### Examples

#### Example 1: Complete Sets

**Requested Tokens**: `51-55` (5 tokens)

**Holder's Balances**:
```
Token 51: 3
Token 52: 3
Token 53: 3
Token 54: 3
Token 55: 3
```

**Calculation**: `MIN(3, 3, 3, 3, 3)` = **3**

**Result**: `number_of_sets = 3` ✅

**Interpretation**: This holder can form **3 complete sets** of tokens 51-55

---

#### Example 2: Uneven Distribution

**Requested Tokens**: `51-55`

**Holder's Balances**:
```
Token 51: 5
Token 52: 3
Token 53: 8
Token 54: 2  ← Bottleneck
Token 55: 10
```

**Calculation**: `MIN(5, 3, 8, 2, 10)` = **2**

**Result**: `number_of_sets = 2` ✅

**Interpretation**: Even though holder has 10 copies of token 55, they can only form **2 complete sets** because they only have 2 copies of token 54

---

#### Example 3: Missing Token

**Requested Tokens**: `51-55`

**Holder's Balances**:
```
Token 51: 5
Token 52: 3
Token 53: 0  ← MISSING
Token 54: 2
Token 55: 4
```

**Calculation**: `tokenBreakdown.length = 4 < 5` (missing token 53)

**Result**: `number_of_sets = 0` ❌

**Interpretation**: Cannot form any complete set without token 53

---

### Implementation Details

**Database Query** (Current Snapshot):
```sql
SELECT token_id, CAST(balance AS INTEGER) as balance
FROM current_state
WHERE contract_address = '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b'
AND address = '0x1234...'
AND token_id IN ('51', '52', '53', '54', '55')
AND CAST(balance AS INTEGER) > 0
```

**Database Query** (Historical Snapshot):
```sql
SELECT token_id, SUM(balance) as balance
FROM (
  -- Incoming transfers (to_address = holder)
  SELECT token_id, COUNT(*) as balance
  FROM events
  WHERE contract_address = ? AND to_address = ?
  AND token_id IN (51, 52, 53, 54, 55)
  AND block_number <= ?
  GROUP BY token_id

  UNION ALL

  -- Outgoing transfers (from_address = holder)
  SELECT token_id, -COUNT(*) as balance
  FROM events
  WHERE contract_address = ? AND from_address = ?
  AND token_id IN (51, 52, 53, 54, 55)
  AND block_number <= ?
  GROUP BY token_id
)
GROUP BY token_id
HAVING SUM(balance) > 0
```

**TypeScript Logic**:
```typescript
if (tokenBreakdown.length < requestedTokenIds.length) {
  // Missing at least one token
  row.number_of_sets = 0
} else {
  // All tokens present - find minimum
  const minBalance = Math.min(
    ...tokenBreakdown.map(t => parseInt(t.balance) || 0)
  )
  row.number_of_sets = minBalance
}
```

---

## CSV Format Specification

### Header Variants

#### With Token Filtering (6 columns)

```csv
wallet_id,number_of_sets,total_tokens_held,token_ids_held,snapshot_time,token_id_list
```

**Triggered when**: `tokenIds`, `tokenId`, or `fullSeasonMode` is specified

#### Without Token Filtering (5 columns)

```csv
wallet_id,total_tokens_held,token_ids_held,snapshot_time,token_id_list
```

**Triggered when**: No token parameters specified (all holders export)

---

### Column Specifications

| Column | Type | Description | Example | Notes |
|--------|------|-------------|---------|-------|
| `wallet_id` | string | Ethereum address (lowercase) | `0x1234abcd...` | Always present |
| `number_of_sets` | integer | Complete sets owned | `3` | Only if tokens specified |
| `total_tokens_held` | integer | Total NFT balance | `18` | Sum of all token balances |
| `token_ids_held` | string | Owned tokens (semicolon-separated) | `51;52;53;54;55` | Empty if none owned |
| `snapshot_time` | ISO 8601 | Snapshot timestamp | `2025-10-29T12:48:26.430Z` | UTC timezone |
| `token_id_list` | string | Queried tokens (semicolon-separated) | `51;52;53;54;55` | "all" if no filter |

---

### Sample CSV Outputs

#### Current Snapshot with Token Range (51-55, Exact Match)

**Filename**: `snapshot_exact_match_current_1730206106526.csv`

```csv
wallet_id,number_of_sets,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0x1234abcd1234abcd1234abcd1234abcd1234abcd,3,15,51;52;53;54;55,2025-10-29T12:48:26.430Z,51;52;53;54;55
0x5678efgh5678efgh5678efgh5678efgh5678efgh,2,10,51;52;53;54;55,2025-10-29T12:48:26.430Z,51;52;53;54;55
0x9abc1234,0,8,51;52;54,2025-10-29T12:48:26.430Z,51;52;53;54;55
```

**Interpretation**:
- Row 1: Holder owns 3 complete sets (can form 3 collections of 51-55)
- Row 2: Holder owns 2 complete sets (minimum balance is 2)
- Row 3: Holder missing token 53 → 0 complete sets

---

#### Historical Snapshot (Block 18500000, Full Season 1)

**Filename**: `snapshot_season1_fullseason_18500000.csv`

```csv
wallet_id,number_of_sets,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0xaaaa1111...,1,22,1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20;21;22,2024-11-15T08:30:00.000Z,1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20;21;22
0xbbbb2222...,2,44,1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20;21;22,2024-11-15T08:30:00.000Z,1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20;21;22
```

**Interpretation**:
- Only includes holders who owned **all 22 tokens** in Season 1 at block 18500000
- Row 1: 1 complete set (1 copy of each token)
- Row 2: 2 complete sets (2 copies of each token)

---

#### All Holders Export (No Token Filter)

**Filename**: `snapshot_current.csv`

```csv
wallet_id,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0x1111...,150,1;2;3;5;10;15;20;25;...,2025-10-29T12:48:26.430Z,all
0x2222...,42,15;20;25;30,2025-10-29T12:48:26.430Z,all
0x3333...,1,51,2025-10-29T12:48:26.430Z,all
```

**Interpretation**:
- No `number_of_sets` column (no specific token group requested)
- `token_id_list = "all"` indicates full snapshot (no filtering)

---

## Common Issues & Solutions

### Issue 1: CSV Shows "all" Instead of Token Range

**Symptom**:
```csv
wallet_id,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0x1234...,1803,,2025-10-29T12:48:26.430Z,all
```

**Expected**:
```csv
wallet_id,number_of_sets,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0x1234...,3,15,51;52;53;54;55,2025-10-29T12:48:26.430Z,51;52;53;54;55
```

**Root Cause**: Frontend export function not passing `tokenIds` parameter to export API

**Location**:
- `app/collections/[address]/snapshot/page.tsx` lines 327-390
- `app/snapshot/page.tsx` lines 260-338

**Fix**: Ensure export params include token filtering:
```typescript
const params: any = { type: 'snapshot', contract: address }

// CRITICAL: Add this block
if (fullSeasonMode && selectedSeason) {
  params.fullSeason = 'true'
  params.season = selectedSeason
} else if (tokenIds) {
  const tokenIdList = tokenIds.split(',').map(id => id.trim())
  const hasRange = tokenIdList.some(id => id.includes('-'))

  if (tokenIdList.length === 1 && !hasRange) {
    params.tokenId = tokenIdList[0]
  } else {
    params.tokenIds = tokenIds
  }

  if (exactMatch !== null) {
    params.exactMatch = exactMatch ? 'true' : 'false'
  }
}
```

**Verification**: Check browser console for:
```
📤 Exporting with params: { type: 'snapshot', contract: '0x300...', tokenIds: '51-55', exactMatch: 'true' }
```

---

### Issue 2: Missing `number_of_sets` Column

**Symptom**: CSV has only 5 columns instead of 6 (no `number_of_sets`)

**Root Cause 1**: `tokenIds` parameter not reaching export API (see Issue 1)

**Root Cause 2**: `contractAddress` is missing (legacy internal API calls)

**Fix**: Always pass `contract` parameter to export API:
```typescript
params.contract = address // For public page
// OR
params.contract = INTERNAL_COLLECTION_ADDRESS // For internal page
```

**Verification**: Export API logs should show:
```
✅ includeNumberOfSets: true
📊 Parsed requestedTokenIds: { count: 5, tokens: '51, 52, 53, 54, 55' }
```

---

### Issue 3: Wrong Number of Holders in CSV

**Symptom**: Snapshot shows 127 holders, but CSV has 1900+ rows

**Root Cause**: Export API calls snapshot API **without** token filtering parameters

**Fix**: Ensure all snapshot generation parameters are passed to export:
- ✅ `tokenIds` or `tokenId`
- ✅ `exactMatch`
- ✅ `fullSeason` + `season`
- ✅ `blockNumber` (for historical)

**Verification**:
1. Check browser console: `📤 Exporting with params:` should match `📡 Calling API with params:`
2. Export API should call snapshot API with same params
3. CSV row count should match snapshot holder count

---

### Issue 4: Incorrect `number_of_sets` Values

**Symptom**: `number_of_sets` shows wrong values (e.g., all 0s or incorrect minimum)

**Potential Causes**:

#### Cause A: Case Sensitivity Mismatch
**Database stores**: `0x1234ABCD...` (mixed case)
**Query uses**: `0x1234abcd...` (lowercase)

**Fix**: Ensure consistent lowercasing:
```typescript
contractAddress.toLowerCase()
holderAddress.toLowerCase()
```

#### Cause B: Token ID Type Mismatch
**Database stores**: Token IDs as strings `"51"`
**Query uses**: Integers `51`

**Fix**: Ensure token IDs are strings in placeholders:
```typescript
requestedTokenIds = ["51", "52", "53", "54", "55"] // Strings
```

#### Cause C: Historical Snapshot Logic Error
**Issue**: Using `current_state` table for historical snapshot

**Fix**: Check `blockNumber` parameter and use events reconstruction:
```typescript
if (blockNumber) {
  // Reconstruct from events table
} else {
  // Use current_state table
}
```

---

## Testing Guide

### Test Case 1: Single Token Export

**Setup**:
- Token IDs: `51`
- Exact Match: N/A (single token)

**Expected CSV**:
```csv
wallet_id,number_of_sets,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0x1111...,3,3,51,2025-10-29T12:00:00.000Z,51
0x2222...,5,5,51,2025-10-29T12:00:00.000Z,51
```

**Verification**:
- ✅ `number_of_sets` = balance (for single token)
- ✅ `token_id_list` = "51"
- ✅ Only holders of token 51

---

### Test Case 2: Token Range - Exact Match

**Setup**:
- Token IDs: `51-55`
- Exact Match: **YES**

**Expected Behavior**:
- Snapshot: 127 holders (only holders with ALL 5 tokens)
- CSV: 127 rows + 1 header

**Expected CSV**:
```csv
wallet_id,number_of_sets,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0xaaaa...,3,15,51;52;53;54;55,2025-10-29T12:00:00.000Z,51;52;53;54;55
0xbbbb...,2,10,51;52;53;54;55,2025-10-29T12:00:00.000Z,51;52;53;54;55
```

**Verification**:
- ✅ All rows have exactly 5 tokens in `token_ids_held`
- ✅ `number_of_sets` = minimum balance across 5 tokens
- ✅ Row count matches snapshot holder count

---

### Test Case 3: Token Range - Any Match

**Setup**:
- Token IDs: `51-55`
- Exact Match: **NO**

**Expected Behavior**:
- Snapshot: 800+ holders (anyone owning at least 1 token from 51-55)
- CSV: 800+ rows + 1 header

**Expected CSV**:
```csv
wallet_id,number_of_sets,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0xaaaa...,3,15,51;52;53;54;55,2025-10-29T12:00:00.000Z,51;52;53;54;55
0xbbbb...,0,8,51;52;54,2025-10-29T12:00:00.000Z,51;52;53;54;55
0xcccc...,0,2,55,2025-10-29T12:00:00.000Z,51;52;53;54;55
```

**Verification**:
- ✅ Some rows have partial tokens (e.g., only "55")
- ✅ `number_of_sets` = 0 for partial holders
- ✅ `number_of_sets` > 0 only for complete set holders

---

### Test Case 4: Full Season Mode (ClickCreate Collections)

**Setup**:
- Full Season Mode: **ON**
- Season: **Season 1** (tokens 1-22)

**Expected Behavior**:
- Snapshot: ~50 holders (only holders with ALL 22 tokens)
- CSV: ~50 rows + 1 header

**Expected CSV**:
```csv
wallet_id,number_of_sets,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0xaaaa...,1,22,1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20;21;22,2025-10-29T12:00:00.000Z,1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20;21;22
```

**Verification**:
- ✅ All rows have exactly 22 tokens
- ✅ `token_id_list` shows all 22 season tokens

---

### Test Case 5: Historical Snapshot

**Setup**:
- Token IDs: `51-55`
- Exact Match: YES
- Snapshot Type: **Historical**
- Date: `2024-11-15`

**Expected Behavior**:
- Snapshot: Holders as of block ~18500000
- CSV: Historical holder data with block number in filename

**Expected CSV**:
```csv
wallet_id,number_of_sets,total_tokens_held,token_ids_held,snapshot_time,token_id_list
0xaaaa...,2,10,51;52;53;54;55,2024-11-15T08:30:00.000Z,51;52;53;54;55
```

**Verification**:
- ✅ Filename includes block number: `snapshot_exact_match_18500000.csv`
- ✅ Data reflects balances at specified block
- ✅ `snapshot_time` matches historical date

---

## Debugging Checklist

When CSV export is not working as expected, check:

### ✅ Frontend Export Function

**File**: `app/collections/[address]/snapshot/page.tsx` or `app/snapshot/page.tsx`

- [ ] `exportData` function includes token filtering params
- [ ] `params.tokenIds` OR `params.tokenId` is set when tokens specified
- [ ] `params.exactMatch` is set ('true' or 'false')
- [ ] `params.contract` is set (contract address)
- [ ] `params.blockNumber` is set for historical snapshots
- [ ] Console log shows correct params: `📤 Exporting with params:`

---

### ✅ Export API Processing

**File**: `app/api/export/csv/route.ts`

- [ ] `searchParams.get('tokenIds')` returns correct value
- [ ] `searchParams.get('contract')` is not null
- [ ] Token range expansion works: `"51-55"` → `["51", "52", "53", "54", "55"]`
- [ ] `includeNumberOfSets` evaluates to `true`
- [ ] Console logs show:
  ```
  🔍 CSV Export Debug: { tokenIds: '51-55', ... }
  📊 Parsed requestedTokenIds: { count: 5, tokens: '51, 52, 53, 54, 55' }
  ✅ includeNumberOfSets: true
  ```

---

### ✅ Snapshot API Call

**File**: `app/api/export/csv/route.ts` (lines 43-68)

- [ ] Snapshot API URL includes all parameters
- [ ] Response `result.success` is `true`
- [ ] Response `result.data.snapshot` contains holders
- [ ] Response `result.data.metadata` contains token info
- [ ] Holder count matches expected filtered count

---

### ✅ Database Queries

**File**: `app/api/export/csv/route.ts` (lines 166-247)

- [ ] `contractAddress` is lowercase
- [ ] `holderAddress` is lowercase
- [ ] Token IDs in placeholders are strings (`"51"` not `51`)
- [ ] Query returns results (check `tokenBreakdown.length`)
- [ ] Balance values are integers (check CAST operations)

---

### ✅ CSV Output

- [ ] Header matches expected column count (5 or 6)
- [ ] `number_of_sets` column present when tokens specified
- [ ] `token_id_list` shows expanded tokens (e.g., "51;52;53;54;55")
- [ ] Row count matches snapshot holder count
- [ ] `number_of_sets` values are calculated correctly

---

## Related Files

### Frontend Pages
- [`app/collections/[address]/snapshot/page.tsx`](app/collections/[address]/snapshot/page.tsx) - Public snapshot page
- [`app/snapshot/page.tsx`](app/snapshot/page.tsx) - Internal snapshot tool (authorized only)

### API Routes
- [`app/api/export/csv/route.ts`](app/api/export/csv/route.ts) - CSV export API
- [`app/api/contracts/[address]/snapshot/current/route.ts`](app/api/contracts/[address]/snapshot/current/route.ts) - Current snapshot API
- [`app/api/contracts/[address]/snapshot/historical/route.ts`](app/api/contracts/[address]/snapshot/historical/route.ts) - Historical snapshot API

### Database Layer
- [`lib/database/adapter.ts`](lib/database/adapter.ts) - Database abstraction layer
- [`lib/database/init.ts`](lib/database/init.ts) - Database initialization

### Constants
- [`lib/constants/season-tokens.ts`](lib/constants/season-tokens.ts) - Season token definitions

---

## Version History

### v2.0 (2025-10-29)
- ✅ Fixed token filtering parameter propagation from frontend to export API
- ✅ Added comprehensive documentation with flow diagrams
- ✅ Enhanced `number_of_sets` calculation explanation
- ✅ Added debugging checklist and test cases

### v1.0 (2024-11-15)
- Initial CSV export system implementation
- Basic snapshot export functionality
- Single contract support

---

**End of Documentation**

For additional support, check:
- [VALIDATION_GUIDE.md](VALIDATION_GUIDE.md) - Data validation system
- [CLAUDE.md](CLAUDE.md) - Complete architecture guide
- [QUICKNODE-OPTIMIZATION.md](QUICKNODE-OPTIMIZATION.md) - RPC optimization
