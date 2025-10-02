import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';

export async function GET() {
  try {
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();
    
    // Get comprehensive statistics
    const stats = {
      totalEvents: db.prepare('SELECT COUNT(*) as count FROM events').get() as any,
      totalHolders: db.prepare('SELECT COUNT(DISTINCT address) as count FROM current_state WHERE balance > 0').get() as any,
      uniqueTokens: db.prepare('SELECT COUNT(DISTINCT token_id) as count FROM current_state').get() as any,
      totalTransfers: db.prepare("SELECT COUNT(*) as count FROM events WHERE event_type IN ('TransferSingle', 'TransferBatch')").get() as any,
      totalMints: db.prepare('SELECT COUNT(*) as count FROM minting_history').get() as any,
      totalBurns: db.prepare('SELECT COUNT(*) as count FROM burn_history').get() as any,
      lastSyncedBlock: db.prepare('SELECT MAX(block_number) as block FROM events').get() as any,
      collectionStats: db.prepare('SELECT * FROM collection_stats ORDER BY created_at DESC LIMIT 1').get() as any,
      topTokens: db.prepare(`
        SELECT token_id, COUNT(*) as holder_count, SUM(CAST(balance AS INTEGER)) as total_balance
        FROM current_state 
        WHERE balance > 0
        GROUP BY token_id
        ORDER BY holder_count DESC
        LIMIT 5
      `).all() as any[],
      recentTransfers: db.prepare(`
        SELECT * FROM events 
        WHERE event_type IN ('TransferSingle', 'TransferBatch')
        ORDER BY block_number DESC 
        LIMIT 10
      `).all() as any[]
    };
    
    return NextResponse.json({
      success: true,
      data: {
        totalHolders: stats.totalHolders.count,
        uniqueTokens: stats.uniqueTokens.count,
        totalTransfers: stats.totalTransfers.count,
        totalEvents: stats.totalEvents.count,
        totalMints: stats.totalMints.count,
        totalBurns: stats.totalBurns.count,
        lastSyncedBlock: stats.lastSyncedBlock.block,
        topTokens: stats.topTokens,
        recentTransfers: stats.recentTransfers,
        collectionStats: stats.collectionStats
      }
    });
  } catch (error: any) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get statistics'
      },
      { status: 500 }
    );
  }
}