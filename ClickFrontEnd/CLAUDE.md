# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClickFrontEnd** - A universal multi-contract NFT analytics platform built with Next.js 15, TypeScript, and Tailwind CSS. Originally designed for a single ClickCreate collection, it has been transformed into a comprehensive platform supporting any ERC-721/ERC-1155 contract across multiple blockchains. The application features wallet-based authentication, user profiles, shared blockchain data caching, and sophisticated contract discovery with OpenSea integration.

## 🔴 CRITICAL: INTERNAL vs PUBLIC SNAPSHOT ACCESS - READ THIS FIRST! 🔴

**The snapshot page has TWO different access levels:**

### 1. **INTERNAL SNAPSHOT ACCESS** (Restricted - ClickCreate Team Only)
- **Page**: `/collections/[address]/snapshot`
- **Access Control**: Only accessible by authorized wallet (`0x4Ae8B436e50f762Fa8fad29Fd548b375fEe968AC`)
- **Purpose**: Internal use for ClickCreate team to generate advanced snapshots for ANY collection
- **Advanced Features** (only available to internal wallet):
  - Full Season mode (holders with ALL tokens in a season)
  - Season quick-select buttons (Season 1, 2, 3, All Seasons, SubPasses Only, Entire Collection)
  - Advanced token filtering with exact match options
  - Historical snapshots with date range comparison
  - Blockchain sync controls
  - Data validation tools
- **UI**: Compact single-column layout (max-w-4xl) with all advanced controls
- **Recently Updated**: Redesigned to be more compact and easier to use

### 2. **PUBLIC SNAPSHOT ACCESS** (User-facing)
- **Page**: Same route `/collections/[address]/snapshot`
- **Access Control**: Available to ALL authenticated users for collections in "My Collections"
- **Entry Point**: Users click "Snapshot" button from their collection cards in "My Collections" page
- **Purpose**: Allow users to generate basic snapshots for collections they've added to their profile
- **Features** (standard users see):
  - Same page as internal but WITHOUT wallet restriction check
  - All features available but intended for simpler public use
  - Users can only snapshot collections they've added to "My Collections"

### Key Distinction:
- **SAME PAGE** (`/collections/[address]/snapshot`) serves BOTH purposes
- **INTERNAL ACCESS**: Bypasses "My Collections" requirement, shows to authorized wallet only
- **PUBLIC ACCESS**: Users access via "My Collections" → click collection → "Snapshot" button
- When user mentions "internal snapshot" = they mean the wallet-restricted version I just redesigned
- When user mentions "public snapshot" or "My Collections snapshot" = they mean user-accessible version

**When working on snapshot features, ALWAYS clarify if changes should affect:**
- ✅ Internal access only (authorized wallet)
- ✅ Public access only (all users)
- ✅ Both (the entire snapshot page)

## Essential Commands

```bash
# Development
npm run dev      # Start development server on http://localhost:3000
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint (run this after making changes)

# Database initialization
npx tsx scripts/init-db.js                      # Initialize SQLite database (legacy)
npx tsx scripts/init-multi-contract-db.js       # Initialize multi-contract database
npx tsx scripts/apply-enhanced-schema.js        # Apply enhanced schema
npx tsx scripts/rebuild-state.js                # Rebuild current state from events

# Blockchain synchronization
npx tsx scripts/sync-blockchain.ts              # Full blockchain sync
npx tsx scripts/comprehensive-sync.ts           # Comprehensive data sync with metadata

# Metadata operations
npx tsx scripts/fetch-metadata.ts               # Fetch single token metadata
npx tsx scripts/fetch-all-metadata.ts           # Batch metadata fetching
npx tsx scripts/fetch-all-missing-metadata.ts   # Fetch only missing metadata

# Data validation
npx tsx scripts/validate-data.ts --verbose      # Comprehensive data validation
npx tsx scripts/validate-data.ts --type balance # Quick balance validation

# Contract management (Multi-contract platform)
npx tsx scripts/add-internal-collection.js      # Add internal collection to database
npx tsx scripts/remove-collection.js            # Remove collection from database
npx tsx scripts/find-deployment-block.js        # Find contract deployment block

# Database utilities
npx tsx scripts/debug-sync-status.js            # Debug synchronization status
npx tsx scripts/compare-holder-data.js          # Compare holder data snapshots
npx tsx scripts/fix-duplicate-tokens.js         # Fix duplicate token entries
```

