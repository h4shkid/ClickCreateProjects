# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClickFrontEnd** - Universal multi-contract NFT analytics platform. Analyzes any ERC-721/ERC-1155 contract across multiple blockchains with wallet authentication, OpenSea integration, and comprehensive data validation. Evolved from single-collection tool to full multi-contract platform.

## Essential Commands

```bash
# Development
npm run dev      # Development server → http://localhost:3000
npm run build    # Production build (always run before committing major changes)
npm run lint     # Lint check (run before commits)

# Database Management
npx tsx scripts/init-multi-contract-db.js       # Initialize multi-contract database
npx tsx scripts/rebuild-state.js                # Rebuild current state from events (fixes balance issues)
npx tsx scripts/validate-data.ts --verbose      # Comprehensive data validation

# Blockchain Synchronization
npx tsx scripts/sync-blockchain.ts              # Full blockchain event sync
npx tsx scripts/comprehensive-sync.ts           # Sync + metadata fetching
npx tsx scripts/fetch-all-missing-metadata.ts   # Fetch only missing token metadata

# Data Validation (Critical before exports!)
npx tsx scripts/validate-data.ts --verbose              # Full validation
npx tsx scripts/validate-data.ts --type balance        # Quick balance check
npx tsx scripts/validate-data.ts --type blocks --start-block X --end-block Y

# Contract Management
npx tsx scripts/check-active-contracts.ts       # List active contracts
npx tsx scripts/verify-onchain-supply.ts        # Verify on-chain vs database totals
```

## Script Organization

The `scripts/` directory contains 50+ utility scripts organized by purpose:

### Database Management
- `init-multi-contract-db.js` - Initialize multi-contract database
- `rebuild-state.js` / `rebuild-contract-state.ts` - Rebuild current state from events
- `rebuild-all-contracts.ts` - Rebuild state for all contracts
- `migrate-to-new-db.ts` - Migrate between database versions
- `check-postgres-schema.ts` - Verify PostgreSQL schema integrity
- `fix-all-sequences.ts` - Fix PostgreSQL sequence issues
- `deep-sequence-check.ts` - Deep check of all sequences

### Blockchain Synchronization
- `sync-blockchain.ts` - Full blockchain event sync
- `comprehensive-sync.ts` - Sync + metadata fetching
- `fill-sync-gaps.ts` - Fill missing block ranges
- `full-resync-from-zero.ts` - Complete resync (use with caution!)
- `auto-sync-and-validate.ts` - Automated sync with validation
- `check-latest-blockchain-block.ts` - Verify latest synced block

### Data Validation & Verification
- `validate-data.ts` - Comprehensive validation suite
- `verify-onchain-supply.ts` - Verify on-chain vs database totals
- `validate-and-fix-contract.ts` - Contract-specific validation + fixes
- `check-contract-events.ts` - Verify event data integrity
- `check-current-state-schema.ts` - Verify current_state table

### Metadata & Collection Management
- `fetch-all-missing-metadata.ts` - Fetch missing token metadata
- `fetch-all-metadata.ts` - Fetch all metadata (force refresh)
- `fetch-metadata.ts` - Fetch metadata for specific tokens
- `check-collection.ts` - Verify collection data
- `fix-all-collections.ts` - Repair collection metadata
- `fix-all-collections-fast.ts` - Fast collection repair

### Contract Management
- `check-active-contracts.ts` - List active contracts
- `check-contract-exists.ts` - Verify contract in database
- `check-contract-type.ts` - Verify contract type detection
- `check-contracts-addresses.ts` - List all contract addresses

### PostgreSQL-Specific
- `export-sqlite-to-json.ts` - Export SQLite to JSON
- `import-json-to-postgres.ts` - Import JSON to PostgreSQL
- `fast-import-to-postgres.ts` - Fast bulk import
- `verify-postgres-data.ts` - Verify PostgreSQL data integrity
- `fix-postgres-balance-types.ts` - Fix balance column types
- `fix-postgres-sequences.ts` - Fix sequence numbering

