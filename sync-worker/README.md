# CCSnapshotWorker

Production-ready blockchain sync worker for the NFT Snapshot Tool. Handles continuous event syncing from Ethereum mainnet to PostgreSQL database.

**Main Repository:** [clickcreate/CCSnapshotApp](https://github.com/clickcreate/CCSnapshotApp)

---

## 📋 Overview

This service runs independently from the frontend, continuously monitoring and syncing NFT Transfer events from the Ethereum blockchain to a PostgreSQL database. It powers the snapshot functionality by maintaining an up-to-date record of all token transfers.

### Key Features

- **Continuous Blockchain Monitoring** - Polls for new blocks and events every 30 seconds
- **Self-healing Sync** - Automatically detects and fills gaps in event history
- **Multi-contract Support** - Syncs multiple NFT collections simultaneously
- **ERC-721 & ERC-1155** - Handles both token standards (Transfer, TransferSingle, TransferBatch)
- **Rate Limit Handling** - Built-in retry logic with exponential backoff
- **Health Monitoring** - RESTful health check endpoint for uptime monitoring
- **Production-ready** - Designed for Railway, Render, or any Node.js hosting

---

## 🏗️ Architecture

### How It Works

1. **Scheduled Sync Loop** (every 30 seconds)
   - Checks all active contracts in database
   - Identifies blocks that need syncing
   - Fetches Transfer events from RPC provider
   - Writes events to PostgreSQL

2. **Gap Detection & Healing**
   - Scans for missing block ranges
   - Prioritizes filling gaps
   - Ensures no events are missed

3. **State Rebuilding**
   - Processes all Transfer events in order
   - Maintains current holder balances
   - Updates `current_state` table atomically

### Technology Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** PostgreSQL (via `pg` library)
- **Blockchain:** ethers.js 6.15
- **RPC Providers:** Alchemy or QuickNode

---

## 🚀 Quick Start (Development)

### Prerequisites

- Node.js 18+
- PostgreSQL database (same as frontend)
- Alchemy or QuickNode API key

### Installation

```bash
# Clone and navigate
git clone https://github.com/clickcreate/CCSnapshotWorker.git
cd CCSnapshotWorker

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start service
npm start
```

Service runs on `http://localhost:3001`

### Environment Variables

Create `.env` file:

```env
# Database (PostgreSQL) - REQUIRED
POSTGRES_URL=postgres://user:password@host:5432/database?sslmode=require

# Blockchain RPC - REQUIRED (choose one)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
# OR
NEXT_PUBLIC_QUICKNODE_ENDPOINT=https://your-endpoint.quiknode.pro/

# Server Port - OPTIONAL
PORT=3001
```

**Note:** Must use the same `POSTGRES_URL` as the frontend service.

---

## 📦 Production Deployment

### Render (Recommended)

1. **Create New Web Service**
   - Dashboard → New → Web Service
   - Connect GitHub: `clickcreate/CCSnapshotWorker`
   - Branch: `main`

2. **Configure Service**
   ```
   Name: CCSnapshotWorker
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   ```

3. **Add Environment Variables**
   - `POSTGRES_URL` (same as frontend)
   - `NEXT_PUBLIC_ALCHEMY_API_KEY`
   - `PORT` = 3001

4. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete
   - Service URL: `https://CCSnapshotWorker-xxxx.onrender.com`

5. **Verify Health**
   ```bash
   curl https://your-service-url.onrender.com/health
   ```

   Expected response:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "uptime": "123 seconds"
   }
   ```

### Railway (Alternative)

1. **Create New Project**
   - New Project → Deploy from GitHub
   - Select `clickcreate/CCSnapshotWorker`

2. **Add Environment Variables**
   - Settings → Variables
   - Add `POSTGRES_URL`, `NEXT_PUBLIC_ALCHEMY_API_KEY`, `PORT`

3. **Configure Start Command**
   - Settings → Start Command: `npm start`

4. **Deploy**
   - Deploys automatically on push to main branch

### Docker (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t CCSnapshotWorker .
docker run -p 3001:3001 \
  -e POSTGRES_URL="your_connection_string" \
  -e NEXT_PUBLIC_ALCHEMY_API_KEY="your_key" \
  CCSnapshotWorker
```

---

## 🔧 Configuration

### Sync Settings

Edit `lib/config/sync-config.js`:

