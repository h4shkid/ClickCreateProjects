# ClickCreate Sync Worker

Background worker service for blockchain synchronization.

## Features

- 🔄 Async blockchain sync (no timeout limits)
- 📊 Job queue system
- 🚀 Progress tracking
- ⚡ Optimized batch processing
- 🔗 Direct Postgres integration

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Run locally:
```bash
npm run dev
```

## API Endpoints

### POST /sync
Trigger blockchain sync for a contract.

**Request:**
```json
{
  "contractAddress": "0x...",
  "fromBlock": 14933647,  // optional, defaults to deployment block
  "toBlock": 23526504     // optional, defaults to latest
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "sync-0x...-1234567890",
  "message": "Sync job queued",
  "position": 1
}
```

### GET /status/:jobId
Check sync job status.

**Response:**
```json
{
  "success": true,
  "job": {
    "id": "sync-0x...-1234567890",
    "status": "processing",
    "progress": 45,
    "eventsProcessed": 12500
  }
}
```

### GET /health
Health check endpoint.

## Deploy to Railway

1. Create Railway account: https://railway.app
2. Install Railway CLI:
```bash
npm install -g @railway/cli
```

3. Login and deploy:
```bash
railway login
railway init
railway up
```

4. Set environment variables in Railway dashboard:
- `POSTGRES_URL`
- `NEXT_PUBLIC_ALCHEMY_API_KEY`

## Deploy to Render

1. Create Render account: https://render.com
2. Create new Web Service
3. Connect GitHub repo
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables

## Cost

- **Railway**: $5/month (Hobby plan)
- **Render**: $7/month (Starter plan)
- Both offer free trial credits

## Integration with Vercel

The Vercel frontend calls this worker via:

```javascript
// In Vercel API route
const response = await fetch(`${process.env.SYNC_WORKER_URL}/sync`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contractAddress: '0x...',
    fromBlock: 'auto',
    toBlock: 'latest'
  })
})
```
