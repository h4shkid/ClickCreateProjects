# NFT Snapshot Tool - Production Deployment Guide

Complete guide for deploying the NFT Snapshot Tool to production.

---

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database
- Vercel account (for frontend)
- Render/Railway account (for sync worker)
- API Keys:
  - Alchemy API Key
  - OpenSea API Key
  - WalletConnect (Reown) Project ID

---

## 🏗️ Architecture Overview

The system consists of two main components:

1. **Frontend (ClickFrontEnd)** - Next.js 15 app deployed to Vercel
2. **Sync Worker** - Node.js service deployed to Render/Railway

Both connect to the same PostgreSQL database.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Vercel    │────▶│  PostgreSQL  │◀────│   Render    │
│  (Frontend) │     │  (Database)  │     │ (Worker)    │
└─────────────┘     └──────────────┘     └─────────────┘
       │                                         │
       │                                         │
       ▼                                         ▼
   User Access                            Blockchain Sync
```

---

## 📦 Part 1: Database Setup

### 1.1 Create PostgreSQL Database

Choose a provider (recommended: Neon, Supabase, or Railway):

**Neon (Recommended):**
1. Go to https://neon.tech
2. Create new project
3. Copy connection string (format: `postgres://user:password@host/database?sslmode=require`)

**Supabase:**
1. Go to https://supabase.com
2. Create project → Settings → Database → Connection string
3. Use "Connection pooling" string for better performance

### 1.2 Initialize Database Schema

```bash
cd ClickFrontEnd
npm install

# Set environment variable temporarily
export POSTGRES_URL="your_postgres_connection_string"

# Initialize database
npx tsx scripts/init-multi-contract-db.js
```

This creates all required tables:
- `contracts` - NFT contract information
- `events` - Blockchain transfer events
- `current_state` - Current holder balances
- `wallet_new_syncs` - Daily sync limit tracking
- `users` - User profiles
- And more...

### 1.3 Verify Database

```bash
# Check tables were created
npx tsx scripts/validate-data.ts --verbose
```

---

## 🚀 Part 2: Frontend Deployment (Vercel)

### 2.1 Connect GitHub to Vercel

1. Go to https://vercel.com
2. Import Project → Select `clickcreate/nft-snapshot-tool`
3. Framework: **Next.js**
4. Root Directory: **ClickFrontEnd**

### 2.2 Configure Environment Variables

In Vercel dashboard → Settings → Environment Variables, add:

#### Required Variables:

```bash
# Database
POSTGRES_URL=postgres://user:password@host/database?sslmode=require

# Blockchain RPC (at least one required)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key
# OR
NEXT_PUBLIC_QUICKNODE_ENDPOINT=https://your-endpoint.quiknode.pro/abc123

# OpenSea API (required for metadata)
OPENSEA_API_KEY=your_opensea_api_key

# Wallet Authentication
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_reown_project_id
JWT_SECRET=your_random_secret_string_min_32_chars

# Production URL
NEXT_PUBLIC_APP_URL=https://snapshot.clickcreate.io
```

#### Optional Variables:

```bash
# Multiple RPC providers for redundancy
NEXT_PUBLIC_QUICKNODE_ENDPOINT=https://your-quicknode.pro/
NEXT_PUBLIC_INFURA_API_KEY=your_infura_key

# Rate limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

### 2.3 Build Settings

```
Build Command: npm run build
Output Directory: .next
Install Command: npm install
Node Version: 18.x
```

### 2.4 Deploy

Click "Deploy" and wait for build to complete (~2-3 minutes).

### 2.5 Configure Custom Domain

1. Vercel Dashboard → Settings → Domains
2. Add `snapshot.clickcreate.io`
3. Update DNS records as instructed by Vercel

---

## ⚙️ Part 3: Sync Worker Deployment (Render)

### 3.1 Create Render Web Service

1. Go to https://render.com/dashboard
2. New → Web Service
3. Connect repository: `clickcreate/nft-snapshot-sync-worker`

### 3.2 Configure Service

```
Name: nft-snapshot-sync-worker
Environment: Node
Region: Choose closest to your database
Branch: main
Build Command: npm install
Start Command: npm start
```

### 3.3 Configure Environment Variables

Add in Render dashboard → Environment:

```bash
# Database (same as frontend)
POSTGRES_URL=postgres://user:password@host/database?sslmode=require

