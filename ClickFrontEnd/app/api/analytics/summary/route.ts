import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenId = searchParams.get('tokenId');
    const timeRange = searchParams.get('timeRange') || '7d';
    const groupBy = searchParams.get('groupBy') || 'day';

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();

    // Get overall statistics
    let overallStats;
    if (tokenId) {
      overallStats = db.prepare(`
        SELECT 
          COUNT(DISTINCT address) as unique_holders,
          COUNT(DISTINCT token_id) as unique_tokens,
          SUM(balance) as total_supply,
          AVG(balance) as avg_balance,
          MAX(balance) as max_balance,
          MIN(CASE WHEN balance > 0 THEN balance END) as min_balance
        FROM current_state
        WHERE balance > 0 AND token_id = ?
      `).get(tokenId) as any;
    } else {
      overallStats = db.prepare(`
        SELECT 
          COUNT(DISTINCT address) as unique_holders,
          COUNT(DISTINCT token_id) as unique_tokens,
          SUM(balance) as total_supply,
          AVG(balance) as avg_balance,
          MAX(balance) as max_balance,
          MIN(CASE WHEN balance > 0 THEN balance END) as min_balance
        FROM current_state
        WHERE balance > 0
      `).get() as any;
    }

    // Get event statistics
    let eventStats;
    if (tokenId) {
      eventStats = db.prepare(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT from_address) as unique_senders,
          COUNT(DISTINCT to_address) as unique_receivers,
          MIN(block_number) as first_block,
          MAX(block_number) as last_block,
          MIN(block_timestamp) as first_event,
          MAX(block_timestamp) as last_event
        FROM events
        WHERE token_id = ?
      `).get(tokenId) as any;
    } else {
      eventStats = db.prepare(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(DISTINCT from_address) as unique_senders,
          COUNT(DISTINCT to_address) as unique_receivers,
          MIN(block_number) as first_block,
          MAX(block_number) as last_block,
          MIN(block_timestamp) as first_event,
          MAX(block_timestamp) as last_event
        FROM events
      `).get() as any;
    }

    // Get holder distribution
    let distribution;
    if (tokenId) {
      distribution = db.prepare(`
        SELECT 
          CASE 
            WHEN balance = 1 THEN '1'
            WHEN balance BETWEEN 2 AND 5 THEN '2-5'
            WHEN balance BETWEEN 6 AND 10 THEN '6-10'
            WHEN balance BETWEEN 11 AND 50 THEN '11-50'
            WHEN balance BETWEEN 51 AND 100 THEN '51-100'
            WHEN balance > 100 THEN '100+'
          END as range,
          COUNT(*) as holders,
          SUM(balance) as total_balance
        FROM current_state
        WHERE balance > 0 AND token_id = ?
        GROUP BY range
        ORDER BY MIN(balance)
      `).all(tokenId) as any[];
    } else {
      distribution = db.prepare(`
        SELECT 
          CASE 
            WHEN balance = 1 THEN '1'
            WHEN balance BETWEEN 2 AND 5 THEN '2-5'
            WHEN balance BETWEEN 6 AND 10 THEN '6-10'
            WHEN balance BETWEEN 11 AND 50 THEN '11-50'
            WHEN balance BETWEEN 51 AND 100 THEN '51-100'
            WHEN balance > 100 THEN '100+'
          END as range,
          COUNT(*) as holders,
          SUM(balance) as total_balance
        FROM current_state
        WHERE balance > 0
        GROUP BY range
        ORDER BY MIN(balance)
      `).all() as any[];
    }

    // Get top holders
    let topHolders;
    if (tokenId) {
      topHolders = db.prepare(`
        SELECT 
          address,
          balance,
          1 as token_count
        FROM current_state
        WHERE balance > 0 AND token_id = ?
        ORDER BY balance DESC
        LIMIT 10
      `).all(tokenId) as any[];
    } else {
      topHolders = db.prepare(`
        SELECT 
          address,
          SUM(balance) as balance,
          COUNT(DISTINCT token_id) as token_count
        FROM current_state
        WHERE balance > 0
        GROUP BY address
        ORDER BY balance DESC
        LIMIT 10
      `).all() as any[];
    }

    // Get token activity (if not filtering by specific token)
    let tokenActivity = [];
    if (!tokenId) {
      tokenActivity = db.prepare(`
        SELECT 
          token_id,
          COUNT(DISTINCT address) as holders,
          SUM(balance) as total_supply,
          MAX(balance) as max_holding
        FROM current_state
        WHERE balance > 0
        GROUP BY token_id
        ORDER BY holders DESC
        LIMIT 10
      `).all() as any[];
    }

    // Get time series data based on timeRange
    const timeCondition = {
      '24h': "datetime('now', '-1 day')",
      '7d': "datetime('now', '-7 days')",
      '30d': "datetime('now', '-30 days')",
      '90d': "datetime('now', '-90 days')",
      'all': '0'
    }[timeRange] || "datetime('now', '-7 days')";

    let timeSeries;
    if (tokenId) {
      timeSeries = db.prepare(`
        SELECT 
          DATE(block_timestamp, 'unixepoch') as date,
          COUNT(*) as events,
          COUNT(DISTINCT from_address) as unique_from,
          COUNT(DISTINCT to_address) as unique_to
        FROM events
        WHERE block_timestamp >= strftime('%s', ${timeCondition}) AND token_id = ?
        GROUP BY DATE(block_timestamp, 'unixepoch')
        ORDER BY date DESC
      `).all(tokenId) as any[];
    } else {
      timeSeries = db.prepare(`
        SELECT 
          DATE(block_timestamp, 'unixepoch') as date,
          COUNT(*) as events,
          COUNT(DISTINCT from_address) as unique_from,
          COUNT(DISTINCT to_address) as unique_to
        FROM events
        WHERE block_timestamp >= strftime('%s', ${timeCondition})
        GROUP BY DATE(block_timestamp, 'unixepoch')
        ORDER BY date DESC
      `).all() as any[];
    }

    // Calculate growth metrics
    const growth = {
      newHolders24h: 0,
      newHolders7d: 0,
      volumeChange24h: 0,
      activeAddresses24h: 0
    };

    if (timeSeries.length > 0) {
      const recent = timeSeries.slice(0, 7);
      growth.newHolders7d = recent.reduce((sum: number, day) => sum + day.unique_to, 0);
      if (timeSeries.length > 0) {
        growth.newHolders24h = timeSeries[0].unique_to;
        growth.activeAddresses24h = timeSeries[0].unique_from + timeSeries[0].unique_to;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        overview: {
          uniqueHolders: overallStats.unique_holders,
          uniqueTokens: overallStats.unique_tokens,
          totalSupply: overallStats.total_supply || '0',
          avgBalance: overallStats.avg_balance || '0',
          maxBalance: overallStats.max_balance || '0',
          minBalance: overallStats.min_balance || '0'
        },
        events: {
          totalEvents: eventStats.total_events,
          uniqueSenders: eventStats.unique_senders,
          uniqueReceivers: eventStats.unique_receivers,
          firstBlock: eventStats.first_block,
          lastBlock: eventStats.last_block,
          firstEvent: eventStats.first_event,
          lastEvent: eventStats.last_event
        },
        distribution,
        topHolders: topHolders.map((h: any) => ({
          address: h.address,
          balance: h.balance.toString(),
          tokenCount: h.token_count,
          percentage: overallStats.total_supply && overallStats.total_supply !== '0' 
            ? ((BigInt(h.balance) * BigInt(100)) / BigInt(overallStats.total_supply)).toString()
            : '0'
        })),
        tokenActivity,
        timeSeries,
        growth,
        metadata: {
          tokenId,
          timeRange,
          generatedAt: new Date().toISOString()
        }
      }
    });
  } catch (error: any) {
    console.error('Analytics summary error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate analytics summary'
      },
      { status: 500 }
    );
  }
}