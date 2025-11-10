# Vercel Deployment Guide - CCSnapshotApp

Complete step-by-step guide for deploying CCSnapshotApp to Vercel.

---

## ✅ Pre-Deployment Checklist

Before starting, ensure you have:
- [x] Access to Vercel dashboard
- [x] Access to ClickCreate GitHub organization
- [ ] PostgreSQL database ready (Neon/Supabase)
- [ ] Alchemy API key
- [ ] OpenSea API key
- [ ] WalletConnect (Reown) Project ID
- [ ] JWT secret generated

---

## 🗄️ Step 1: Database Setup

### Option A: Neon (Recommended)

1. Go to https://neon.tech
2. Sign in or create account
3. Click **"Create Project"**
4. Configure:
   - Name: `CCSnapshotApp`
   - Region: `US East (Ohio)` (closest to Vercel)
   - PostgreSQL version: 16
5. Click **"Create Project"**
6. Copy the connection string (should look like):
   ```
   postgres://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
7. Keep this connection string safe!

### Initialize Database Schema

1. In Neon dashboard, click **"SQL Editor"**
2. Copy contents of `ClickFrontEnd/database/multi-contract-schema.sql`
3. Paste into SQL Editor
4. Click **"Run"**
5. Verify all tables created successfully

---

## 🔑 Step 2: Get API Keys

### Alchemy (Blockchain RPC)

1. Go to https://www.alchemy.com/
2. Sign in or create account
3. Click **"Create App"**
4. Configure:
   - Name: `CCSnapshotApp Production`
   - Chain: **Ethereum**
   - Network: **Ethereum Mainnet**
5. Click **"Create App"**
6. Click on app → **"API Key"** → Copy the API key
7. Save as: `NEXT_PUBLIC_ALCHEMY_API_KEY`

### OpenSea (Collection Metadata)

1. Go to https://docs.opensea.io/reference/api-keys
2. Click **"Request an API Key"**
3. Fill out the form:
   - Name: `CCSnapshotApp`
   - Email: Your ClickCreate email
   - Description: `NFT snapshot tool for collection analytics`
4. Wait for approval email (usually 1-2 days)
5. Save as: `OPENSEA_API_KEY`

**Temporary Solution:** For immediate testing, you can proceed without OpenSea API key. The app will work but collection metadata won't be automatically fetched.

### WalletConnect (Wallet Connection)

1. Go to https://cloud.reown.com/
2. Sign in with GitHub (use ClickCreate organization)
3. Click **"Create Project"**
4. Configure:
   - Name: `CCSnapshotApp`
   - Type: `AppKit`
5. Add domain: `snapshot.clickcreate.io`
6. Copy the **Project ID**
7. Save as: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`

### JWT Secret (Authentication)

Generate a random 32+ character secret:

**Option 1 - Using OpenSSL (Mac/Linux):**
```bash
openssl rand -base64 32
```

**Option 2 - Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option 3 - Online Generator:**
- Go to https://generate-secret.vercel.app/32
- Copy the generated secret

Save as: `JWT_SECRET`

⚠️ **IMPORTANT:** Keep this secret safe and never commit it to git!

---

## 🚀 Step 3: Vercel Project Setup

### Create New Project

1. Go to Vercel dashboard: https://vercel.com/dashboard
2. Click **"Add New..." → "Project"**
3. Click **"Import Git Repository"**
4. Find **"clickcreate/CCSnapshotApp"** from the list
5. Click **"Import"**

### Configure Build Settings

**Root Directory:**
```
ClickFrontEnd
```

**Framework Preset:**
```
Next.js
```

**Build Command:**
```
npm run build
```

**Output Directory:**
```
.next
```

**Install Command:**
```
npm install
```

**Node.js Version:**
```
18.x
```

---

## 🔐 Step 4: Environment Variables

Click **"Environment Variables"** section and add the following:

### Required Variables

| Variable Name | Value | Environment |
|---------------|-------|-------------|
| `POSTGRES_URL` | Your Neon connection string | Production, Preview |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Your Alchemy API key | Production, Preview, Development |
| `OPENSEA_API_KEY` | Your OpenSea API key | Production, Preview |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Your Reown Project ID | Production, Preview, Development |
| `JWT_SECRET` | Your generated JWT secret | Production, Preview |
| `NEXT_PUBLIC_APP_URL` | `https://snapshot.clickcreate.io` | Production |

### How to Add Each Variable

