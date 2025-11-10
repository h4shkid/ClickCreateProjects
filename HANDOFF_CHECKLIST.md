# Project Handoff Checklist

Complete checklist for deploying the NFT Snapshot Tool to production.

---

## 📋 Pre-Deployment Verification

### Code Repositories

- [x] Frontend code pushed to `clickcreate/nft-snapshot-tool`
- [x] Sync worker code pushed to `clickcreate/nft-snapshot-sync-worker`
- [x] All documentation files included (DEPLOYMENT_GUIDE.md, ENV_VARIABLES.md)
- [ ] Repository access verified for deployment team
- [ ] GitHub Actions workflows (if any) reviewed

### Documentation Review

- [x] DEPLOYMENT_GUIDE.md created and comprehensive
- [x] ENV_VARIABLES.md created with all required variables
- [ ] README.md reviewed in both repositories
- [ ] All documentation free of AI/development tool references
- [ ] All placeholder values clearly marked

---

## 🗄️ Database Setup

### PostgreSQL Provider Selection

Choose one provider (recommended: Neon or Supabase):

- [ ] Neon account created at https://neon.tech
- [ ] Supabase account created at https://supabase.com
- [ ] Railway account created at https://railway.app

### Database Configuration

- [ ] PostgreSQL database created
- [ ] Connection string obtained (format: `postgres://user:pass@host:5432/dbname?sslmode=require`)
- [ ] SSL mode enabled (`?sslmode=require` in connection string)
- [ ] Database accessible from external IPs (Vercel, Render)
- [ ] Connection string saved securely (password manager)

### Schema Initialization

- [ ] Downloaded `ClickFrontEnd/database/multi-contract-schema.sql`
- [ ] Connected to database via psql or GUI tool
- [ ] Executed schema SQL successfully
- [ ] Verified all tables created:
  - [ ] `contracts`
  - [ ] `events`
  - [ ] `current_state`
  - [ ] `wallet_new_syncs`
  - [ ] `ip_wallet_binding`
  - [ ] `users`
- [ ] All indexes created successfully
- [ ] No errors in database logs

---

## 🔑 API Keys & Credentials

### Blockchain RPC Provider

**Alchemy (Recommended)**
- [ ] Account created at https://www.alchemy.com/
- [ ] New app created
- [ ] Network selected: **Ethereum Mainnet**
- [ ] API key copied: `NEXT_PUBLIC_ALCHEMY_API_KEY`
- [ ] Free tier confirmed: 300M compute units/month
- [ ] Rate limits understood

**Alternative: QuickNode**
- [ ] Account created at https://www.quiknode.com/ (if using)
- [ ] Endpoint created: `NEXT_PUBLIC_QUICKNODE_ENDPOINT`
- [ ] Rate limits reviewed

### OpenSea API

- [ ] API key requested at https://docs.opensea.io/reference/api-keys
- [ ] API key received and copied: `OPENSEA_API_KEY`
- [ ] Rate limit confirmed: 500 requests/minute
- [ ] API key tested with curl command

### WalletConnect (Reown)

- [ ] Project created at https://cloud.reown.com/
- [ ] Domain added: `snapshot.clickcreate.io`
- [ ] Project ID copied: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- [ ] Free tier confirmed

### JWT Secret

- [ ] Random secret generated (min 32 characters)
- [ ] Command used: `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- [ ] Secret saved: `JWT_SECRET`
- [ ] Secret kept secure (never committed to git)

---

## 🚀 Frontend Deployment (Vercel)

### Vercel Account Setup

- [ ] Vercel account created/logged in at https://vercel.com
- [ ] Team account created (if needed)
- [ ] GitHub integration connected
- [ ] Repository access granted: `clickcreate/nft-snapshot-tool`

### Project Creation

- [ ] New project created in Vercel
- [ ] GitHub repository connected: `clickcreate/nft-snapshot-tool`
- [ ] Build settings confirmed:
  - Framework: Next.js
  - Build Command: `npm run build`
  - Output Directory: `.next`
  - Install Command: `npm install`
- [ ] Node.js version set to 18.x or higher

### Environment Variables Configuration

Navigate to: Project Settings → Environment Variables

- [ ] `POSTGRES_URL` added (production database connection string)
- [ ] `NEXT_PUBLIC_ALCHEMY_API_KEY` added
- [ ] `OPENSEA_API_KEY` added
- [ ] `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` added
- [ ] `JWT_SECRET` added
- [ ] `NEXT_PUBLIC_APP_URL` added: `https://snapshot.clickcreate.io`
- [ ] All variables set for: Production, Preview, Development (as needed)
- [ ] Sensitive variables (JWT_SECRET, POSTGRES_URL) marked as sensitive

### Domain Configuration

- [ ] Custom domain added: `snapshot.clickcreate.io`
- [ ] DNS records configured:
  - Type: CNAME
  - Name: snapshot
  - Value: cname.vercel-dns.com
