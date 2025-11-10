# NFT Snapshot Tool

Professional NFT holder snapshot tool with multi-contract support, historical snapshots, and advanced filtering capabilities. Built for creators, project owners, and developers who need accurate on-chain data for airdrops, allowlists, and analytics.

**Live Production:** https://snapshot.clickcreate.io

---

## ✨ Features

### Core Functionality

- **Universal Contract Support** - Works with any ERC-721 or ERC-1155 collection on Ethereum mainnet
- **Current Snapshots** - Generate real-time holder snapshots with 100% on-chain accuracy
- **Historical Snapshots** - Query holder data at any past block number
- **Token Range Filtering** - Calculate complete sets for specific token ID ranges (perfect for PFP projects with seasons/editions)
- **Advanced Sorting** - Sort by number of complete sets owned, then by total balance
- **Multiple Export Formats** - Download snapshots as CSV or JSON for integration with other tools

### User Experience

- **Wallet Authentication** - Secure login with RainbowKit (MetaMask, WalletConnect, Coinbase Wallet, etc.)
- **Smart Auto-Sync** - Automatically syncs blockchain data before generating snapshots
- **Real-time Progress** - Live sync progress indicators with ETA
- **Daily Sync Quota** - Fair usage system (2 new collections per wallet per day)
- **Responsive Design** - Beautiful dark theme with glassmorphism effects, mobile-optimized

### Technical Features

- **Multi-contract Architecture** - Single database supports unlimited collections
- **Event-based State** - Rebuilds holder state from raw Transfer events for accuracy
- **PostgreSQL Production Database** - Scalable and reliable data storage
- **OpenSea Integration** - Automatic collection metadata and images
- **ENS Resolution** - Display ENS names for holder addresses

---

## 🏗️ Architecture

### Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15.5.2 (App Router) |
| Language | TypeScript 5.9 |
| Styling | Tailwind CSS 3.4 |
| Database | PostgreSQL (Neon/Supabase) |
| Blockchain | ethers.js 6.15, wagmi 2.16, viem 2.37 |
| Authentication | RainbowKit 2.2, JWT (jose) |
| External APIs | OpenSea API v2, Alchemy RPC |

### Project Structure

```
nft-snapshot-tool/
├── ClickFrontEnd/              # Main Next.js application
│   ├── app/                    # Next.js 15 App Router
│   │   ├── api/               # API routes (backend endpoints)
│   │   ├── collections/       # Collections & snapshot pages
│   │   └── page.tsx           # Homepage
│   ├── components/            # React components
│   │   ├── layout/           # Navigation, footer
│   │   ├── ui/               # Reusable UI components
│   │   └── collections/      # Collection-specific components
│   ├── lib/                   # Core business logic
│   │   ├── blockchain/       # Blockchain interaction
│   │   ├── database/         # Database adapters
│   │   ├── auth/             # Authentication & quota system
│   │   └── hooks/            # React hooks
│   ├── scripts/              # Database management utilities
│   ├── database/             # SQL schema files
│   └── public/               # Static assets
├── sync-worker/               # Standalone sync service (separate deployment)
├── DEPLOYMENT_GUIDE.md        # Production deployment instructions
├── ENV_VARIABLES.md           # Environment variables reference
└── HANDOFF_CHECKLIST.md       # Deployment verification checklist
```

### Database Schema

**Core Tables:**
- `contracts` - Collection metadata and sync status
- `events` - Raw Transfer events from blockchain
- `current_state` - Current holder balances (rebuilt from events)
- `wallet_new_syncs` - Daily sync quota tracking
- `ip_wallet_binding` - IP-based wallet binding (anti-abuse)
- `users` - User profiles and preferences

---

## 🚀 Quick Start (Development)

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon, Supabase, or local)
- API keys (see [ENV_VARIABLES.md](ENV_VARIABLES.md))

### Installation

