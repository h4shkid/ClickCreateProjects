# Vercel Deployment Guide

## Required Environment Variables

Add these environment variables in your Vercel project settings:

### Blockchain RPC (Required)
```
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key
```

### OpenSea API (Required)
```
OPENSEA_API_KEY=your_opensea_api_key
```

### WalletConnect (Required)
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### Authentication (Required)
```
JWT_SECRET=your_random_jwt_secret_minimum_32_characters
```

### Database (Production)
For production, you'll need to migrate from SQLite to Vercel Postgres:

```
POSTGRES_URL=your_vercel_postgres_connection_string
```

## Deployment Steps

### Option 1: Vercel Dashboard (Recommended)

1. Go to https://vercel.com/new
2. Click "Import Project"
3. Select your GitHub repository: `h4shkid/ClickCreateProjects`
4. Configure project:
   - **Framework Preset:** Next.js
   - **Root Directory:** `ClickFrontEnd`
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
5. Add environment variables (listed above)
6. Click "Deploy"

### Option 2: Vercel CLI

```bash
cd ClickFrontEnd
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? clickcreate-nft-analytics (or your choice)
# - Directory? ./
# - Override settings? No

# After deployment, add environment variables:
vercel env add NEXT_PUBLIC_ALCHEMY_API_KEY
vercel env add OPENSEA_API_KEY
vercel env add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
vercel env add JWT_SECRET

# Deploy to production:
vercel --prod
```

## Database Migration (Important!)

SQLite won't work on Vercel serverless. You need to migrate to Vercel Postgres:

1. Create a Vercel Postgres database in your project
2. Run migration scripts to transfer data from SQLite to Postgres
3. Update database connection code to use Postgres

**Migration files needed:**
- Update `lib/database/init.ts` to use Postgres instead of SQLite
- Create Postgres schema migration
- Export SQLite data and import to Postgres

## Post-Deployment

1. Test wallet connection
2. Test snapshot generation
3. Test blockchain sync
4. Verify CSV exports work correctly
5. Check all environment variables are set

## Important Notes

- ✅ All test and debug scripts have been archived
- ✅ `.vercelignore` excludes unnecessary files
- ✅ Code is optimized for production
- ⚠️ **Database migration from SQLite to Postgres required**
- ⚠️ **File uploads (SQLite .db files) won't persist on Vercel serverless**

## Support

- Vercel Docs: https://vercel.com/docs
- Next.js Docs: https://nextjs.org/docs
- Vercel Postgres: https://vercel.com/docs/storage/vercel-postgres
