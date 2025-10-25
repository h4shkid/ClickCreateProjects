# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClickCreate Projects** - Multi-project monorepo for NFT analytics and blockchain data processing.

### Primary Project: ClickFrontEnd

Universal multi-contract NFT analytics platform built with Next.js 15, TypeScript, and Tailwind CSS. Supports any ERC-721/ERC-1155 contract across multiple blockchains with wallet authentication, user profiles, and OpenSea integration.

**📋 For detailed development guidance, refer to: [ClickFrontEnd/CLAUDE.md](ClickFrontEnd/CLAUDE.md)**

### Repository Structure

```
ClickCreateProjects/
├── ClickFrontEnd/              # ⭐ PRIMARY PROJECT - Default working directory
│   ├── CLAUDE.md              # Complete architecture and development guide
│   ├── VALIDATION_GUIDE.md    # Data validation system documentation
│   ├── QUICKNODE-OPTIMIZATION.md  # RPC optimization guide
│   ├── app/                   # Next.js 15 app directory (pages + API routes)
│   ├── components/            # React components
│   ├── lib/                   # Core business logic
│   ├── scripts/               # Database management and sync utilities
│   └── data/                  # SQLite database files (not in git)
├── sync-worker/               # Standalone sync service for production deployment
├── clickcreate-sync-worker/   # Legacy sync worker (deprecated)
├── nft-snapshot-tool/         # Legacy single-contract version (deprecated)
├── _archive/                  # Historical documentation
├── IMPLEMENTATION_PROGRESS.md # Platform evolution timeline
├── AGENTS.md                  # Repository-wide coding standards
└── CLAUDE.md                  # This file - repository overview
```

**Default Working Directory:** Unless explicitly stated otherwise, work in `ClickFrontEnd/`.

## Quick Start

```bash
cd ClickFrontEnd
npm install
npm run dev  # http://localhost:3000
```

**First-time setup:**
```bash
cd ClickFrontEnd
npm install
# Configure environment variables (see ClickFrontEnd/CLAUDE.md for details)
npx tsx scripts/init-multi-contract-db.js
npm run dev
```

## Key Architecture Patterns

### Multi-Project Repository
- **ClickFrontEnd** (active): Main Next.js application with all features
- **sync-worker** (active): Production-ready standalone sync service for Railway/Render
- Legacy projects in root are deprecated; all development happens in ClickFrontEnd

### Database Architecture
- **Development**: SQLite with WAL mode in `ClickFrontEnd/data/`
- **Production**: PostgreSQL via `sync-worker/` service (or `POSTGRES_URL` env var)
- **Schema Migration**: Multi-contract schema (`multi-contract-schema.sql`) replaced legacy single-contract design
- **Auto-detection**: Database adapter automatically selects SQLite or PostgreSQL based on `POSTGRES_URL`
- **Serverless optimization**: PostgreSQL pool configured for Vercel/Railway (max: 1 connection, quick idle timeout)

### Deployment Model
- **Frontend + API**: ClickFrontEnd deployed to Vercel (serverless Next.js)
- **Background Sync**: sync-worker deployed separately for continuous blockchain syncing
- **Database**: Shared PostgreSQL instance accessed by both services

## Essential Commands

```bash
# Navigate to main project (do this first!)
cd ClickFrontEnd

# Development
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Lint code (run before commits)

# Database operations
npx tsx scripts/init-multi-contract-db.js  # Initialize database
npx tsx scripts/rebuild-state.js           # Fix data integrity issues
npx tsx scripts/validate-data.ts --verbose # Comprehensive validation

# Blockchain sync
npx tsx scripts/sync-blockchain.ts              # Full sync
npx tsx scripts/comprehensive-sync.ts           # Sync + metadata
npx tsx scripts/fetch-all-missing-metadata.ts   # Metadata only
```

## Script Organization

The `ClickFrontEnd/scripts/` directory contains 50+ utility scripts. Key categories:

### Database Management
- `init-multi-contract-db.js` - Initialize database
- `rebuild-state.js` - Rebuild current state from events
- `fix-all-sequences.ts` - Fix PostgreSQL sequences

### Blockchain Sync
- `sync-blockchain.ts` - Full event sync
- `comprehensive-sync.ts` - Sync + metadata
- `fill-sync-gaps.ts` - Fill missing blocks

