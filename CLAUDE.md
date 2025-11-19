# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

CCSnapshotApp is a professional NFT holder snapshot tool for Ethereum mainnet. It supports any ERC-721 or ERC-1155 collection with multi-contract architecture, historical snapshots, and advanced filtering capabilities.

**Production URL:** https://snapshot.clickcreate.io

## Development Commands

### Frontend (Next.js App in ClickFrontEnd/)

```bash
cd ClickFrontEnd

# Development
npm install
npm run dev          # Start dev server (http://localhost:3000)

# Production build
npm run build
npm start

# Linting
npm run lint
```

### Database Management Scripts

All scripts run from `ClickFrontEnd/` directory using `npx tsx`:

```bash
# Initialize database (first-time setup)
npx tsx scripts/init-multi-contract-db.js

# Validate data integrity
npx tsx scripts/validate-data.ts --verbose

# Rebuild holder state from events (fixes discrepancies)
npx tsx scripts/rebuild-state.js

# Manual blockchain sync
npx tsx scripts/sync-blockchain.ts

# Fix PostgreSQL sequences after manual inserts
npx tsx scripts/fix-all-sequences.ts

# Check contract existence and status
npx tsx scripts/check-collection.ts
npx tsx scripts/check-contract-exists.ts
```

### Sync Worker (Standalone Service)

```bash
cd sync-worker

# Development
npm run dev

# Production (with memory management)
npm start            # Uses --max-old-space-size=460 for 512MB instances
```

## Architecture

### Two-Service Deployment Model

The platform consists of **two separate deployments** sharing a single PostgreSQL database:

1. **Frontend + API** (Vercel)
   - Next.js 15 App Router application
   - API routes for snapshots, authentication, metadata
   - File location: `ClickFrontEnd/`

2. **Sync Worker** (Render/Railway)
   - Standalone Node.js service
   - Continuously syncs blockchain events
   - File location: `sync-worker/`
   - Entry point: `index-v2.js`

**Critical:** Both services MUST connect to the same `POSTGRES_URL`. They share tables and coordinate via database state.

### Event-Based State Reconstruction

The system does NOT track live balances. Instead:

1. Raw `Transfer` events are stored in `events` table (ERC-721) and `TransferSingle`/`TransferBatch` (ERC-1155)
2. Holder balances are **rebuilt from events** for each snapshot request
3. Current state is cached in `current_state` table but can be regenerated from events
4. Historical snapshots query events up to a specific block number

**Why this matters:** If `current_state` is out of sync, run `rebuild-state.js` to regenerate it from events. The events table is the source of truth.

### Database Adapter Pattern

The codebase supports both SQLite (local development) and PostgreSQL (production) via an adapter pattern in `lib/database/adapter.ts`:

- `SQLiteAdapter`: Uses `better-sqlite3` for local development
- `PostgresAdapter`: Uses `pg` Pool for production
- `createDatabaseAdapter()`: Factory function that detects environment and returns appropriate adapter

**Pattern:** All database queries use the adapter interface, not direct SQL library calls. Prepared statements are abstracted via `PreparedStatement` interface.

### Multi-Contract Architecture

Unlike typical NFT tools that support one collection, this platform supports **unlimited collections** in a shared database:

- `contracts` table: Registry of all tracked collections
- `events` table: Has `contract_address` column to separate events
- `current_state` table: Has `contract_address` column for holder balances
- Snapshots filter by `contractAddress` parameter

### Snapshot Generation Types

Located in `lib/processing/snapshot-generator.ts`:

1. **Full Snapshot** (`snapshotType: "full"`)
   - All holders with their balances
   - Sorted by total balance descending

2. **Full Season** (`snapshotType: "full-season"`)
   - Holders who own at least one token from each ID in `tokenIds` array
   - Sorted by number of complete sets, then total balance
   - Used for PFP projects with seasons/editions

3. **Exact Match** (`snapshotType: "exact-match"`)
   - Holders who own the exact `tokenIds` specified
   - Used for specific trait combinations or rare token sets

### Authentication & Quota System

Located in `lib/auth/`:

- Wallet-based authentication using RainbowKit + wagmi
- JWT tokens for session management (middleware in `lib/auth/middleware.ts`)
- Daily sync quota: 2 new collections per wallet per day (tracked in `wallet_new_syncs` table)
- IP-based wallet binding: 1 wallet per IP address for 24 hours (`ip_wallet_binding` table)
- Quota resets at 00:00 UTC daily

**Important:** Snapshots of already-synced collections do NOT count toward quota. Only new collection additions count.

### Blockchain Sync Process

Sync Worker (`sync-worker/index-v2.js`) polls database for contracts needing sync:

1. Query `contracts` table for collections where `sync_status != 'completed'`
2. Fetch events in 2000-block chunks (Alchemy limit)
3. Insert events in 500-event batches (memory safety)
4. Update `last_synced_block` and `sync_progress` in `contracts` table
5. On completion, rebuild current state and set `sync_status = 'completed'`

**Self-healing features:**
- Gap detection: Checks for missing block ranges
- Duplicate prevention: Events have unique constraint on `(contract_address, transaction_hash, log_index)`
- Checkpoint system: Resumes from `last_synced_block` after crashes
- Retry logic: 3 attempts with exponential backoff

