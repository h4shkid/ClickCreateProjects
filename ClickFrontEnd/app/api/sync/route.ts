import { NextRequest, NextResponse } from 'next/server';
import { BlockchainSyncer } from '@/scripts/sync-blockchain';
import { getDatabase } from '@/lib/database/init';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { startBlock, endBlock } = body;
    
    // Initialize syncer
    const syncer = new BlockchainSyncer();
    
    // Start sync in background (for production, use a job queue)
    syncer.sync(startBlock, endBlock).then(() => {
      syncer.rebuildState();
      syncer.close();
    }).catch(error => {
      console.error('Sync error:', error);
      syncer.close();
    });
    
    return NextResponse.json({
      success: true,
      message: 'Sync started',
      startBlock: startBlock || 'latest-10000',
      endBlock: endBlock || 'latest'
    });
  } catch (error: any) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to start sync'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();
    
    // Get sync status
    const syncStatus = db.prepare(
      'SELECT * FROM sync_status ORDER BY sync_timestamp DESC LIMIT 1'
    ).get() as any;
    
    // Get statistics
    const stats = {
      lastSyncedBlock: syncStatus?.last_synced_block || 0,
      status: syncStatus?.status || 'never_synced',
      syncTimestamp: syncStatus?.sync_timestamp || null,
      totalEvents: db.prepare('SELECT COUNT(*) as count FROM events').get() as any,
      totalHolders: db.prepare('SELECT COUNT(DISTINCT address) as count FROM current_state WHERE balance > 0').get() as any,
      uniqueTokens: db.prepare('SELECT COUNT(DISTINCT token_id) as count FROM current_state').get() as any
    };
    
    return NextResponse.json({
      success: true,
      data: {
        lastSyncedBlock: stats.lastSyncedBlock,
        status: stats.status,
        syncTimestamp: stats.syncTimestamp,
        statistics: {
          totalEvents: stats.totalEvents.count,
          totalHolders: stats.totalHolders.count,
          uniqueTokens: stats.uniqueTokens.count
        }
      }
    });
  } catch (error: any) {
    console.error('Sync status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get sync status'
      },
      { status: 500 }
    );
  }
}