For each variable:
1. Enter **Key** (variable name from table above)
2. Enter **Value** (your actual API key/secret)
3. Select environments:
   - ✅ Production (always)
   - ✅ Preview (recommended)
   - ⚠️ Development (only for NEXT_PUBLIC_* variables)
4. Click **"Add"**

### Important Notes

- `NEXT_PUBLIC_*` variables are exposed to browser (safe for API keys meant for client-side)
- `POSTGRES_URL` and `JWT_SECRET` are server-only (never exposed to browser)
- Make sure `POSTGRES_URL` includes `?sslmode=require` at the end

---

## 🌐 Step 5: Deploy

1. After adding all environment variables, click **"Deploy"**
2. Wait for build to complete (usually 2-3 minutes)
3. Check build logs for any errors
4. If successful, you'll get a deployment URL like: `https://cc-snapshot-app-xxx.vercel.app`

### Test Deployment

1. Click on the deployment URL
2. Verify homepage loads correctly
3. Try connecting a wallet
4. Test adding a collection (should fail gracefully if sync worker not running yet)

---

## 🔗 Step 6: Custom Domain Setup

### Add Domain

1. In Vercel project, go to **"Settings" → "Domains"**
2. Click **"Add"**
3. Enter: `snapshot.clickcreate.io`
4. Click **"Add"**

### Configure DNS (ClickCreate Domain)

Vercel will show you DNS records to add. Go to your domain provider:

**CNAME Record:**
```
Type: CNAME
Name: snapshot
Value: cname.vercel-dns.com
TTL: 3600 (or Auto)
```

### SSL Certificate

- Vercel automatically provisions SSL certificate
- Wait 5-10 minutes for DNS propagation
- Certificate will auto-renew

### Verify Domain

1. Wait for DNS propagation (5-30 minutes)
2. Check domain status in Vercel (should show "Valid")
3. Visit https://snapshot.clickcreate.io
4. Verify SSL certificate is active (🔒 padlock icon)

---

## ⚙️ Step 7: Sync Worker Deployment (Render)

The sync worker must be deployed separately for blockchain syncing to work.

### Create Render Service

1. Go to https://render.com/dashboard
2. Click **"New +" → "Web Service"**
3. Click **"Connect a repository"**
4. Find **"clickcreate/CCSnapshotWorker"**
5. Click **"Connect"**

### Configure Service

| Setting | Value |
|---------|-------|
| Name | `ccsnapshot-worker` |
| Environment | `Node` |
| Branch | `main` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | `Starter` (free tier) |

### Environment Variables (Render)

Add these in Render service settings:

| Variable | Value |
|----------|-------|
| `POSTGRES_URL` | Same as Vercel (your Neon connection string) |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Same as Vercel |
| `PORT` | `3001` |

### Deploy Worker

1. Click **"Create Web Service"**
2. Wait for deployment (2-3 minutes)
3. Note the service URL: `https://ccsnapshot-worker.onrender.com`

### Verify Worker Health

Test the health endpoint:
```bash
curl https://ccsnapshot-worker.onrender.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "uptime": "123 seconds"
}
```

---

## ✅ Step 8: Final Verification

### Frontend Tests

1. Visit https://snapshot.clickcreate.io
2. **Homepage:**
   - [ ] Page loads without errors
   - [ ] Stats display correctly
   - [ ] "Generate Snapshot" button redirects to /collections
3. **Wallet Connection:**
   - [ ] Click "Connect Wallet"
   - [ ] MetaMask/WalletConnect modal opens
   - [ ] Can connect wallet successfully
   - [ ] Wallet address displays in header
4. **Add Collection:**
   - [ ] Click "Generate Snapshot" button
   - [ ] Enter test contract: `0x300e7a5fb0ab08af367d5fb3915930791bb08c2b`
   - [ ] Contract validates successfully
   - [ ] Redirects to snapshot page
5. **Generate Snapshot:**
   - [ ] Click "Generate Snapshot"
   - [ ] Sync starts automatically (if needed)
   - [ ] Progress shows: "Preparing Snapshot... X%"
   - [ ] Snapshot generates successfully
   - [ ] Results display in table
   - [ ] Download CSV works
   - [ ] Download JSON works

### Database Verification

Connect to your Neon database and verify:

```sql
-- Check contracts table
SELECT address, name, symbol FROM contracts LIMIT 5;

-- Check events are being synced
SELECT COUNT(*) FROM events;

-- Check current state
SELECT COUNT(*) FROM current_state;
```

### Sync Worker Tests

1. Check Render logs for sync activity
2. Should see logs like:
   ```
   🔄 [0x300...] Syncing blocks 18000000 → 18005000
   ✅ [0x300...] Synced 245 events
   ```
