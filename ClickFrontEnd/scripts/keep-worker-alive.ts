// Keep Render free tier worker alive by pinging every 10 minutes
// Run this on a Vercel Cron Job

const WORKER_URL = process.env.SYNC_WORKER_URL || 'https://snapshotworker.onrender.com'

async function pingWorker() {
  try {
    const response = await fetch(`${WORKER_URL}/health`)
    const data = await response.json()

    console.log(`✅ Worker ping successful:`, data)
    return { success: true, data }
  } catch (error: any) {
    console.error(`❌ Worker ping failed:`, error.message)
    return { success: false, error: error.message }
  }
}

// For Vercel Cron Job
export async function GET() {
  const result = await pingWorker()
  return Response.json(result)
}

// For local testing
if (import.meta.url === `file://${process.argv[1]}`) {
  pingWorker()
}