**Usage Pattern:**
```bash
# List all available scripts
ls scripts/*.ts scripts/*.js

# Run any script with tsx (TypeScript) or node (JavaScript)
npx tsx scripts/[script-name].ts
node scripts/[script-name].js
```

## High-Level Architecture

### 1. Multi-Contract Platform Design

**Core Principle:** Single application supporting unlimited ERC-721/ERC-1155 contracts with shared blockchain data cache.

**Key Tables:**
- `contracts` - Registry of all supported contracts
- `user_profiles` - Wallet-based authentication and user data
- `blockchain_cache` - Shared event data across all users/contracts (reduces RPC calls)
- `current_state` - Real-time holder balances per contract
- `user_snapshots` - Historical snapshot history per user

**Critical Pattern:** Event sourcing architecture
- Blockchain events stored in `blockchain_cache` table
- Current state rebuilt from events via `rebuild-state.js`
- Never modify `current_state` directly; always process through events
- Use `validate-data.ts` to verify integrity

### 2. Database Layer (`lib/database/`)

**Schema Evolution:**
- `schema.sql` - Legacy single-contract schema (deprecated)
- `enhanced-schema.sql` - Enhanced single-contract (deprecated)
- **`multi-contract-schema.sql`** - Current multi-contract design ✅

**Database Adapter Pattern:**
- `adapter.ts` - Unified interface for SQLite (dev) and PostgreSQL (prod)
- **Auto-detection**: Uses `POSTGRES_URL` env variable to choose database type
- **Development**: SQLite in `./data/nft-snapshot.db` (no setup required)
- **Production**: PostgreSQL via connection string (deployed on Vercel/Railway)
- Handles BigInt as TEXT (SQLite limitation)
- WAL mode for concurrent reads (SQLite only)
- Always parse BigInt values in JavaScript: `BigInt(value)`

**Serverless Optimization (Vercel/Railway):**
```typescript
// PostgreSQL pool config for serverless
max: 1,                        // Minimize connections
idleTimeoutMillis: 10000,      // Release idle connections quickly
connectionTimeoutMillis: 10000, // Handle cold starts
allowExitOnIdle: true          // Allow process to exit
```

**Best Practices:**
- Keep API routes lightweight (< 10s execution)
- Use background jobs for long-running syncs (sync-worker service)
- Cache aggressively (15min snapshots, 1hr metadata)
- Minimize database connection time

**Critical Tables Structure:**
```sql
contracts (id, address, name, symbol, contract_type, chain_id, ...)
user_profiles (id, wallet_address, username, ...)
blockchain_cache (contract_address, event_type, block_number, ...)
current_state (contract_address, owner_address, token_id, balance)
user_snapshots (user_id, contract_id, snapshot_data, ...)
```

### 3. Contract Management System (`lib/contracts/`)

**Three-Layer Architecture:**

1. **Detection (`detector.ts`)** - Auto-detect ERC-721/ERC-1155 standards
   - Probes contract for standard function signatures
   - Validates token compliance before registration
   - Multi-chain support: Ethereum, Polygon, Arbitrum, Base, Shape

2. **Registry (`registry.ts`)** - Contract registration and validation
   - Stores contract metadata in `contracts` table
   - Manages contract lifecycle (active/inactive)
   - Tracks usage statistics for trending contracts

3. **ABI Manager (`abi-manager.ts`)** - Dynamic ABI loading
   - Standard ABI templates for ERC-721/ERC-1155
   - Custom ABI support for non-standard contracts
   - Event signature mapping for Transfer/TransferSingle/TransferBatch

### 4. Blockchain Integration (`lib/blockchain/`)

**Provider Hierarchy with Automatic Failover:**
1. QuickNode (if `NEXT_PUBLIC_QUICKNODE_ENDPOINT` set)
2. Alchemy (if `NEXT_PUBLIC_ALCHEMY_API_KEY` set)
3. Public RPCs (fallback)

