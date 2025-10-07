# Complete Vercel Deployment Guide with Postgres Migration

This guide will walk you through deploying ClickCreate NFT Analytics to Vercel with full Postgres database support and functional blockchain syncing.

## 📋 Prerequisites

- Vercel account (free tier works)
- GitHub repository (already set up)
- Current SQLite database with data
- Environment variables ready

---

## 🚀 Deployment Steps

### Step 1: Export Current SQLite Data

First, export your local database to JSON format:

```bash
cd ClickFrontEnd
npx tsx scripts/export-sqlite-to-json.ts
```

This will create JSON exports in `migrations/data-export/` directory with all your current data.

**Expected output:**
- contracts.json
- user_profiles.json
- events.json
- current_state.json
- nft_metadata.json
- etc.

---

### Step 2: Commit and Push All Changes

```bash
# Add all migration files
git add .

# Commit
git commit -m "Add Postgres migration infrastructure for Vercel deployment

- Created Postgres schema migration (001_initial_postgres_schema.sql)
- Added database abstraction layer (adapter.ts)
- Created data export/import scripts
- Installed pg package for Postgres support
- Added Postgres database manager

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
git push origin main
```

---

### Step 3: Create Vercel Project

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Click "Import Project"
3. Select your GitHub repository: `h4shkid/ClickCreateProjects`
4. Configure:
   - **Framework Preset:** Next.js
   - **Root Directory:** `ClickFrontEnd`
   - **Build Command:** `npm run build`
   - **Output Directory:** `.next`
   - **Install Command:** `npm install`

5. **DO NOT DEPLOY YET** - Click "Environment Variables" first

#### Option B: Via Vercel CLI

```bash
cd ClickFrontEnd
vercel

# Follow prompts:
# - Set up and deploy? No (we need to add environment variables first)
# - Link to existing project? No
# - Project name? clickcreate-nft-analytics
# - Directory? ./
```

---

### Step 4: Add Environment Variables in Vercel

In your Vercel project settings, add these environment variables:

#### Required for App Functionality
```
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key_here
OPENSEA_API_KEY=your_opensea_api_key_here
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
JWT_SECRET=your_random_jwt_secret_minimum_32_characters_here
```

#### Database Configuration
```
DATABASE_TYPE=postgres
```

**Note:** Don't add `POSTGRES_URL` yet - we'll get this from Vercel Postgres

---

### Step 5: Create Vercel Postgres Database

1. In your Vercel project dashboard, go to **Storage** tab
2. Click **Create Database**
3. Select **Postgres**
4. Choose region (closest to your users)
5. Click **Create**

Vercel will automatically add these environment variables to your project:
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

---

### Step 6: Run Postgres Schema Migration

After creating the database, you need to run the schema migration:

#### Via Vercel Postgres Dashboard

1. Go to your Postgres database in Vercel
2. Click on "Query" tab
3. Copy the contents of `migrations/001_initial_postgres_schema.sql`
4. Paste and execute in the query editor

#### Via psql (if you have it installed)

```bash
# Get connection string from Vercel
export POSTGRES_URL="your_postgres_url_from_vercel"

# Run migration
psql $POSTGRES_URL < migrations/001_initial_postgres_schema.sql
```

---

### Step 7: Import Data to Postgres

Now import your exported SQLite data into Postgres:

```bash
# Make sure POSTGRES_URL is set (get it from Vercel dashboard)
export POSTGRES_URL="postgresql://..."

# Run import script
npx tsx scripts/import-json-to-postgres.ts
```

**This will:**
- Connect to your Vercel Postgres database
- Import all data from JSON files
- Create proper indexes and constraints
- Show progress and summary

**Expected output:**
```
✅ Successful: 14 tables
Total rows imported: 150,000+ rows
```

---

### Step 8: Deploy to Vercel

Now you're ready to deploy!

#### Via Dashboard
Click "Deploy" button in Vercel dashboard

#### Via CLI
```bash
vercel --prod
```

---

### Step 9: Verify Deployment

1. **Check Build Logs**
   - Ensure build completed successfully
   - Look for "Build completed" message

2. **Test the Deployment**
   - Visit your deployment URL (Vercel will provide it)
   - Test wallet connection
   - Try viewing a collection
   - Test generating a snapshot
   - Verify blockchain sync works

3. **Check Database Connection**
   - Go to a collection page
   - Click "Sync" button
   - Verify it syncs blockchain data successfully

---

## 🔧 Troubleshooting

### Build Errors

**Error: "Cannot find module 'pg'"**
```bash
# Ensure pg is in package.json
npm install pg @types/pg
git add package.json package-lock.json
git commit -m "Add pg dependency"
git push
```

**Error: "POSTGRES_URL not defined"**
- Ensure DATABASE_TYPE=postgres is set in Vercel environment variables
- Ensure Vercel Postgres database is created and connected

### Runtime Errors

**Error: "Database connection failed"**
- Check that POSTGRES_URL is properly set in Vercel
- Verify database is running in Vercel dashboard
- Check connection limits (Vercel Postgres free tier has limits)

**Error: "No blockchain data"**
- Run a sync operation from the UI
- Check that events table has data
- Verify NEXT_PUBLIC_ALCHEMY_API_KEY is set correctly

---

## 📊 Post-Deployment Checklist

- [ ] Deployment successful
- [ ] Homepage loads correctly
- [ ] Wallet connection works (RainbowKit)
- [ ] Can view existing collections
- [ ] Can add new contracts
- [ ] Blockchain sync works
- [ ] Snapshots generate correctly
- [ ] CSV export works
- [ ] Historical snapshots work
- [ ] Token filtering works

---

## 🔄 Future Updates

To deploy future code changes:

```bash
# Make your changes
git add .
git commit -m "Your changes"
git push origin main

# Vercel will auto-deploy from GitHub
```

---

## 💾 Database Backups

### Export from Postgres

```bash
# Set your Postgres URL
export POSTGRES_URL="postgresql://..."

# Export to SQL file
pg_dump $POSTGRES_URL > backup-$(date +%Y%m%d).sql
```

### Restore from Backup

```bash
psql $POSTGRES_URL < backup-20251007.sql
```

---

## 📈 Monitoring

### Vercel Dashboard
- **Analytics:** View usage stats
- **Logs:** Check function logs for errors
- **Performance:** Monitor response times

### Database Monitoring
- **Vercel Postgres Dashboard:**
  - Query performance
  - Connection pool usage
  - Storage usage

---

## 🎯 Performance Tips

1. **Use Connection Pooling**
   - Vercel automatically uses `POSTGRES_URL` with pooling
   - Don't create too many connections

2. **Index Optimization**
   - Migration includes all necessary indexes
   - Monitor slow queries in Vercel dashboard

3. **Caching**
   - Consider adding Redis for blockchain data caching
   - Use Vercel Edge Config for static data

---

## 🆘 Support

If you encounter issues:

1. Check Vercel build logs
2. Check runtime logs in Vercel dashboard
3. Verify all environment variables are set
4. Test database connection manually
5. Check Postgres query logs

---

## 📝 Summary

You now have a fully functional NFT analytics platform deployed on Vercel with:
- ✅ Postgres database for production data
- ✅ Blockchain syncing capabilities
- ✅ Wallet authentication
- ✅ Historical snapshots
- ✅ CSV exports
- ✅ Multi-collection support
- ✅ Token filtering

Your deployment URL will be: `https://your-project.vercel.app`

**Congratulations! 🎉**