## Available Scripts Reference

**Database Setup & Migration:**
- `init-db.js` - Legacy single-contract database initialization
- `init-multi-contract-db.js` - Multi-contract platform database setup
- `apply-enhanced-schema.js` - Apply schema enhancements
- `migrate-to-multi-contract.js` - Migrate from single to multi-contract schema
- `add-progress-column.js` - Database schema updates

**Blockchain Synchronization:**
- `sync-blockchain.ts` - Full blockchain event synchronization
- `comprehensive-sync.ts` - Complete sync with metadata fetching
- `debug-sync-status.js` - Debug and inspect sync status
- `find-deployment-block.js` - Find contract creation block

**Data Processing:**
- `rebuild-state.js` - Rebuild current state from blockchain events
- `rebuild-current-state.js` - Alternative state rebuilding script
- `fix-duplicate-tokens.js` - Clean duplicate token records
- `compare-holder-data.js` - Compare holder snapshots

**Metadata Management:**
- `fetch-metadata.ts` - Fetch metadata for specific token
- `fetch-all-metadata.ts` - Batch fetch all token metadata
- `fetch-all-missing-metadata.ts` - Fetch only missing metadata

**Validation & Testing:**
- `validate-data.ts` - Comprehensive data validation
- `test-wallet-integration.js` - Test wallet connection setup
- `test-auth-database.js` - Test authentication database

**Contract Management:**
- `add-internal-collection.js` - Register internal collections
- `remove-collection.js` - Remove collections from platform
- `download-all-holders.js` - Export holder data
- `quick-complete-holders.js` - Quick holder analysis

## High-Level Architecture

### Multi-Contract Platform Architecture

The platform underwent a complete transformation from single-collection to universal multi-contract support. Key architectural changes:

1. **Multi-Contract Database Layer** (`lib/database/`)
   - **Primary Schema**: `multi-contract-schema.sql` - Complete multi-contract database design
   - **Legacy Schema**: `enhanced-schema.sql` - Enhanced single-collection schema  
   - **Core Tables**: `contracts`, `user_profiles`, `user_snapshots`, `contract_sync_status`, `blockchain_cache`
   - **Shared Data**: Blockchain data cache shared across users to reduce API usage
   - **User System**: Wallet-based authentication with profiles and snapshot history
   - SQLite with WAL mode for concurrent access and TEXT fields for BigInt compatibility

1a. **Date-Based Snapshot Architecture** (`lib/utils/date-to-block.ts`)
   - **User-Friendly Interface**: Frontend uses date inputs (YYYY-MM-DD), backend handles block conversion
   - **DateToBlockConverter**: Automatic date-to-block conversion using ~12 second Ethereum block time
   - **Date Range Support**: Single date or date range comparisons with block accuracy verification
   - **API Flexibility**: All historical endpoints accept both `date` and `blockNumber` parameters
   - **Validation Integration**: All date-based operations include automatic data validation

2. **Contract Management System** (`lib/contracts/`)
   - **Contract Detection**: `detector.ts` - Automatic ERC-721/ERC-1155 standard detection
   - **Contract Registry**: `registry.ts` - Registration and validation of new contracts
   - **ABI Management**: `abi-manager.ts` - Dynamic ABI loading for standard and custom contracts
   - Multi-chain support: Ethereum, Polygon, Arbitrum, Base, Shape

3. **Wallet Integration & Authentication** (`lib/wagmi/`, `lib/auth/`)
   - **RainbowKit Integration**: Complete wallet connection with Reown project ID
   - **Multi-Chain Support**: Ethereum, Polygon, Arbitrum, Base, and custom Shape chain
   - **Wallet-Based Auth**: JWT-based authentication using wallet signatures
   - **User Profiles**: Username, display name, bio, profile images

4. **OpenSea Integration** (`app/api/opensea/`)
   - **OpenSea API v2**: Complete integration with proper API key authentication
   - **Collection Metadata**: Fetches collection names, descriptions, logos, social links
   - **Multi-Endpoint Strategy**: Contract → Collection → NFT endpoint fallbacks
   - **Chain Support**: Ethereum, Polygon, Arbitrum, Base (Shape fallback to Ethereum)
   - **Image Domain Configuration**: `i.seadn.io`, `i2.seadn.io`, `i3.seadn.io` configured in Next.js

