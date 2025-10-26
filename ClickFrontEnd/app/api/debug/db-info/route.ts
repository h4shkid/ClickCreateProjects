import { NextResponse } from 'next/server'

export async function GET() {
  const postgresUrl = process.env.POSTGRES_URL
  const dbType = postgresUrl ? 'postgres' : 'sqlite'

  return NextResponse.json({
    databaseType: dbType,
    hasPostgresUrl: !!postgresUrl,
    postgresUrlLength: postgresUrl ? postgresUrl.length : 0,
    postgresUrlPreview: postgresUrl ? `${postgresUrl.substring(0, 20)}...` : null,
    environment: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV || 'local',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('POSTGRES') || k.includes('DATABASE'))
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  })
}