3. No error messages should appear

---

## 🎯 Production Checklist

Before announcing to users:

- [ ] Custom domain working (https://snapshot.clickcreate.io)
- [ ] SSL certificate active
- [ ] All environment variables set correctly
- [ ] Sync worker running and healthy
- [ ] Database populated with test data
- [ ] Wallet connection working
- [ ] Snapshot generation working
- [ ] CSV/JSON exports working
- [ ] Mobile responsive design verified
- [ ] Error handling tested (try invalid contract address)
- [ ] Daily sync quota working (2 per wallet per day)

---

## 🔧 Post-Deployment Configuration

### Vercel Settings to Review

1. **Functions:**
   - Region: `Washington, D.C., USA (iad1)` (default, closest to Neon)
   - Max Duration: `10s` (Hobby plan default)

2. **Caching:**
   - Leave default settings
   - Vercel automatically handles Next.js caching

3. **Security:**
   - Enable **"Automatically expose System Environment Variables"** (default)
   - Keep **"Protection Bypass for Automation"** disabled

### Monitoring Setup

1. **Vercel Analytics:**
   - Go to project → **"Analytics"**
   - Enable Web Analytics (free)

2. **Uptime Monitoring:**
   - Set up external monitoring (UptimeRobot, Pingdom)
   - Monitor: `https://snapshot.clickcreate.io`
   - Interval: 5 minutes

3. **Error Tracking:**
   - Vercel automatically captures errors in "Logs" tab
   - Review daily for first week

---

## 🆘 Troubleshooting

### Build Failures

**"Module not found":**
- Check `package.json` dependencies
- Run `npm install` locally to verify
- Clear Vercel build cache: Settings → General → "Clear Cache"

**"Type errors":**
- Ensure TypeScript types are correct
- Check `tsconfig.json` configuration
- Build locally first: `npm run build`

### Database Connection Errors

**"Connection refused":**
- Verify `POSTGRES_URL` format includes `?sslmode=require`
- Check Neon database is active (not paused)
- Test connection manually: `psql "your_postgres_url"`

**"Too many connections":**
- Neon free tier: max 100 connections
- Vercel serverless: each function gets own connection
- Solution: Connection pooling (already configured)

### Wallet Connection Issues

**WalletConnect not working:**
- Verify `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is correct
- Check domain is added in Reown dashboard
- Try clearing browser cache

### Sync Worker Issues

**Health check failing:**
- Check Render service is running
- Verify environment variables are set
- Review Render logs for errors

**Syncing slow/stuck:**
- Check Alchemy quota usage
- Verify database connection
- Review worker logs for rate limit errors

---

## 📊 Expected Performance

### Vercel (Frontend)

- **Build Time:** 2-3 minutes
- **Cold Start:** < 1 second
- **Page Load:** < 2 seconds
- **API Response:** < 500ms (most endpoints)

### Render (Sync Worker)

- **Startup Time:** 30-60 seconds
- **Sync Speed:** ~5,000 blocks per batch
- **Memory Usage:** ~200MB
- **CPU Usage:** Low (mostly idle, spikes during sync)

### Database (Neon)

- **Query Time:** < 100ms (most queries)
- **Connection Time:** < 50ms
- **Storage:** ~50MB per 100k events

---

## 🎉 Deployment Complete!

Once all steps are verified, the platform is ready for production use:

✅ Frontend live at https://snapshot.clickcreate.io
✅ Sync worker running on Render
✅ Database configured and populated
✅ All features tested and working

Users can now:
- Connect wallets
- Add NFT collections
- Generate snapshots
- Export data as CSV/JSON

---

## 📞 Support Resources

### Documentation
- Main README: https://github.com/clickcreate/CCSnapshotApp
- Environment Variables: `ENV_VARIABLES.md`
- Deployment Guide: `DEPLOYMENT_GUIDE.md`

### Service Status
- Vercel: https://www.vercel-status.com/
- Render: https://status.render.com/
- Neon: https://status.neon.tech/
- Alchemy: https://status.alchemy.com/

### Emergency Rollback

If critical issues occur:

1. **Vercel:** Deployments → Previous Deployment → **"Redeploy"**
2. **Render:** Service → **"Suspend"** (stops worker)
3. Fix issue locally
4. Test thoroughly
5. Redeploy

---

**Deployment prepared by:** Development Team
**Last updated:** November 2024
**Platform:** CCSnapshotApp by ClickCreate