# Blockchain RPC
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_key

# Service Port (default 3001)
PORT=3001
```

### 3.4 Health Check Configuration

```
Health Check Path: /health
Expected Status: 200
```

### 3.5 Deploy

Click "Create Web Service" and wait for deployment.

### 3.6 Verify Worker is Running

```bash
# Check health
curl https://your-worker-url.onrender.com/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "uptime": "xxx seconds"
}
```

---

## 🔧 Part 4: Configuration & Testing

### 4.1 Register First Contract

1. Go to https://snapshot.clickcreate.io
2. Connect wallet
3. Click "Generate Snapshot"
4. Enter contract address (e.g., `0x...`)
5. Submit

### 4.2 Trigger Sync

The sync worker will automatically start syncing when a contract is added.

**Manual sync via API:**
```bash
curl -X POST https://your-worker-url.onrender.com/sync \
  -H "Content-Type: application/json" \
  -d '{
    "contractAddress": "0x...",
    "fromBlock": 0,
    "toBlock": "latest"
  }'
```

### 4.3 Monitor Progress

```bash
curl https://your-worker-url.onrender.com/progress/0x...
```

### 4.4 Generate Snapshot

1. Wait for sync to complete (check sync status on UI)
2. Click "Generate Snapshot"
3. Select options (current/historical, token filters)
4. Download CSV/JSON

---

## 📊 Part 5: Monitoring & Maintenance

### 5.1 Database Monitoring

**Check database size:**
```bash
npx tsx scripts/validate-data.ts --verbose
```

**Rebuild state if issues occur:**
```bash
npx tsx scripts/rebuild-state.js
```

### 5.2 Logs

**Vercel Logs:**
- Dashboard → Project → Deployments → View Logs

**Render Logs:**
- Dashboard → Service → Logs tab

### 5.3 Common Issues

**Issue: "Database connection failed"**
- Check `POSTGRES_URL` format
- Verify database is accessible from Vercel/Render IPs
- Check SSL mode (`?sslmode=require`)

**Issue: "Sync worker not starting"**
- Verify `PORT` environment variable
- Check RPC API key is valid
- Review Render logs for errors

**Issue: "Metadata not loading"**
- Verify `OPENSEA_API_KEY` is set
- Check API rate limits (500/min for OpenSea)

**Issue: "Wallet connection fails"**
- Verify `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- Check domain is whitelisted in Reown dashboard

---

## 🔐 Security Checklist

- [ ] Change `JWT_SECRET` to a strong random string
- [ ] Enable Vercel firewall rules if available
- [ ] Set up database backups
- [ ] Monitor API usage for abuse
- [ ] Review Vercel environment variables (no secrets in repo)
- [ ] Enable HTTPS only (automatic with Vercel)
- [ ] Set proper CORS headers (configured in code)

---

## 🔄 Updates & Maintenance

### Updating Frontend

```bash
# Make changes in ClickFrontEnd/
git add .
git commit -m "Update: description"
git push origin main
```

Vercel auto-deploys on push to main.

### Updating Sync Worker

```bash
# Make changes in sync-worker/
git add .
git commit -m "Update: description"
git push origin main
```

Render auto-deploys on push to main.

### Database Migrations

If schema changes are needed:

1. Update `ClickFrontEnd/data/multi-contract-schema.sql`
2. Run migration script:
```bash
npx tsx scripts/migrate-schema.js
```

---

## 📞 Support

For technical issues:
1. Check application logs (Vercel/Render dashboards)
2. Run validation script: `npx tsx scripts/validate-data.ts`
3. Review error messages and stack traces

---

## 📝 Additional Resources

- **Database Schema:** `ClickFrontEnd/data/multi-contract-schema.sql`
- **Validation Guide:** `ClickFrontEnd/VALIDATION_GUIDE.md`
- **API Documentation:** `ClickFrontEnd/CLAUDE.md` (architecture reference)
- **Script Reference:** `ClickFrontEnd/scripts/` directory

---

**Deployment Complete!** 🎉

Your NFT Snapshot Tool is now live at: `https://snapshot.clickcreate.io`