### Data Validation
- `validate-data.ts` - Comprehensive validation
- `verify-onchain-supply.ts` - Verify totals
- `validate-and-fix-contract.ts` - Contract validation

### Metadata & Collections
- `fetch-all-missing-metadata.ts` - Fetch metadata
- `fix-all-collections.ts` - Repair collections

See [ClickFrontEnd/CLAUDE.md](ClickFrontEnd/CLAUDE.md) for complete script documentation.

## Technology Stack

**Framework:** Next.js 15 (App Router), React 19, TypeScript 5.9
**Styling:** Tailwind CSS 3.4 with dark theme + glassmorphism
**Blockchain:** ethers.js 6.15, wagmi 2.16, viem 2.37
**Database:** SQLite (dev) / PostgreSQL (prod) via better-sqlite3/pg
**Authentication:** RainbowKit 2.2, JWT (jose)
**APIs:** OpenSea API v2, Alchemy/QuickNode RPC

## Environment Configuration

Key environment variables (see `ClickFrontEnd/CLAUDE.md` for complete list):

```env
# Blockchain RPC (at least one required)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
NEXT_PUBLIC_QUICKNODE_ENDPOINT=https://your-endpoint.quiknode.pro/

# External APIs (required)
OPENSEA_API_KEY=your_opensea_api_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-reown-project-id

# Authentication
JWT_SECRET=your-jwt-secret
```

## Common Development Workflows

### Working on a new feature
```bash
cd ClickFrontEnd
git checkout -b feature/your-feature
npm run dev
# Make changes
npm run lint
npm run build  # Ensure production build works
git commit -am "feat: your feature description"
```

### Debugging data issues
```bash
cd ClickFrontEnd
# Validate current data
npx tsx scripts/validate-data.ts --verbose
# If errors found, rebuild state from events
npx tsx scripts/rebuild-state.js
# Re-validate
npx tsx scripts/validate-data.ts --type balance
```

### Adding a new contract
```bash
cd ClickFrontEnd
# Contract auto-registration happens via UI (/contracts page)
# Or manually via API: POST /api/contracts/register
# Sync blockchain data
npx tsx scripts/sync-blockchain.ts
```

## Important Documentation

- **[ClickFrontEnd/CLAUDE.md](ClickFrontEnd/CLAUDE.md)** - Complete architecture, API reference, development guidelines
- **[IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md)** - Evolution from single to multi-contract platform
- **[ClickFrontEnd/VALIDATION_GUIDE.md](ClickFrontEnd/VALIDATION_GUIDE.md)** - Data validation workflow
- **[AGENTS.md](AGENTS.md)** - Coding standards and conventions

## Project-Specific Notes

### ClickFrontEnd
- Uses SQLite for local development (faster, simpler)
- PostgreSQL for production (via `POSTGRES_URL` env variable)
- Multi-contract schema with user profiles and shared caching
- OpenSea integration requires API key
- ENS resolution (server-side via `/api/ens/batch`)
- Serverless-optimized for Vercel deployment
- See `ClickFrontEnd/CLAUDE.md` for complete details

### sync-worker
- Production sync service for Railway/Render deployment
- Connects to PostgreSQL via `POSTGRES_URL`
- Self-healing with gap detection and retry logic
- See `sync-worker/README.md` for deployment instructions

## Troubleshooting

### Development server won't start
```bash
cd ClickFrontEnd
rm -rf .next node_modules
npm install
npm run dev
```

### Database errors
```bash
cd ClickFrontEnd
# Balance/state issues
npx tsx scripts/rebuild-state.js
npx tsx scripts/validate-data.ts --verbose

# PostgreSQL sequence issues
npx tsx scripts/fix-all-sequences.ts
npx tsx scripts/deep-sequence-check.ts
```

### Blockchain sync issues
- Check RPC provider API keys in `.env.local`
- Verify provider quotas (Alchemy/QuickNode dashboards)
- Run with smaller block ranges if hitting rate limits

### Wrong working directory
Most commands require being in `ClickFrontEnd/` directory. Check with:
```bash
pwd  # Should show: .../ClickCreateProjects/ClickFrontEnd
```