```javascript
module.exports = {
  // Block range per sync batch
  BLOCKS_PER_SYNC: 5000,

  // Sync interval (milliseconds)
  SYNC_INTERVAL_MS: 30000, // 30 seconds

  // RPC provider retry attempts
  MAX_RETRIES: 3,

  // Retry delay (milliseconds)
  RETRY_DELAY_MS: 2000,

  // Gap detection threshold
  GAP_DETECTION_BLOCKS: 100
}
```

### Database Connection Pool

PostgreSQL connection settings in `lib/database/pg-adapter.js`:

```javascript
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 5,                    // Max connections
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Connection timeout
  ssl: { rejectUnauthorized: false }
})
```

### RPC Provider Configuration

Provider priority (automatic failover):

1. QuickNode (if `NEXT_PUBLIC_QUICKNODE_ENDPOINT` set)
2. Alchemy (if `NEXT_PUBLIC_ALCHEMY_API_KEY` set)
3. Public Ethereum RPC (fallback, not recommended)

---

## 🛠️ API Endpoints

### Health Check

**GET /health**

Returns service health status and database connectivity.

```bash
curl https://your-service-url.onrender.com/health
```

Response:
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": "123 seconds",
  "lastSync": "2024-01-15T10:30:00.000Z"
}
```

Status codes:
- `200 OK` - Service healthy, database connected
- `500 Internal Server Error` - Database connection failed

---

## 📊 Monitoring

### Logs

**Startup Logs:**
```
🚀 CCSnapshotWorker starting...
✅ Database connected successfully
🔄 Starting sync loop (interval: 30s)
📡 Service ready on port 3001
```

**Sync Progress Logs:**
```
🔄 [0x123...abc] Syncing blocks 18000000 → 18005000
✅ [0x123...abc] Synced 245 events (5000 blocks)
📊 [0x123...abc] Progress: 95% | ETA: 2m 30s
✅ [0x123...abc] Sync completed at block 18500000
```

**Error Logs:**
```
❌ [0x123...abc] Sync error: Rate limit exceeded
🔄 [0x123...abc] Retrying in 2s (attempt 1/3)
⚠️  Gap detected: blocks 18000000-18005000 missing
🔄 Filling gap: 18000000 → 18005000
```

### Metrics to Monitor

1. **Service Uptime** - Should be 99.9%+
2. **Sync Lag** - Time between current block and last synced block
3. **Database Connection Pool** - Should have available connections
4. **API Rate Limits** - Alchemy/QuickNode quota usage
5. **Error Rate** - Failed sync attempts (should be < 1%)

### Recommended Monitoring Tools

- **Uptime Monitoring:** UptimeRobot, Pingdom
  - Monitor: `https://your-service-url.onrender.com/health`
  - Interval: 5 minutes
  - Alert on: Status code ≠ 200

- **Log Aggregation:** Papertrail, Logtail
  - Capture stdout/stderr
  - Alert on: Error keywords (❌, FAILED, ERROR)

- **Database Monitoring:** Built-in database provider tools
  - Neon: Dashboard → Monitoring
  - Supabase: Dashboard → Database → Monitoring

---

## 🔍 Troubleshooting

### Common Issues

**"Database connection failed"**

```bash
# Check connection string format
echo $POSTGRES_URL
# Should be: postgres://user:pass@host:5432/db?sslmode=require

# Test connection directly
psql "$POSTGRES_URL"
```

Fix:
- Verify `POSTGRES_URL` includes `?sslmode=require`
- Check database allows connections from service IP
- Verify credentials are correct

**"RPC provider rate limit"**

Logs show:
```
❌ Error: Too many requests (429)
```

Fix:
- Check Alchemy/QuickNode dashboard for quota
- Upgrade to paid tier if needed
- Reduce `BLOCKS_PER_SYNC` in config
- Increase `SYNC_INTERVAL_MS` to sync less frequently

**"Sync lag increasing"**

Current block is far ahead of last synced block.

Fix:
- Check service logs for errors
- Verify RPC provider is responding
- Database may be slow (check query times)
- Consider increasing `BLOCKS_PER_SYNC` to catch up faster

**"Service keeps restarting"**

Render/Railway logs show repeated restarts.

Fix:
- Check for uncaught exceptions in logs
- Verify all environment variables are set
- Database connection pool may be exhausted
- Memory issues (check service resource usage)

### Debug Commands

