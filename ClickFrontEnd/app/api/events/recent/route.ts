import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const eventType = searchParams.get('eventType');
    const tokenId = searchParams.get('tokenId');

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();

    // Build query
    let query = `
      SELECT 
        e.*,
        cs_from.balance as from_balance,
        cs_to.balance as to_balance
      FROM events e
      LEFT JOIN current_state cs_from ON e.from_address = cs_from.address AND e.token_id = cs_from.token_id
      LEFT JOIN current_state cs_to ON e.to_address = cs_to.address AND e.token_id = cs_to.token_id
    `;

    const conditions = [];
    const params = [];

    if (eventType) {
      conditions.push('e.event_type = ?');
      params.push(eventType);
    }

    if (tokenId) {
      conditions.push('e.token_id = ?');
      params.push(tokenId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY e.block_number DESC, e.log_index DESC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    const events = stmt.all(...params) as any[];

    // Format events for display
    const formattedEvents = events.map((event: any) => ({
      id: event.transaction_hash + '_' + event.log_index,
      type: event.event_type,
      tokenId: event.token_id,
      from: event.from_address,
      to: event.to_address,
      amount: event.amount || '1',
      blockNumber: event.block_number,
      timestamp: event.block_timestamp,
      transactionHash: event.transaction_hash,
      fromBalance: event.from_balance || '0',
      toBalance: event.to_balance || '0'
    }));

    // Get statistics
    const stats = {
      totalEvents: (db.prepare('SELECT COUNT(*) as count FROM events').get() as any).count,
      recentBlocks: (db.prepare(`
        SELECT COUNT(DISTINCT block_number) as count 
        FROM events 
        WHERE block_timestamp > strftime('%s', 'now', '-24 hours')
      `).get() as any).count,
      activeAddresses: (db.prepare(`
        SELECT COUNT(DISTINCT address) as count 
        FROM (
          SELECT from_address as address FROM events WHERE block_timestamp > strftime('%s', 'now', '-24 hours')
          UNION
          SELECT to_address as address FROM events WHERE block_timestamp > strftime('%s', 'now', '-24 hours')
        )
      `).get() as any).count
    };

    return NextResponse.json({
      success: true,
      data: {
        events: formattedEvents,
        stats,
        lastBlock: events[0]?.block_number || 0
      }
    });
  } catch (error: any) {
    console.error('Recent events API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch recent events'
      },
      { status: 500 }
    );
  }
}