5. **Blockchain Integration** (`lib/blockchain/`)
   - Dual provider setup with automatic failover (QuickNode → Alchemy → Public RPCs)
   - Automatic retry logic with exponential backoff (max 3 retries)
   - ERC-721/ERC-1155 token standard support
   - Block range chunking (default: 1000 blocks, max: 5000, min: 100)

6. **Processing Pipeline** (`lib/processing/`)
   - Event-to-database processing with automatic deduplication
   - Current and historical snapshot generation
   - Multi-token balance calculation across multiple token IDs
   - Batch processing with configurable concurrency limits

7. **Advanced Features** (`lib/advanced/`)
   - Merkle tree generation for airdrops (keccak256)
   - Analytics engine with holder distribution, whale tracking, Gini coefficient
   - Multi-tier caching system (L1 memory, L2 disk)
   - Rate limiting with sliding window and token bucket strategies

8. **Data Validation System** (`lib/validation/`, `VALIDATION_GUIDE.md`)
   - **Comprehensive Validation**: `data-validator.ts` - Multi-layer data integrity verification
   - **Auto-Validation**: Historical snapshots include validation metadata automatically
   - **Manual Validation**: "Validate Data" button for on-demand comprehensive checks
   - **Balance Validation**: Recalculates holder balances from events and cross-validates  
   - **Block Range Validation**: Ensures completeness of blockchain event data
   - **CSV Export Validation**: Optional validation with `?validate=true` parameter
   - **Health Status**: Color-coded indicators (GOOD/FAIR/POOR) with error/warning counts
   - **Validation Types**: Full, balance, blocks, snapshot, CSV structure validation

### API Routes (Next.js 15 App Router)

**Core Analytics APIs** (`app/api/`):
- `/snapshot/current` - Get current holder snapshot
- `/snapshot/historical` - Get historical snapshot with date or block parameter
- `/snapshot/date-range` - Date range comparison snapshots
- `/analytics/summary` - Analytics summary data
- `/analytics/transfers` - Transfer activity analytics
- `/export/csv` & `/export/json` - Data export endpoints with optional validation

**Multi-Contract APIs**:
- `/contracts/search` - Search and filter contracts with pagination
- `/contracts/register` - Register new ERC-721/ERC-1155 contracts with wallet auth
- `/contracts/trending` - Get trending/popular contracts
- `/contracts/[address]` - Get individual contract details
- `/contracts/[address]/snapshot/historical` - Historical snapshots with date range support
- `/contracts/[address]/validate` - Data validation endpoints (full, balance, blocks, snapshot)
- `/contracts/[address]/date-range` - Get available date range for contract data

**Utility APIs**:
- `/utils/date-to-block` - Convert dates to block numbers and vice versa

**Authentication APIs**:
- `/auth/session` - Get current user session
- `/auth/verify-signature` - Verify wallet signature for authentication
- `/auth/logout` - User logout

**User Management APIs**:
- `/users/profile` - User profile management
- `/users/contracts` - User's tracked contracts and snapshots

**External Integration APIs**:
- `/opensea/collection` - OpenSea API v2 integration for collection metadata
- `/dashboard/stats` - Real-time platform statistics (contracts, users, snapshots)

### Frontend Pages

**Public Pages**:
- `/` - Dashboard with real-time system stats and feature overview
- `/contracts` - **Primary Interface**: Contract discovery with search, filtering, and registration
- `/contracts/[address]` - Universal contract analytics (any ERC-721/ERC-1155)
- `/collections/[address]` - Special collection pages with ClickCreate-specific features
- `/gallery` - NFT gallery with metadata display
- `/analytics` - Comprehensive analytics dashboard  
- `/monitor` - Real-time blockchain event monitoring

**Protected Pages** (Wallet Authentication Required):
- `/snapshot` - Internal snapshot tool (authorized wallet only)
- `/contracts/[address]/snapshot` - Contract snapshot generation (authorized wallet only)
- `/collections/[address]/snapshot` - Collection snapshot with full season features (authorized wallet only)
- `/profile` - User profile management
- `/my-collections` - User's tracked contracts

### Key UI Components

**Contract Discovery** (`components/contracts/`):
- `ContractDiscovery.tsx` - **Core Component**: Visually appealing contract cards with OpenSea integration
  - Search and filtering capabilities
  - Contract registration form
  - Collection logos and descriptions from OpenSea API v2
  - Chain icons with tooltips
  - Verification badges and contract details
