import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

interface DashboardStats {
  totalContracts: number
  totalUsers: number
  totalSnapshots: number
}

export async function GET(request: NextRequest) {
  let db: Database.Database | null = null
  
  try {
    // Initialize database
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'nft-snapshot.db')
    db = new Database(dbPath)
    
    console.log('📊 Fetching dashboard statistics...')
    
    let totalContracts = 0
    let totalUsers = 0 
    let totalSnapshots = 0
    
    // Get total registered contracts
    try {
      const contractsQuery = `SELECT COUNT(*) as count FROM contracts`
      const contractsResult = db.prepare(contractsQuery).get() as { count: number }
      totalContracts = contractsResult.count
    } catch (error) {
      console.log('📋 Contracts table not found, trying legacy approach')
      
      // Fallback: count distinct contract addresses from events
      try {
        const legacyQuery = `SELECT COUNT(DISTINCT contract_address) as count FROM events`
        const legacyResult = db.prepare(legacyQuery).get() as { count: number }
        totalContracts = legacyResult.count
        console.log(`📊 Found ${totalContracts} contracts from events data`)
      } catch (legacyError) {
        totalContracts = 0
      }
    }
    
    // Get total users (from user_profiles table)
    try {
      const usersQuery = `SELECT COUNT(*) as count FROM user_profiles`
      const usersResult = db.prepare(usersQuery).get() as { count: number }
      totalUsers = usersResult.count
    } catch (error) {
      console.log('👤 User profiles table not found, using 0')
      totalUsers = 0
    }
    
    // Get total snapshots (from user_snapshots table)
    try {
      const snapshotsQuery = `SELECT COUNT(*) as count FROM user_snapshots`
      const snapshotsResult = db.prepare(snapshotsQuery).get() as { count: number }
      totalSnapshots = snapshotsResult.count
    } catch (error) {
      console.log('📸 User snapshots table not found, trying legacy approach')
      
      // Fallback: estimate snapshots from existing data if available
      try {
        // Check if we have any events table (indicating some usage)
        const eventsQuery = `SELECT COUNT(DISTINCT block_number) as count FROM events`
        const eventsResult = db.prepare(eventsQuery).get() as { count: number }
        totalSnapshots = Math.min(eventsResult.count, 10) // Conservative estimate
        console.log(`📊 Estimated ${totalSnapshots} snapshots from events data`)
      } catch (legacyError) {
        totalSnapshots = 0
      }
    }
    
    const stats: DashboardStats = {
      totalContracts,
      totalUsers,
      totalSnapshots
    }
    
    console.log('✅ Dashboard stats fetched:', stats)
    
    return NextResponse.json({
      success: true,
      data: stats
    })
    
  } catch (error) {
    console.error('❌ Dashboard stats error:', error)
    
    // Return fallback stats if database isn't available
    return NextResponse.json({
      success: true,
      data: {
        totalContracts: 0,
        totalUsers: 0,
        totalSnapshots: 0
      }
    })
    
  } finally {
    if (db) {
      try {
        db.close()
      } catch (closeError) {
        console.error('Error closing database:', closeError)
      }
    }
  }
}