# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClickCreate Projects** - This repository contains multiple projects related to NFT analytics and blockchain data processing. The primary project is **ClickFrontEnd**, a universal multi-contract NFT analytics platform.

### Primary Project: ClickFrontEnd

**ClickFrontEnd** is a modern, universal multi-contract NFT analytics platform built with Next.js 15, TypeScript, and Tailwind CSS. Originally designed for a single collection, it has evolved into a comprehensive platform supporting any ERC-721/ERC-1155 contract across multiple blockchains with wallet-based authentication, user profiles, and OpenSea integration.

**📋 For complete development guidance, refer to: `ClickFrontEnd/CLAUDE.md`**

The ClickFrontEnd directory contains the authoritative CLAUDE.md file with comprehensive architecture documentation, development guidelines, and technical specifications.

## Quick Start

```bash
# Navigate to main project
cd ClickFrontEnd

# Install dependencies and start development
npm install
npm run dev

# View at http://localhost:3000
```

## Repository Structure

```
ClickCreateProjects/
├── ClickFrontEnd/              # Main NFT analytics platform (PRIMARY PROJECT)
│   ├── CLAUDE.md              # ⭐ Authoritative development guide
│   ├── VALIDATION_GUIDE.md    # Data validation system documentation
│   ├── QUICKNODE-OPTIMIZATION.md  # QuickNode RPC optimization guide
│   ├── TEST_COLLECTION_SNAPSHOTS.md  # Collection snapshot testing guide
│   ├── app/                   # Next.js 15 app directory
│   ├── components/            # React components
│   ├── lib/                   # Core libraries and utilities
│   ├── scripts/               # Database and sync scripts
│   └── data/                  # SQLite database files
├── nft-snapshot-tool/         # Legacy single-contract version (deprecated)
├── _archive/                  # Historical files and documentation
├── IMPLEMENTATION_PROGRESS.md # Project evolution timeline
└── AGENTS.md                  # Repository development guidelines
```

## Key Features

- **Universal Multi-Contract Support**: Analyze any ERC-721/ERC-1155 contract
- **Wallet Authentication**: RainbowKit integration with user profiles
- **Multi-Chain Support**: Ethereum, Polygon, Arbitrum, Base, Shape
- **OpenSea Integration**: Collection metadata and image optimization
- **Real-time Analytics**: Holder tracking, transfer monitoring, snapshot generation
- **Data Validation**: Comprehensive validation system with CLI and UI tools
- **Professional UI**: Dark theme with glassmorphism effects and responsive design

## Important Documentation Files

- **ClickFrontEnd/CLAUDE.md** - Complete architecture, commands, and development guidelines
- **IMPLEMENTATION_PROGRESS.md** - Evolution from single to multi-contract platform
- **ClickFrontEnd/VALIDATION_GUIDE.md** - Data validation workflow and best practices
- **AGENTS.md** - Repository-wide coding standards and conventions

## Common Issues & Quick Fixes

### Development Server Won't Start
```bash
cd ClickFrontEnd
rm -rf .next node_modules
npm install
npm run dev
```

### Database Issues
```bash
cd ClickFrontEnd
# Rebuild database state from events
npx tsx scripts/rebuild-state.js
# Validate data integrity
npx tsx scripts/validate-data.ts --verbose
```

### Blockchain Sync Errors
```bash
cd ClickFrontEnd
# Full blockchain sync
npx tsx scripts/sync-blockchain.ts
# Comprehensive sync with metadata
npx tsx scripts/comprehensive-sync.ts
```

### Missing Metadata
```bash
cd ClickFrontEnd
# Fetch only missing metadata
npx tsx scripts/fetch-all-missing-metadata.ts
```

## Technology Stack

**Framework:** Next.js 15 (App Router), React 19, TypeScript 5.9
**Styling:** Tailwind CSS 3.4
**Blockchain:** ethers.js 6.15, wagmi 2.16, viem 2.37
**Database:** SQLite (better-sqlite3) with WAL mode
**Authentication:** RainbowKit 2.2, JWT (jose)
**APIs:** OpenSea API v2, Etherscan-compatible RPCs

## Environment Requirements

See `ClickFrontEnd/CLAUDE.md` for complete environment variable configuration. Key requirements:
- `NEXT_PUBLIC_ALCHEMY_API_KEY` or `NEXT_PUBLIC_QUICKNODE_ENDPOINT`
- `OPENSEA_API_KEY` (required for collection metadata)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` (required for wallet connection)
- `JWT_SECRET` (required for authentication)