- `ContractSnapshot.tsx` - **Enhanced Snapshot Component**: Full-featured snapshot generation
  - Date range comparison functionality (start/end date selection)
  - Integrated data validation with visual status indicators
  - CSV export with automatic validation
  - Support for any ERC-721/ERC-1155 contract

**Layout & Navigation** (`components/layout/`):
- `Navigation.tsx` - Main navigation with wallet connection integration
- `Footer.tsx` - Footer with professional Lucide icons

**Wallet Integration** (`components/wallet/`):
- `WalletConnection.tsx` - RainbowKit integration with custom styling

## Performance Requirements

- Current snapshot generation: < 3 seconds
- Historical snapshot generation: < 10 seconds  
- Support for 100,000+ events, 10,000+ holders
- Real-time WebSocket updates with auto-reconnection
- Cache TTL: 15 minutes for snapshots, 1 hour for metadata
- Database in WAL mode for concurrent reads

## Environment Configuration

Required in `.env.local`:
```env
# Blockchain RPC Providers (at least one required)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
NEXT_PUBLIC_QUICKNODE_ENDPOINT=https://your-endpoint.quiknode.pro/

# Legacy Contract Configuration (for migration)
NEXT_PUBLIC_CONTRACT_ADDRESS=0x300e7a5fb0ab08af367d5fb3915930791bb08c2b
NEXT_PUBLIC_CHAIN_ID=1

# WebSocket Endpoints (optional)
NEXT_PUBLIC_ALCHEMY_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/key
NEXT_PUBLIC_QUICKNODE_WS_URL=wss://your-endpoint.quiknode.pro/

# Database
DATABASE_PATH=./data/nft-snapshot.db

# External APIs (REQUIRED)
OPENSEA_API_KEY=your_opensea_api_key  # Required for collection metadata

# Wallet Integration (REQUIRED)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-reown-project-id

# Authentication
JWT_SECRET=your-super-secret-jwt-key-for-production
```

## Design System

### Color Palette (Dark Theme)
- Background: `#0A0A0A` (Rich Black)
- Foreground: `#FAFAFA` (White)
- Primary: `#FF6B35` (Vibrant Orange)
- Accent: `#FFA500` (Amber)
- Card: `#1A1A1A` (Elevated surfaces)
- Border: `#2A2A2A` (Subtle borders)
- Muted Text: `#9CA3AF` (Secondary text)

### UI Implementation
- **Glassmorphism Effects**: `backdrop-filter: blur()` with transparency for cards and overlays
- **Orange Gradient Accents**: CTAs and highlights using `bg-gradient-to-r from-primary to-accent`
- **Professional Icons**: Lucide React icons throughout (no emojis)
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints
- **Smooth Transitions**: `cubic-bezier(0.4, 0, 0.2, 1)` for all interactions
- **Typography**: Inter font via Google Fonts

### Contract Card Design
- **Gradient Backgrounds**: `bg-gradient-to-br from-card/40 to-card/20` with glassmorphism
- **Collection Logos**: 80px images with verification badges and fallbacks
- **Prominent Descriptions**: Styled containers with `bg-background/30 backdrop-blur-sm`
- **Chain Icons**: Hover tooltips using Tailwind's `group/icon` modifier pattern
- **Interactive Elements**: Hover effects with `hover:border-primary/50` and `hover:shadow-xl`

## Development Guidelines

### Multi-Contract Platform Patterns
1. **Contract Validation**: Always validate contract addresses and detect ERC standard before registration
2. **Database Schema**: Use `multi-contract-schema.sql` for new features, maintain backward compatibility
3. **User Authentication**: Implement wallet-based authentication for all user-specific features
4. **Shared Caching**: Leverage `blockchain_cache` table to reduce API usage across users
5. **OpenSea Integration**: Use API v2 endpoints with proper error handling and image domain configuration
6. **Data Validation**: Use validation system before critical operations - run `npx tsx scripts/validate-data.ts` before important CSV exports

### React Hooks Best Practices
7. **Hook Order**: Always declare hooks in consistent order: `useState`, `useEffect`, custom hooks, followed by handler functions
8. **Effect Dependencies**: Include all contract addresses and critical state in useEffect dependency arrays
9. **State Management**: Separate loading states, data states, and error states for clear component behavior
10. **Conditional Hooks**: Never use hooks inside conditions - use early returns after all hooks are declared

