# Environment Variables Reference

Complete list of environment variables for NFT Snapshot Tool deployment.

---

## 🎯 Frontend (Vercel) - Required

These variables MUST be set in Vercel dashboard:

```bash
# Database Connection
POSTGRES_URL=postgres://user:password@host:5432/database?sslmode=require

# Blockchain RPC (choose at least one)
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
# OR
NEXT_PUBLIC_QUICKNODE_ENDPOINT=https://your-endpoint.quiknode.pro/

# OpenSea API
OPENSEA_API_KEY=your_opensea_api_key

# Wallet Authentication
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_reown_project_id
JWT_SECRET=your_random_secret_min_32_characters

# Application URL
NEXT_PUBLIC_APP_URL=https://snapshot.clickcreate.io
```

---

## ⚙️ Sync Worker (Render/Railway) - Required

These variables MUST be set in Render dashboard:

```bash
# Database Connection (same as frontend)
POSTGRES_URL=postgres://user:password@host:5432/database?sslmode=require

# Blockchain RPC
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key

# Service Port
PORT=3001
```

---

## 📚 How to Obtain API Keys

### 1. Alchemy API Key

1. Go to https://www.alchemy.com/
2. Sign up / Log in
3. Create new app
4. Select network: **Ethereum Mainnet**
5. Copy API Key

**Free Tier:** 300M compute units/month (sufficient for most use cases)

### 2. OpenSea API Key

1. Go to https://docs.opensea.io/reference/api-keys
2. Request API key
3. Copy key when approved

**Rate Limit:** 500 requests/minute

### 3. WalletConnect (Reown) Project ID

1. Go to https://cloud.reown.com/
2. Create new project
3. Add your domain: `snapshot.clickcreate.io`
4. Copy Project ID

**Free Forever**

### 4. PostgreSQL Database

**Option A: Neon (Recommended)**
1. Go to https://neon.tech
2. Create project
3. Copy connection string

**Option B: Supabase**
1. Go to https://supabase.com
2. Create project
3. Settings → Database → Connection string (pooling)

**Option C: Railway**
1. Go to https://railway.app
2. New Project → PostgreSQL
3. Copy connection string

---

## 🔐 JWT Secret Generation

Generate a secure random string (minimum 32 characters):

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Example output:
# kX9mN2pQ8vR5wT7yU4iO1aS6dF3gH0jK9lM8nB7cV2xZ5
```

---

## 🌐 Optional Variables

### Additional RPC Providers (Redundancy)

```bash
# QuickNode
NEXT_PUBLIC_QUICKNODE_ENDPOINT=https://your-endpoint.quiknode.pro/abc123

# Infura
NEXT_PUBLIC_INFURA_API_KEY=your_infura_project_id

# Ankr
NEXT_PUBLIC_ANKR_API_KEY=your_ankr_key
```

### Rate Limiting

```bash
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

### Development

```bash
NODE_ENV=production
```

---

## ✅ Verification Checklist

After setting environment variables, verify:

### Frontend (Vercel)

- [ ] Database connection works (no "Database error" on homepage)
- [ ] Wallet connection works (RainbowKit modal appears)
- [ ] OpenSea metadata loads (collection images appear)
- [ ] No errors in browser console

Test URL: `https://snapshot.clickcreate.io`

### Sync Worker (Render)

- [ ] Health check returns 200 OK
- [ ] Database connection confirmed
- [ ] Worker logs show "Service started"

Test command:
```bash
curl https://your-worker-url.onrender.com/health
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

## 🚨 Troubleshooting

### "Database connection failed"

**Check:**
1. `POSTGRES_URL` format is correct
2. SSL mode is included: `?sslmode=require`
3. Database allows connections from Vercel/Render IPs
4. Credentials are valid

**Test connection:**
```bash
psql "your_postgres_url"
```

### "RPC provider error"

**Check:**
1. API key is valid and active
2. Not exceeding rate limits
3. Network is supported (Ethereum Mainnet)

**Test Alchemy:**
```bash
curl https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### "OpenSea metadata not loading"

**Check:**
1. API key is set in Vercel environment variables
2. Not exceeding 500 req/min limit
3. Contract is verified on OpenSea

### "Wallet connection fails"

**Check:**
1. `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set
2. Domain is whitelisted in Reown dashboard
3. Browser has wallet extension installed

---

## 📋 Example .env Files

### Frontend (.env.local for development)

```bash
# Database
POSTGRES_URL=postgres://user:pass@localhost:5432/nft_snapshot

# Blockchain
NEXT_PUBLIC_ALCHEMY_API_KEY=abc123xyz789

# APIs
OPENSEA_API_KEY=def456uvw012
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=ghi789rst345

# Auth
JWT_SECRET=your-secret-min-32-chars

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Sync Worker (.env for development)

```bash
# Database
POSTGRES_URL=postgres://user:pass@localhost:5432/nft_snapshot

# Blockchain
NEXT_PUBLIC_ALCHEMY_API_KEY=abc123xyz789

# Port
PORT=3001
```

---

## 🔄 Updating Environment Variables

### Vercel

1. Dashboard → Project → Settings → Environment Variables
2. Click variable to edit
3. Update value
4. **Important:** Redeploy for changes to take effect
   - Go to Deployments → Latest → Redeploy

### Render

1. Dashboard → Service → Environment
2. Update variable value
3. Service auto-redeploys on environment change

---

## 🎯 Production Checklist

Before going live:

- [ ] All required variables set in Vercel
- [ ] All required variables set in Render
- [ ] `JWT_SECRET` is strong and unique
- [ ] `NEXT_PUBLIC_APP_URL` points to production domain
- [ ] Database is production-ready (not dev/test)
- [ ] API keys are production tier (not sandbox)
- [ ] Health checks passing on both services
- [ ] Custom domain configured and DNS updated
- [ ] SSL certificate active (auto with Vercel)

---

**Ready for production!** 🚀