```bash
# Check service health
curl https://your-service-url.onrender.com/health

# View recent logs (Render)
# Dashboard → Service → Logs (last 1000 lines)

# View recent logs (Railway)
# Project → Deployments → View Logs

# Check database connection from local machine
POSTGRES_URL="your_url" node -e "
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  pool.query('SELECT NOW()').then(res => {
    console.log('Connected:', res.rows[0]);
    process.exit(0);
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
"

# Check RPC provider
curl https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

---

## 🧪 Testing

### Local Testing

```bash
# Install dependencies
npm install

# Set environment variables
export POSTGRES_URL="postgres://..."
export NEXT_PUBLIC_ALCHEMY_API_KEY="your_key"

# Start service
npm start

# In another terminal, test health endpoint
curl http://localhost:3001/health

# Trigger manual sync (if endpoint exists)
curl -X POST http://localhost:3001/sync \
  -H "Content-Type: application/json" \
  -d '{"contractAddress": "0x123..."}'
```

### Production Testing

After deployment:

1. **Health Check**
   ```bash
   curl https://your-service-url.onrender.com/health
   ```
   Should return `200 OK` with `"database": "connected"`

2. **Monitor Logs**
   - Wait 30 seconds for first sync
   - Check logs for "Syncing blocks..." message
   - Verify no errors

3. **Database Verification**
   ```sql
   -- Check events are being written
   SELECT COUNT(*) FROM events WHERE created_at > NOW() - INTERVAL '5 minutes';

   -- Check sync progress
   SELECT address, name, last_synced_block, updated_at
   FROM contracts
   WHERE is_active = TRUE
   ORDER BY updated_at DESC;
   ```

4. **Frontend Integration**
   - Open frontend: https://snapshot.clickcreate.io
   - Add a new collection
   - Verify sync starts automatically
   - Check sync progress updates in real-time

---

## 🔄 Maintenance

### Regular Tasks

**Daily:**
- Review error logs for anomalies
- Check sync lag (should be < 100 blocks)
- Verify service uptime (99.9%+)

**Weekly:**
- Review API quota usage (Alchemy/QuickNode)
- Check database growth rate
- Monitor response times

**Monthly:**
- Update dependencies: `npm update`
- Review and optimize slow queries
- Check for new security patches

### Database Maintenance

Run from frontend repository (`ClickFrontEnd/`):

```bash
# Validate data integrity
npx tsx scripts/validate-data.ts --verbose

# Rebuild holder state if issues found
npx tsx scripts/rebuild-state.js

# Fill any sync gaps
npx tsx scripts/fill-sync-gaps.ts
```

### Upgrading

1. **Update code:**
   ```bash
   git pull origin main
   npm install
   ```

2. **Test locally:**
   ```bash
   npm start
   # Run tests, check logs
   ```

3. **Deploy to production:**
   - Render: Auto-deploys on push to main
   - Railway: Auto-deploys on push to main
   - Manual: `git push render main` or similar

4. **Verify deployment:**
   ```bash
   curl https://your-service-url.onrender.com/health
   ```

---

## 📄 License

Proprietary - © 2024 ClickCreate. All rights reserved.

This software is private and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

---

## 📞 Support

### Documentation

- **Main Project:** [CCSnapshotApp README](https://github.com/clickcreate/CCSnapshotApp)
- **Deployment Guide:** [DEPLOYMENT_GUIDE.md](https://github.com/clickcreate/CCSnapshotApp/blob/main/DEPLOYMENT_GUIDE.md)
- **Environment Variables:** [ENV_VARIABLES.md](https://github.com/clickcreate/CCSnapshotApp/blob/main/ENV_VARIABLES.md)

### Service Status

- Render: https://status.render.com/
- Railway: https://railway.app/status
- Alchemy: https://status.alchemy.com/

### Emergency Procedures

**Service Down:**
1. Check service status page (Render/Railway)
2. Review recent deployments (rollback if needed)
3. Check database connectivity
4. Review error logs

**Database Connection Issues:**
1. Verify `POSTGRES_URL` is correct
2. Check database provider status
3. Test connection manually with `psql`
4. Check connection pool settings

**RPC Provider Issues:**
1. Check Alchemy/QuickNode status page
2. Verify API key is valid
3. Check quota usage (may be rate limited)
4. Try alternative provider

---

**Built with ❤️ by ClickCreate**

*Powering on-chain NFT analytics*