### API Consistency Patterns  
11. **Backend APIs**: Use `fetch()` for internal Next.js API route calls within the same application
12. **Frontend Components**: Use `axios` for external API calls and complex requests with timeout/retry logic
13. **Error Handling**: Always wrap in try-catch with `console.error()` and user-friendly error messages
14. **Response Format**: Use standardized `{ success: boolean, data?: any, error?: string }` format
15. **Parameter Flexibility**: Accept both `date` (user-friendly) and `blockNumber` (precise) parameters in historical APIs

### Page Routing Patterns
16. **Universal Contracts**: Use `/contracts/[address]` for any ERC-721/ERC-1155 contract analytics
17. **Special Collections**: Use `/collections/[address]` for ClickCreate collections with season features
18. **Access Control**: Snapshot pages require specific wallet authorization (`AUTHORIZED_SNAPSHOT_WALLET`)
19. **Route Consistency**: Always include breadcrumbs and back navigation for sub-pages

### Debugging and Logging Standards
20. **Emoji Logging**: Use emojis for visual log identification: 🎯 (start), 📡 (API), ✅ (success), ❌ (error), 🔍 (validation), 📊 (stats)
21. **Error Context**: Always log full error context including axios response data and stack traces
22. **Progress Tracking**: Implement real-time progress updates with percentage indicators for long operations
23. **Demo Data Handling**: Use robust demo data detection to avoid false error alerts
24. **Network Error Handling**: Implement graceful degradation for auto-polling intervals with timeout control

### Code Standards
25. **TypeScript**: Strict mode enabled, all code must be properly typed
26. **Database Operations**: Always use TEXT for BigInt values, parse in JavaScript using `BigInt()`
27. **Error Handling**: All blockchain operations need retry logic with exponential backoff
28. **Component Patterns**: Follow existing patterns, especially the contract card design in `ContractDiscovery.tsx`
29. **Performance**: Limit glassmorphism to 2-3 elements per viewport for GPU performance
30. **Data Integrity**: Always run `npx tsx scripts/rebuild-state.js` after major blockchain sync operations

### UI/UX Guidelines
31. **Professional Design**: Use Lucide React icons, no emojis unless explicitly requested
32. **Tooltip Implementation**: Use `group/icon` pattern for isolated hover triggers
33. **Image Optimization**: Configure Next.js image domains for external services (OpenSea, IPFS)
34. **Responsive Design**: Mobile-first approach with proper breakpoint handling
35. **Validation UI**: Include validation status indicators and error displays for data-critical components
36. **Date Range UI**: Implement radio button toggles for single vs range date selection with clear labeling
37. **Dashboard Stats**: Display real database statistics with meaningful trend indicators and fallback states

## Common Development Tasks

```bash
# After making changes
npm run lint
npm run build

# Verify blockchain connection
npx tsx scripts/sync-blockchain.ts

# Full data refresh
npx tsx scripts/comprehensive-sync.ts

# Fetch missing metadata only
npx tsx scripts/fetch-all-missing-metadata.ts

# Database inspection
sqlite3 ./data/nft-snapshot.db ".schema"
sqlite3 ./data/nft-snapshot.db "SELECT COUNT(*) FROM events;"
sqlite3 ./data/nft-snapshot.db "SELECT COUNT(*) FROM nft_metadata WHERE image_url IS NOT NULL;"

# Check sync status
sqlite3 ./data/nft-snapshot.db "SELECT * FROM contract_sync_status;"

# Data validation workflow (CRITICAL BEFORE EXPORTS)
npx tsx scripts/validate-data.ts --verbose              # Full comprehensive validation
npx tsx scripts/validate-data.ts --type balance        # Quick balance validation
npx tsx scripts/validate-data.ts --type blocks --start-block 18400000 --end-block 18500000  # Block range validation
npx tsx scripts/validate-data.ts --contract 0x123...   # Validate specific contract

# Fix data issues
npx tsx scripts/rebuild-state.js                       # Fix balance discrepancies
npx tsx scripts/validate-data.ts --type balance        # Re-verify after fixes

# Date-to-block utilities
curl "http://localhost:3000/api/utils/date-to-block?date=2023-10-15"      # Convert date to block
curl "http://localhost:3000/api/utils/date-to-block?block=18500000"       # Convert block to date

# CSV export with validation
curl "http://localhost:3000/api/export/csv?type=snapshot&validate=true"   # Safe CSV export

# Dashboard statistics
curl "http://localhost:3000/api/dashboard/stats"                          # Get real platform stats
```