```bash
# Clone repository
git clone https://github.com/clickcreate/nft-snapshot-tool.git
cd nft-snapshot-tool/ClickFrontEnd

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local
# Edit .env.local with your API keys (see ENV_VARIABLES.md)

# Initialize database
npx tsx scripts/init-multi-contract-db.js

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create `.env.local` in `ClickFrontEnd/` directory:

```env
# Database (PostgreSQL)
POSTGRES_URL=postgres://user:password@host:5432/database?sslmode=require

# Blockchain RPC (choose one or both for redundancy)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
NEXT_PUBLIC_QUICKNODE_ENDPOINT=https://your-endpoint.quiknode.pro/

# External APIs
OPENSEA_API_KEY=your_opensea_api_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_reown_project_id

# Authentication
JWT_SECRET=your_random_secret_min_32_characters

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For detailed setup instructions, see [ENV_VARIABLES.md](ENV_VARIABLES.md)**

---

## 📦 Production Deployment

### Architecture

The platform consists of two services:

1. **Frontend + API** (Vercel) - Next.js application with API routes
2. **Sync Worker** (Render/Railway) - Background blockchain sync service

Both services connect to the same PostgreSQL database.

### Deployment Steps

**Complete deployment guide available in [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**

Quick overview:

1. **Database Setup** (Neon/Supabase)
   - Create PostgreSQL database
   - Run `database/multi-contract-schema.sql`
   - Save connection string

2. **Frontend Deployment** (Vercel)
   - Connect GitHub repository
   - Configure environment variables
   - Deploy with custom domain

3. **Sync Worker Deployment** (Render)
   - Deploy from `clickcreate/nft-snapshot-sync-worker`
   - Configure same database connection
   - Verify health endpoint

4. **Verification** (Checklist)
   - Follow [HANDOFF_CHECKLIST.md](HANDOFF_CHECKLIST.md)
   - Test all features
   - Monitor logs

---

## 🎯 Usage Guide

### For End Users

1. **Connect Wallet** - Click "Connect Wallet" in header
2. **Add Collection** - Go to "My Snapshots" → "Generate Snapshot"
3. **Enter Contract Address** - Paste ERC-721/1155 contract address
4. **Generate Snapshot** - Click "Generate Snapshot" (auto-syncs if needed)
5. **Download Results** - Export as CSV or JSON

### For Developers

#### API Endpoints

**POST /api/contracts/register**
Register a new collection
```json
{
  "contractAddress": "0x...",
  "chainId": 1
}
```

**POST /api/contracts/{address}/sync**
Start blockchain sync for a collection

**GET /api/contracts/{address}/sync**
Get sync status and progress

**POST /api/snapshot/current**
Generate current snapshot
```json
{
  "contractAddress": "0x...",
  "snapshotType": "full" | "full-season" | "exact-match",
  "tokenIds": [1, 2, 3],
  "limit": 0
}
```

**POST /api/snapshot/historical**
Generate historical snapshot at specific block
```json
{
  "contractAddress": "0x...",
  "blockNumber": 18000000,
  "snapshotType": "full",
  "limit": 0
}
```

#### Database Scripts

Common maintenance commands:

```bash
cd ClickFrontEnd

# Validate data integrity
npx tsx scripts/validate-data.ts --verbose

# Rebuild holder state from events
npx tsx scripts/rebuild-state.js

# Manual blockchain sync
npx tsx scripts/sync-blockchain.ts

# Fix PostgreSQL sequences
npx tsx scripts/fix-all-sequences.ts
```

---

## 🔧 Configuration

### Quota System

- **Daily Sync Limit:** 2 new collections per wallet per day
- **Reset Time:** 00:00 UTC daily
- **Existing Collections:** Unlimited snapshots for already-synced collections
- **IP Binding:** 1 wallet per IP address (24-hour binding)

### Blockchain Configuration

**RPC Providers (Priority Order):**
1. QuickNode (if configured)
2. Alchemy (if configured)
3. Fallback to Ethereum mainnet default

**Sync Settings:**
- Block range per sync: 5,000 blocks (configurable)
- Event types monitored: `Transfer`, `TransferSingle`, `TransferBatch`
- Retry logic: 3 attempts with exponential backoff

### Rate Limits

- **API Routes:** 100 requests per minute per IP
- **Alchemy:** 300M compute units/month (free tier)
- **OpenSea:** 500 requests/minute
- **Database:** Max 1 connection (serverless optimization)

---

## 🛠️ Troubleshooting

### Common Issues

**"Database connection failed"**
- Verify `POSTGRES_URL` format includes `?sslmode=require`
- Check database allows external connections
- Test connection: `psql "your_postgres_url"`

**"Daily sync limit reached"**
- Quota resets at 00:00 UTC daily
- Use existing collections (don't count toward quota)
- Check quota status: API `/api/user/sync-stats`

**"RPC provider error"**
- Verify API keys in environment variables
- Check provider quota (Alchemy dashboard)
- Try alternative provider (QuickNode)

**Snapshot generation timeout**
- Large collections (>10k holders) may take 30-60 seconds
- Check sync worker logs for errors
- Verify database performance (query times)

### Debug Commands

```bash
# Check database connection
POSTGRES_URL="your_url" npx tsx -e "require('./ClickFrontEnd/lib/database/adapter').createDatabaseAdapter().prepare('SELECT 1 as test').get()"

# View sync status
curl https://your-worker-url.onrender.com/health

# Check Alchemy quota
curl https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

## 📊 Monitoring & Maintenance

### Health Checks

**Frontend:** https://snapshot.clickcreate.io
- Check homepage loads
- Test wallet connection
- Generate test snapshot

**Sync Worker:** https://your-worker-url.onrender.com/health
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": "123 seconds"
}
```

### Logs

**Vercel Logs:**
- Dashboard → Project → Logs
- Real-time function execution logs
- Error tracking and debugging

**Render Logs:**
- Dashboard → Service → Logs
- Sync progress and blockchain events
- Error tracking

### Database Maintenance

**Weekly Tasks:**
- Review database size growth
- Check query performance
- Vacuum and analyze tables (PostgreSQL)

**Monthly Tasks:**
- Review API quota usage (Alchemy, OpenSea)
- Check sync worker performance
- Update dependencies (security patches)

---

## 🤝 Contributing

This is a private repository for ClickCreate. For internal development:

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Run linter: `npm run lint`
4. Build production: `npm run build`
5. Commit with conventional commits: `feat:`, `fix:`, `docs:`
6. Push and create pull request
7. Request review from team

### Code Standards

- TypeScript strict mode enabled
- ESLint + Prettier configured
- React Server Components by default
- Client Components only when needed (`'use client'`)
- API routes protected with authentication
- Database queries use parameterized statements (SQL injection prevention)

---

## 📄 License

Proprietary - © 2024 ClickCreate. All rights reserved.

This software is private and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

---

## 📞 Support

### Documentation

- **Deployment:** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Environment Variables:** [ENV_VARIABLES.md](ENV_VARIABLES.md)
- **Deployment Checklist:** [HANDOFF_CHECKLIST.md](HANDOFF_CHECKLIST.md)
- **Architecture:** [ClickFrontEnd/CLAUDE.md](ClickFrontEnd/CLAUDE.md)

### Service Status

- Vercel: https://www.vercel-status.com/
- Render: https://status.render.com/
- Alchemy: https://status.alchemy.com/

### Emergency Rollback

If critical issues occur:

1. Vercel: Deployments → Previous → Redeploy
2. Render: Service → Pause
3. Review logs and database
4. Fix in development
5. Redeploy after testing

---

**Built with ❤️ by ClickCreate**

*Professional NFT analytics for the Web3 ecosystem*