**Key Files:**
- `provider.ts` - Provider setup with retry logic (max 3 retries, exponential backoff)
- `event-fetcher.ts` - Block range chunking (default: 1000 blocks, max: 5000, min: 100)
- `sync.ts` - Sync orchestration with progress tracking
- `hybrid-snapshot-generator.ts` - Snapshot generation combining cached + live data

**Critical Pattern:** Always use chunked fetching for large block ranges to avoid RPC timeouts.

### 5. OpenSea Integration (`app/api/opensea/`)

**Multi-Endpoint Fallback Strategy:**
1. Contract endpoint (preferred) - `/api/v2/chain/{chain}/contract/{address}`
2. Collection endpoint - `/api/v2/collections/{slug}`
3. NFT endpoint (fallback) - `/api/v2/chain/{chain}/contract/{address}/nfts/{tokenId}`

**Configuration:**
- Requires `OPENSEA_API_KEY` in environment
- Rate limit: 4 requests/second (built-in throttling)
- Chain support: Ethereum, Polygon, Arbitrum, Base (Shape falls back to Ethereum)
- Image domains configured in `next.config.js`: `i.seadn.io`, `i2.seadn.io`, `i3.seadn.io`

**Response Caching:** Collection metadata cached for 1 hour to reduce API usage.

### 6. Wallet Integration (`lib/wagmi/`, `lib/auth/`)