## Troubleshooting Common Issues

### Build Errors

**TypeScript compilation errors:**
```bash
# Clear Next.js cache and rebuild
rm -rf .next
npm run build
```

**Module resolution issues:**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Database Problems

**Database locked errors:**
```bash
# Check for processes holding database lock
lsof | grep nft-snapshot.db
# Kill any blocking processes and restart dev server
```

**Missing tables or schema issues:**
```bash
# Reinitialize database with multi-contract schema
npx tsx scripts/init-db.js
npx tsx scripts/apply-enhanced-schema.js
```

**Balance discrepancies:**
```bash
# Rebuild state from events (recommended)
npx tsx scripts/rebuild-state.js
# Validate fix
npx tsx scripts/validate-data.ts --type balance
```

### Blockchain Sync Issues

**Rate limiting errors (429):**
- Check RPC provider quotas (Alchemy/QuickNode dashboards)
- Reduce chunk size in sync scripts (default: 1000 blocks)
- Implement longer delays between requests

**Missing events/gaps in data:**
```bash
# Force resync with smaller block ranges
npx tsx scripts/sync-blockchain.ts
# Verify completeness
npx tsx scripts/validate-data.ts --type blocks
```

**Provider connection failures:**
- Verify `NEXT_PUBLIC_ALCHEMY_API_KEY` and `NEXT_PUBLIC_QUICKNODE_ENDPOINT` in `.env.local`
- Test provider endpoints manually with curl
- Check provider status pages for outages

### OpenSea Integration Issues

**Collection metadata not loading:**
- Verify `OPENSEA_API_KEY` is set in `.env.local`
- Check OpenSea API rate limits (4 requests/second)
- Ensure contract address is valid on the specified chain

**Image loading failures:**
- Add new OpenSea CDN domains to `next.config.js` `images.domains`
- Check browser console for CORS errors
- Verify image URLs are accessible directly

### Wallet Connection Problems

**WalletConnect/RainbowKit not working:**
- Verify `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is configured
- Get new project ID from https://cloud.reown.com
- Clear browser cache and reconnect wallet

**Authentication failures:**
- Check `JWT_SECRET` is set in `.env.local`
- Verify wallet signature message format
- Check browser console for signature errors

### Performance Issues

**Slow snapshot generation:**
- Run `npx tsx scripts/rebuild-state.js` to optimize database
- Check database indexes: `sqlite3 ./data/nft-snapshot.db ".indexes"`
- Monitor database file size (WAL file cleanup may be needed)

**High memory usage:**
- Reduce batch sizes in processing scripts
- Implement pagination for large datasets
- Clear Next.js cache: `rm -rf .next`

### Development Server Issues

**Port 3000 already in use:**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
# Or use alternative port
PORT=3001 npm run dev
```

**Hot reload not working:**
```bash
# Restart dev server with clean cache
rm -rf .next
npm run dev
```

## Testing

### Manual Testing Strategy

This project currently uses manual testing via scripts and API endpoint verification. No formal test framework is configured.

**API Endpoint Testing:**
```bash
# Start dev server
npm run dev

# Test snapshot endpoints
curl http://localhost:3000/api/snapshot/current
curl http://localhost:3000/api/snapshot/historical?date=2023-10-15

# Test contract endpoints
curl http://localhost:3000/api/contracts/search?chain=1
curl http://localhost:3000/api/contracts/0x300e7a5fb0ab08af367d5fb3915930791bb08c2b

# Test validation endpoints
curl "http://localhost:3000/api/contracts/0x300e7a5fb0ab08af367d5fb3915930791bb08c2b/validate?type=balance"

# Test utility endpoints
curl "http://localhost:3000/api/utils/date-to-block?date=2023-10-15"
curl "http://localhost:3000/api/dashboard/stats"
```

**Database Validation Scripts:**
```bash
# Test database integrity
npx tsx scripts/validate-data.ts --verbose

# Test blockchain sync
npx tsx scripts/sync-blockchain.ts

# Test state rebuilding
npx tsx scripts/rebuild-state.js
```

**Smoke Testing Checklist:**
- [ ] Development server starts without errors
- [ ] Home page loads with correct styling
- [ ] Contract discovery page shows contracts
- [ ] Wallet connection works (RainbowKit modal appears)
- [ ] OpenSea metadata loads for contracts
- [ ] Snapshot generation completes successfully
- [ ] Data validation runs without errors
- [ ] CSV export downloads correctly
- [ ] Analytics charts render properly