- [ ] SSL certificate issued (automatic with Vercel)
- [ ] Domain verified and active

### Deployment

- [ ] Initial deployment triggered
- [ ] Build logs reviewed (no errors)
- [ ] Deployment successful (green checkmark)
- [ ] Preview URL tested before domain assignment
- [ ] Production URL working: https://snapshot.clickcreate.io

---

## ⚙️ Sync Worker Deployment (Render)

### Render Account Setup

- [ ] Render account created at https://render.com
- [ ] Payment method added (if required)
- [ ] Team account created (if needed)

### Service Creation

- [ ] New Web Service created
- [ ] GitHub repository connected: `clickcreate/nft-snapshot-sync-worker`
- [ ] Service configuration:
  - Name: `nft-snapshot-sync-worker`
  - Environment: Node
  - Build Command: `npm install`
  - Start Command: `npm start`
  - Branch: `main`

### Environment Variables Configuration

Navigate to: Service → Environment

- [ ] `POSTGRES_URL` added (same as frontend)
- [ ] `NEXT_PUBLIC_ALCHEMY_API_KEY` added (same as frontend)
- [ ] `PORT` set to `3001`
- [ ] Auto-Deploy enabled for main branch

### Service Deployment

- [ ] Initial deployment triggered
- [ ] Build logs reviewed (no errors)
- [ ] Service status: Running (green)
- [ ] Service URL noted: `https://nft-snapshot-sync-worker-xxxx.onrender.com`

### Health Check Verification

- [ ] Health endpoint tested: `curl https://your-worker-url.onrender.com/health`
- [ ] Expected response received:
  ```json
  {
    "status": "healthy",
    "database": "connected",
    "uptime": "123 seconds"
  }
  ```
- [ ] Database connection confirmed in logs
- [ ] No error messages in service logs

---

## 🔗 Service Integration

### Frontend → Worker Connection

- [ ] Worker URL saved from Render dashboard
- [ ] Worker URL added to frontend allowed origins (if CORS configured)
- [ ] Test sync initiated from frontend UI
- [ ] Worker logs show incoming sync requests
- [ ] Sync completes successfully
- [ ] Data appears in database
- [ ] Frontend displays synced data

### Database Connectivity

- [ ] Frontend can read from database (test: load collections page)
- [ ] Worker can write to database (test: run sync)
- [ ] Both services using same `POSTGRES_URL`
- [ ] No connection pool errors in logs
- [ ] Query performance acceptable

---

## ✅ Functional Testing

### Homepage Tests

- [ ] Homepage loads without errors
- [ ] Hero section displays correctly
- [ ] "Generate Snapshot" button redirects to `/collections`
- [ ] Stats cards display (centered, 2-column layout)
- [ ] "View Features" button scrolls to features section
- [ ] All images and graphics load
- [ ] Dark theme applied correctly
- [ ] Mobile responsive design verified

### Collections Page Tests

- [ ] Collections page accessible: `/collections`
- [ ] "Generate Snapshot" button visible
- [ ] Quick Add Collection modal opens
- [ ] Can enter contract address
- [ ] Contract validation works (ERC-721/1155 detection)
- [ ] Successful addition redirects to snapshot page
- [ ] Sync quota displayed correctly (e.g., "0/2 Daily Syncs Used")
- [ ] Existing collections display in list

### Snapshot Generation Tests

- [ ] Navigate to collection snapshot page
- [ ] Blockchain sync status displays
- [ ] "Generate Snapshot" button initiates auto-sync if needed
- [ ] Progress indicators show during sync: "Preparing Snapshot... X%"
- [ ] After sync completes, snapshot generates automatically
- [ ] Loading state shows: "Generating..."
- [ ] Snapshot results display in table
- [ ] Results sorted by number_of_sets first, then balance
- [ ] Auto-scroll to results section works
- [ ] Download buttons visible and prominent (orange)
- [ ] "Download Snapshot as CSV" exports valid CSV file
- [ ] "Download Snapshot as JSON" exports valid JSON file

### Wallet Connection Tests

- [ ] Wallet connect button visible in header
- [ ] RainbowKit modal opens
- [ ] MetaMask connection works
- [ ] WalletConnect QR code displays
- [ ] Wallet address displays after connection
- [ ] JWT token stored in cookies
- [ ] User session persists on page refresh
- [ ] Disconnect wallet works
- [ ] Profile page accessible after connection

### Sync Quota Tests

- [ ] Connect wallet
- [ ] Quota displays: "X/2 Daily Syncs Used"
- [ ] Add first new collection (quota: 1/2)
- [ ] Add second new collection (quota: 2/2)
- [ ] Try to add third collection (should show "Daily limit reached")
- [ ] Wait for UTC midnight or test with database reset
- [ ] Quota resets to 0/2 after 24 hours
- [ ] Existing collections don't count toward quota

### Historical Snapshot Tests