**RainbowKit + Wagmi Stack:**
- **WalletConnect Project ID Required:** `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (from Reown)
- Custom Shape chain configuration (chain ID 360)
- JWT-based authentication using wallet signatures
- Session management with `jose` library

**Auth Flow:**
1. User connects wallet via RainbowKit
2. Request signature for authentication message
3. Backend verifies signature and issues JWT
4. JWT stored in httpOnly cookie for API authentication
5. Protected routes check JWT before rendering

### 7. ENS (Ethereum Name Service) Integration (`lib/ens/`)

**Server-Side ENS Resolution:**
- ENS lookups happen server-side to avoid CORS errors
- Batch resolution API: `/api/ens/batch`
- Caching: 1 hour TTL for resolved addresses
- Fallback: Returns original address if ENS resolution fails

**Usage in Components:**
- Display ENS names instead of truncated addresses
- Automatic resolution in holder tables
- Maintains address checksums for Ethereum standards

**Example:**
```typescript
// Batch resolve multiple addresses
const response = await fetch('/api/ens/batch', {
  method: 'POST',
  body: JSON.stringify({ addresses: ['0x...', '0x...'] })
})
// Returns: { '0x...': 'vitalik.eth', '0x...': null }
```

### 8. Data Validation System (`lib/validation/`, see VALIDATION_GUIDE.md)

**Critical for Data Integrity:**

**Validation Types:**
- **Balance Validation:** Recalculates from events, compares with database
- **Block Range Validation:** Detects missing blocks in event data
- **Snapshot Validation:** Cross-validates with live blockchain
- **CSV Validation:** Verifies export data structure and calculations

**When to Validate:**
- ✅ Before important CSV exports (mandatory)
- ✅ After major blockchain sync operations
- ✅ When troubleshooting balance discrepancies
- ✅ Before generating historical snapshots

**Auto-Validation:** Historical snapshots include validation metadata automatically.

### 9. API Route Architecture (Next.js 15 App Router)

**Route Organization:**
```
app/api/
├── snapshot/           # Legacy single-contract endpoints
├── contracts/
│   ├── search/        # Multi-contract discovery
│   ├── register/      # New contract registration
│   └── [address]/
│       ├── snapshot/  # Contract-specific snapshots
│       └── validate/  # Data validation endpoints
├── auth/              # Authentication (session, verify, logout)
├── opensea/           # OpenSea API proxy
└── utils/             # Utility endpoints (date-to-block conversion)
```

**API Patterns:**
- **Legacy Routes**: `/api/snapshot/*` (single ClickCreate contract)
- **Multi-Contract Routes**: `/api/contracts/[address]/*` (any contract)
- Internal calls: Use `fetch()` (same application, faster)
- External calls: Use `axios` (timeout/retry logic, better error handling)
- Response format: `{ success: boolean, data?: any, error?: string }`
- Historical endpoints: Accept both `date` (user-friendly) and `blockNumber` (precise)

### 10. Frontend Page Structure

**Route Patterns:**
- `/contracts` - Primary interface for contract discovery and registration
- `/contracts/[address]` - Universal contract analytics (any ERC-721/ERC-1155)
- `/collections/[address]` - Special ClickCreate collections with season features
- `/collections/[address]/snapshot` - Snapshot generation (authorized wallet only)

**Component Architecture:**
```
components/
├── layout/            # Navigation, Footer
├── contracts/         # Contract discovery, search, registration
│   ├── ContractDiscovery.tsx    # Main contract card grid
│   └── ContractSnapshot.tsx     # Snapshot generation UI
├── ui/                # Reusable UI components
└── wallet/            # Wallet connection components
```

**Design System:**
- Dark theme: Background `#0A0A0A`, Primary `#FF6B35` (orange), Accent `#FFA500`
- Glassmorphism effects: `backdrop-blur` with transparency (limit to 2-3 per viewport)
- Professional icons: Lucide React only (no emojis unless explicitly requested)
- Typography: Inter font via Google Fonts

## Critical Development Patterns

### React Hooks Order (Strict!)
```typescript
// 1. All useState hooks first
const [data, setData] = useState()
const [loading, setLoading] = useState(false)

// 2. All useEffect hooks
useEffect(() => { ... }, [deps])

// 3. Custom hooks
const { user } = useAuth()

// 4. Handler functions
const handleClick = () => { ... }

// 5. Early returns AFTER all hooks
if (!data) return <Loading />
```

**Never:** Call hooks conditionally or inside loops.

### Database Operations
```typescript
// ❌ WRONG - Direct state modification
db.run("UPDATE current_state SET balance = ?", [newBalance])

// ✅ CORRECT - Event sourcing
db.run("INSERT INTO events (...) VALUES (...)", [eventData])
// Then run: npx tsx scripts/rebuild-state.js
```

### API Consistency
```typescript
// Internal Next.js API calls
const response = await fetch('/api/snapshot/current')

// External API calls (OpenSea, Alchemy, etc.)
const response = await axios.get(url, { timeout: 10000 })
```

### BigInt Handling
```typescript
// SQLite stores BigInt as TEXT
const balance = BigInt(row.balance) // Always parse
db.run("INSERT INTO current_state (balance) VALUES (?)", [balance.toString()])
```

### Logging Standards
Use emoji prefixes for visual identification:
- 🎯 Start of operation
- 📡 API call
- ✅ Success
- ❌ Error
- 🔍 Validation
- 📊 Statistics

### Contract Card Design Pattern
Follow the established pattern in `ContractDiscovery.tsx`:
- Gradient backgrounds: `bg-gradient-to-br from-card/40 to-card/20`
- Collection logos: 80px with verification badges
- Chain icons with `group/icon` tooltips (prevents parent hover interference)
- Hover effects: `hover:border-primary/50 hover:shadow-xl`

## Environment Configuration

Required in `.env.local`:

```env
# Blockchain RPC (at least one required)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
NEXT_PUBLIC_QUICKNODE_ENDPOINT=https://your-endpoint.quiknode.pro/

# External APIs (REQUIRED for full functionality)
OPENSEA_API_KEY=your_opensea_api_key                    # Required for collection metadata
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_reown_id     # Required for wallet connection

# Authentication
JWT_SECRET=your-super-secret-jwt-key                    # Required for auth

# Database
DATABASE_PATH=./data/nft-snapshot.db                    # SQLite path (dev)
POSTGRES_URL=postgres://...                              # PostgreSQL (prod, optional)

# Optional WebSocket
NEXT_PUBLIC_ALCHEMY_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/key
```

## Common Workflows

### Adding a New Feature
```bash
npm run dev                          # Start dev server
# Make changes to code
npm run lint                         # Check for issues
npm run build                        # Ensure production build works
# Test in browser
git add . && git commit -m "feat: description"
```

### Debugging Balance Issues
```bash
# Step 1: Validate current data
npx tsx scripts/validate-data.ts --type balance

# Step 2: If errors found, rebuild from events
npx tsx scripts/rebuild-state.js

# Step 3: Re-validate
npx tsx scripts/validate-data.ts --type balance

# Step 4: Check specific contract
npx tsx scripts/verify-onchain-supply.ts
```

### Adding a New Contract
```bash
# Option 1: Via UI (recommended)
# Navigate to /contracts page → Click "Add Contract" → Enter address

# Option 2: Via API
curl -X POST http://localhost:3000/api/contracts/register \
  -H "Content-Type: application/json" \
  -d '{"address":"0x...", "chainId":1}'

# Option 3: Via script (internal collections)
npx tsx scripts/add-internal-collection.js

# Then sync blockchain data
npx tsx scripts/sync-blockchain.ts
```

### Generating Safe CSV Exports
```bash
# Step 1: Validate data first
npx tsx scripts/validate-data.ts --verbose

# Step 2: Fix any errors
npx tsx scripts/rebuild-state.js

# Step 3: Export with validation
curl "http://localhost:3000/api/export/csv?type=snapshot&validate=true" > export.csv
```

## Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
rm -rf .next
npm run build

# Module resolution issues
rm -rf node_modules package-lock.json
npm install
```

### Database Issues
```bash
# Database locked (SQLite)
lsof | grep nft-snapshot.db    # Find blocking processes
# Kill processes and restart

# Schema issues
npx tsx scripts/init-multi-contract-db.js

# Balance discrepancies
npx tsx scripts/rebuild-state.js
npx tsx scripts/validate-data.ts --type balance

# Sequence/ID Issues (PostgreSQL only)
npx tsx scripts/fix-all-sequences.ts         # Fix out-of-sync sequences
npx tsx scripts/deep-sequence-check.ts       # Verify sequence integrity

# Contract-specific issues
npx tsx scripts/verify-onchain-supply.ts     # Check on-chain vs database
npx tsx scripts/rebuild-contract-state.ts    # Rebuild specific contract
npx tsx scripts/validate-and-fix-contract.ts # Validate + auto-fix
```

### Blockchain Sync Issues
```bash
# Rate limiting (429 errors)
# - Reduce chunk size in sync scripts
# - Check provider quotas
# - Add delays between requests

# Missing events/gaps
npx tsx scripts/sync-blockchain.ts
npx tsx scripts/validate-data.ts --type blocks

# Provider failures
# - Verify API keys in .env.local
# - Check provider status pages
# - Test endpoints with curl
```

### OpenSea Integration
```bash
# Metadata not loading
# - Verify OPENSEA_API_KEY in .env.local
# - Check rate limits (4 req/sec)
# - Ensure contract exists on chain

# Image loading failures
# - Add CDN domains to next.config.js
# - Check browser console for CORS
# - Verify URLs are accessible
```

### Wallet Connection
```bash
# WalletConnect not working
# - Verify NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
# - Get new ID from https://cloud.reown.com
# - Clear browser cache

# Auth failures
# - Check JWT_SECRET in .env.local
# - Verify signature format
# - Check browser console
```

## Testing

**Current Approach:** Manual testing via scripts and API endpoints.

### Quick Smoke Tests
```bash
# Start dev server
npm run dev

# Test contract endpoints (replace with actual contract address)
curl http://localhost:3000/api/contracts/0x300e7a5fb0ab08af367d5fb3915930791bb08c2b
curl http://localhost:3000/api/contracts/search?chain=1

# Test legacy endpoints
curl http://localhost:3000/api/snapshot/current

# Test utility endpoints
curl "http://localhost:3000/api/utils/date-to-block?date=2023-10-15"

# Test ENS resolution
curl -X POST http://localhost:3000/api/ens/batch \
  -H "Content-Type: application/json" \
  -d '{"addresses":["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"]}'

# Database validation
npx tsx scripts/validate-data.ts --verbose

# Blockchain sync test (small range)
npx tsx scripts/sync-blockchain.ts
```

### Manual Testing Checklist
**Core Functionality:**
- [ ] Dev server starts without errors (`npm run dev`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Linting passes (`npm run lint`)

**UI/UX:**
- [ ] Home page loads with correct styling
- [ ] Contract discovery shows contracts with OpenSea metadata
- [ ] Wallet connection (RainbowKit modal opens and connects)
- [ ] ENS resolution shows in holder tables (e.g., vitalik.eth)
- [ ] Contract cards display collection images correctly

**Data Operations:**
- [ ] Snapshot generation completes for test contract
- [ ] Data validation passes (`validate-data.ts`)
- [ ] CSV export downloads with valid data
- [ ] Analytics charts render with correct data
- [ ] Historical snapshots work with date picker

**API Endpoints:**
- [ ] Multi-contract endpoints respond (`/api/contracts/[address]/*`)
- [ ] Legacy endpoints still work (`/api/snapshot/*`)
- [ ] Auth endpoints handle wallet signatures
- [ ] OpenSea metadata loads correctly

## 🔴 Critical: Internal vs Public Snapshot Access

**The snapshot page has TWO access levels:**

### Internal Snapshot Access (Authorized Wallet Only)
- **Route:** `/collections/[address]/snapshot`
- **Access:** Only wallet `0x4Ae8B436e50f762Fa8fad29Fd548b375fEe968AC`
- **Features:** Full season mode, advanced filtering, historical comparisons, validation tools
- **Purpose:** ClickCreate team internal use for ANY collection

### Public Snapshot Access (All Users)
- **Route:** Same `/collections/[address]/snapshot`
- **Access:** All authenticated users via "My Collections"
- **Entry:** Users click "Snapshot" from collection cards in "My Collections" page
- **Features:** Same page, standard snapshot generation

**When working on snapshots, always clarify if changes affect:**
- ✅ Internal access only (authorized wallet)
- ✅ Public access only (all users)
- ✅ Both (entire snapshot page)

## Performance Requirements

- Current snapshot: < 3 seconds
- Historical snapshot: < 10 seconds
- Support: 100,000+ events, 10,000+ holders
- Cache TTL: 15 min (snapshots), 1 hour (metadata)
- Database: WAL mode for concurrent reads

## Important Files Reference

**Architecture:**
- `lib/database/multi-contract-schema.sql` - Database schema (read this first!)
- `lib/database/adapter.ts` - Database abstraction layer
- `lib/contracts/detector.ts` - Contract standard detection
- `lib/blockchain/provider.ts` - RPC provider setup with failover

**Key Components:**
- `components/contracts/ContractDiscovery.tsx` - Main discovery interface
- `components/contracts/ContractSnapshot.tsx` - Snapshot generation UI
- `app/api/contracts/[address]/snapshot/historical/route.ts` - Historical snapshots

**Critical Scripts:**
- `scripts/init-multi-contract-db.js` - Database initialization
- `scripts/rebuild-state.js` - Fix data integrity
- `scripts/validate-data.ts` - Comprehensive validation
- `scripts/sync-blockchain.ts` - Blockchain synchronization

## Additional Documentation

- **[VALIDATION_GUIDE.md](VALIDATION_GUIDE.md)** - Detailed validation system documentation
- **[QUICKNODE-OPTIMIZATION.md](QUICKNODE-OPTIMIZATION.md)** - RPC optimization strategies
- **[../IMPLEMENTATION_PROGRESS.md](../IMPLEMENTATION_PROGRESS.md)** - Platform evolution history
- **[../AGENTS.md](../AGENTS.md)** - Repository-wide coding standards