### Adding Automated Tests (Future)

If implementing automated tests, recommended structure:
```
ClickFrontEnd/
├── __tests__/
│   ├── api/              # API route tests
│   ├── lib/              # Library function tests
│   └── components/       # React component tests
├── jest.config.js        # Jest configuration
└── setupTests.ts         # Test setup file
```

Recommended testing libraries:
- `jest` - Test runner
- `@testing-library/react` - Component testing
- `@testing-library/jest-dom` - DOM matchers
- `msw` - API mocking

## Project Dependencies

**Core Framework:**
- Next.js 15.5+ (App Router)
- React 19.1+
- TypeScript 5.9+
- Tailwind CSS 3.4+

**Wallet Integration:**
- @rainbow-me/rainbowkit 2.2+ (Wallet connection UI)
- @reown/appkit 1.8+ (Reown integration)
- wagmi 2.16+ (Ethereum React hooks)
- viem 2.37+ (TypeScript Ethereum library)

**Blockchain & Database:**
- ethers 6.15+ (Ethereum interaction)
- better-sqlite3 12.2+ (SQLite interface)
- ws 8.18+ (WebSocket client)

**UI & Authentication:**
- lucide-react (Professional icons)
- recharts (Analytics charts)
- jose 6.1+ (JWT handling)
- zustand 5.0+ (State management)

**Utilities:**
- axios (HTTP client)
- uuid (ID generation)
- sharp (Image processing)
- keccak256 (Hashing for airdrops)
- merkletreejs (Merkle tree generation)

## Critical Architecture Notes

### Multi-Contract Platform Requirements
1. **Database Migration**: Use `multi-contract-schema.sql` for new deployments, maintain legacy support
2. **User Authentication**: All user-specific features require wallet connection and JWT validation
3. **Contract Registration**: Validate ERC standards using `lib/contracts/detector.ts` before adding
4. **Shared Caching**: Implement `blockchain_cache` table usage to optimize API calls across users
5. **OpenSea API Key**: Required for collection metadata - configure in environment variables

### Date-Based Architecture & Data Integrity
6. **Date-First Design**: Always provide date parameters alongside block numbers for user-friendly interfaces
7. **Block Conversion**: Use `DateToBlockConverter` for accurate date-to-block conversions with 12-second estimation
8. **Validation Workflow**: MANDATORY validation before critical CSV exports using `npx tsx scripts/validate-data.ts --verbose`
9. **Auto-Validation**: Historical snapshots include validation metadata automatically
10. **Health Monitoring**: Implement GOOD/FAIR/POOR health status with color-coded UI indicators
11. **Balance Integrity**: Run `npx tsx scripts/rebuild-state.js` if validation shows balance discrepancies

### API & Performance Standards
12. **API Consistency**: Use `fetch()` for internal APIs, `axios` for external APIs with timeout/retry
13. **Error Logging**: Always use emoji logging system (🎯📡✅❌🔍) for visual debugging
14. **Rate Limiting**: OpenSea API has rate limits - implement proper caching and error handling
15. **Image Domains**: Add new OpenSea CDN domains to `next.config.js` when they appear
16. **BigInt Handling**: SQLite stores as TEXT, always parse in JavaScript using `BigInt()`
17. **Provider Failover**: Automatic switching between QuickNode → Alchemy → Public RPCs
18. **Database Integrity**: WAL mode for concurrent access, event sourcing pattern for blockchain data

### UI/UX Critical Requirements  
19. **Professional Design**: Strict "no emojis" policy - use Lucide React icons only
20. **Tooltip Isolation**: Use `group/icon` pattern to prevent parent hover interference
21. **Contract Cards**: Follow established visual patterns in `ContractDiscovery.tsx`
22. **Chain Support**: Ethereum, Polygon, Arbitrum, Base, Shape (custom chain configuration)
23. **Responsive Design**: All components must work on mobile with proper touch targets
24. **Date Range UI**: Implement radio button toggles for single vs range date selection with clear labels
25. **Validation Display**: Use color-coded status indicators (green=valid, yellow=warnings, red=errors)
26. **Route Patterns**: Use `/contracts/[address]` for universal, `/collections/[address]` for special features
27. **Access Control**: Implement wallet-based authorization for snapshot pages (`AUTHORIZED_SNAPSHOT_WALLET`)