### API Route Structure

All API routes in `ClickFrontEnd/app/api/`:

- `contracts/` - Contract registration and management
- `snapshot/` - Snapshot generation (current, historical, date-range)
- `auth/` - Wallet authentication
- `user/` - User profile and quota stats
- `nft/` - Token metadata and gallery
- `opensea/` - Collection metadata from OpenSea API
- `ens/` - ENS name resolution

**Protected routes:** Most routes require JWT authentication via `lib/auth/middleware.ts`. Check for `Authorization: Bearer <token>` header.

## Environment Variables

### Frontend (Vercel) - Required

```bash
POSTGRES_URL=postgres://user:password@host:5432/database?sslmode=require
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
OPENSEA_API_KEY=your_opensea_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_reown_project_id
JWT_SECRET=min_32_character_random_string
NEXT_PUBLIC_APP_URL=https://snapshot.clickcreate.io
```

### Sync Worker (Render) - Required

```bash
POSTGRES_URL=postgres://user:password@host:5432/database?sslmode=require
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
PORT=3001
```

**Critical:** `POSTGRES_URL` must be identical in both deployments. Always include `?sslmode=require` for PostgreSQL connections.

See `.env.example` in `ClickFrontEnd/` for detailed setup instructions.

## Common Development Patterns

### Adding a New API Route

1. Create route handler in `app/api/your-route/route.ts`
2. Use `createDatabaseAdapter()` for database access
3. Add JWT authentication if needed: `import { verifyAuth } from '@/lib/auth/middleware'`
4. Return `NextResponse.json()` for responses
5. Use `try/catch` with appropriate error responses

### Adding a New Snapshot Type

1. Add logic to `lib/processing/snapshot-generator.ts`
2. Update `snapshotType` union type in TypeScript
3. Add corresponding preset in `lib/processing/snapshot-presets.ts`
4. Update API documentation

### Running Database Migrations

1. Create migration SQL file in `ClickFrontEnd/migrations/` or `sync-worker/migrations/`
2. Apply manually via `psql` or database dashboard
3. Update schema file in `lib/database/multi-contract-schema.sql`
4. Test with `rebuild-state.js` to ensure compatibility

### Testing Snapshot Generation Locally

```bash
cd ClickFrontEnd

# 1. Ensure database is initialized
npx tsx scripts/init-multi-contract-db.js

# 2. Add test contract (if not exists)
# Use frontend UI at localhost:3000 or via API

# 3. Sync blockchain data
npx tsx scripts/sync-blockchain.ts

# 4. Test snapshot generation
# Use frontend UI or curl API endpoints

# 5. Validate data
npx tsx scripts/validate-data.ts --verbose
```

## Key Technical Constraints

### Rate Limits

- **Alchemy RPC:** 300M compute units/month (free tier), 330 CU/second
- **OpenSea API:** 500 requests/minute
- **Database:** Use 1 connection max for serverless (Vercel functions)

### Memory Constraints

- **Vercel Functions:** 1024MB max (free tier 250MB)
- **Render Free Tier:** 512MB
- Sync worker uses chunking (`CHUNK_SIZE: 2000`, `DB_BATCH_SIZE: 500`) to stay within limits

### Database Performance

- All queries should use indexes on `contract_address`, `block_number`, `owner_address`
- Large collections (>10k holders) may take 30-60 seconds for snapshots
- `current_state` table acts as cache; rebuild if performance degrades

## Deployment Architecture

See `DEPLOYMENT_GUIDE.md` for complete instructions. Quick reference:

1. **Database:** Neon or Supabase PostgreSQL
2. **Frontend:** Vercel (auto-deploy from `main` branch)
3. **Sync Worker:** Render (deploy from separate repo `CCSnapshotWorker`)
4. **Verification:** Use `HANDOFF_CHECKLIST.md`

**Production URLs:**
- Frontend: https://snapshot.clickcreate.io
- Worker health: https://your-worker.onrender.com/health

## Troubleshooting

### "Database connection failed"

- Verify `POSTGRES_URL` format includes `?sslmode=require`
- Check database firewall allows external connections
- Test: `psql "your_postgres_url"`

### "Snapshot timeout or incorrect balances"

- Run `npx tsx scripts/rebuild-state.js` to regenerate `current_state` from events
- Check `events` table for gaps: `npx tsx scripts/validate-data.ts`
- Verify sync worker is running: curl worker health endpoint

### "Daily sync limit reached"

- Quota resets at 00:00 UTC
- Check quota: GET `/api/user/sync-stats`
- Only NEW collections count toward quota

### "RPC provider error"

- Check Alchemy dashboard for quota usage
- Verify `NEXT_PUBLIC_ALCHEMY_API_KEY` in environment
- Consider adding `NEXT_PUBLIC_QUICKNODE_ENDPOINT` as fallback

## Code Standards

- TypeScript strict mode enabled
- React Server Components by default (use `'use client'` only when needed)
- API routes use JWT authentication for protected endpoints
- Database queries use parameterized statements (SQL injection prevention)
- ESLint + Prettier configured (run `npm run lint`)
- Conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
