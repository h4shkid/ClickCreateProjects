# ClickCreate Sync Worker V2.0

**Enterprise-Level NFT Event Syncing Service**

## 🚀 Features

- ✅ **Self-Healing**: Auto-retry with exponential backoff
- ✅ **Gap Detection & Filling**: Finds and fills missing blocks
- ✅ **Duplicate Prevention**: Database-level conflict handling
- ✅ **Memory-Safe**: Chunked processing with GC
- ✅ **Crash Recovery**: Checkpoint system
- ✅ **Rate Limiting**: Smart throttling
- ✅ **Progress Tracking**: Real-time ETA
- ✅ **Multi-Contract**: Queue system

## 📦 Setup

```bash
npm install
```

Create `.env`:
```
POSTGRES_URL=your_postgres_url
NEXT_PUBLIC_ALCHEMY_API_KEY=your_key
PORT=3001
```

## 🏃 Run

```bash
npm start  # Production
npm run dev  # Development
```

## 📡 API

**Health Check:** `GET /health`
**Trigger Sync:** `POST /sync` with `{contractAddress, fromBlock, toBlock}`
**Get Progress:** `GET /progress/:address`

## 🎯 Deploy to Render

1. Create Web Service
2. Set env vars
3. Deploy command: `npm start`
4. Health check: `/health`

Done!