- [ ] Navigate to collection snapshot page
- [ ] Select "Historical Snapshot" mode
- [ ] Enter past block number
- [ ] Snapshot generates with historical data
- [ ] Results display correctly
- [ ] Export works for historical snapshots

### Token Range Tests

- [ ] Select "Full Season" mode
- [ ] Enter token ID range (e.g., 1-100)
- [ ] Snapshot calculates complete sets correctly
- [ ] `numberOfSets` field present in results
- [ ] Sorting by number_of_sets works
- [ ] Export includes numberOfSets column

---

## 🔍 Security & Performance

### Security Checks

- [ ] Environment variables not exposed to client (check browser devtools)
- [ ] API routes protected with wallet authentication
- [ ] JWT tokens validated on protected routes
- [ ] Database credentials not visible in logs
- [ ] Rate limiting configured (500 req/min per IP)
- [ ] CORS properly configured (if applicable)
- [ ] SQL injection prevention verified (parameterized queries)
- [ ] XSS protection enabled (React default + CSP headers)

### Performance Tests

- [ ] Homepage loads in < 2 seconds
- [ ] Collection list loads in < 3 seconds
- [ ] Snapshot generation completes in < 5 seconds (for synced collections)
- [ ] Large snapshots (10,000+ holders) export successfully
- [ ] No memory leaks during extended use
- [ ] Database queries optimized (check query plans)
- [ ] API response times acceptable (< 1s for most endpoints)

### Monitoring Setup

- [ ] Vercel Analytics enabled
- [ ] Render monitoring dashboard reviewed
- [ ] Database monitoring enabled (connection pool, query times)
- [ ] Error tracking configured (Sentry, LogRocket, or built-in)
- [ ] Uptime monitoring configured (UptimeRobot, Pingdom)
- [ ] Alert thresholds set for critical issues

---

## 📊 Database Verification

### Data Integrity

- [ ] Run validation script:
  ```bash
  cd ClickFrontEnd
  POSTGRES_URL="your_connection_string" npx tsx scripts/validate-data.ts --verbose
  ```
- [ ] No critical errors reported
- [ ] All contracts have valid addresses
- [ ] Event counts match blockchain data
- [ ] Current state balances sum correctly
- [ ] No orphaned records

### Sample Data

- [ ] At least one test collection synced
- [ ] Sample snapshots generated
- [ ] Historical snapshot tested
- [ ] Token range snapshot tested
- [ ] All snapshot modes verified with real data

---

## 📖 Documentation Handoff

### For Client Team

- [ ] DEPLOYMENT_GUIDE.md reviewed with team
- [ ] ENV_VARIABLES.md shared with operations team
- [ ] Database schema documentation provided
- [ ] API endpoints documented (if needed)
- [ ] Common troubleshooting scenarios explained

### For End Users

- [ ] User guide created (optional)
- [ ] FAQ section prepared (optional)
- [ ] Video tutorial recorded (optional)
- [ ] Support contact information added

---

## 🚦 Go-Live Checklist

### Final Verification (Before Public Launch)

- [ ] All functional tests passed
- [ ] All security checks completed
- [ ] Performance benchmarks met
- [ ] Monitoring and alerts active
- [ ] Backup strategy in place
- [ ] Rollback plan documented

### Launch Steps

1. [ ] Enable Vercel production deployment
2. [ ] Verify custom domain is live
3. [ ] Test from external network (not development machine)
4. [ ] Announce to internal team
5. [ ] Monitor logs for first 24 hours
6. [ ] Address any issues immediately

### Post-Launch (First 7 Days)

- [ ] Daily log review
- [ ] User feedback collection
- [ ] Performance monitoring
- [ ] Error rate tracking
- [ ] Database growth monitoring
- [ ] API quota usage tracking (Alchemy, OpenSea)

---

## 🆘 Emergency Contacts & Resources

### Service Status Pages

- Vercel: https://www.vercel-status.com/
- Render: https://status.render.com/
- Neon: https://status.neon.tech/
- Alchemy: https://status.alchemy.com/

### Support Channels

- Vercel Support: https://vercel.com/support
- Render Support: https://render.com/support
- Database Provider Support: (check your provider)

### Rollback Procedure

If critical issues occur:

1. Revert to previous deployment in Vercel (Deployments → Previous → Redeploy)
2. Stop sync worker in Render (pause service)
3. Check database for corruption
4. Review error logs
5. Fix issues in development
6. Redeploy after thorough testing

---

## ✅ Sign-Off

### Deployment Team

- [ ] Frontend deployed and verified by: _________________ Date: _______
- [ ] Sync worker deployed and verified by: _________________ Date: _______
- [ ] Database configured and verified by: _________________ Date: _______
- [ ] Security review completed by: _________________ Date: _______
- [ ] Final approval for go-live by: _________________ Date: _______

### Notes

```
Add any additional notes, observations, or issues encountered during deployment:




```

---

**Project successfully handed off! 🎉**

For ongoing support or questions, refer to DEPLOYMENT_GUIDE.md and ENV_VARIABLES.md in the repository.
