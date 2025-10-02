import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const tokenId = searchParams.get('tokenId');
    const timeRange = searchParams.get('timeRange') || '7d';

    // Validate contract address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    const contractAddress = address.toLowerCase();

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();

    // Get contract info
    const contractInfo = db.prepare(`
      SELECT id, name, symbol, contract_type, total_supply, is_verified
      FROM contracts 
      WHERE LOWER(address) = ? AND is_active = 1
    `).get(contractAddress) as any;

    if (!contractInfo) {
      return NextResponse.json(
        { success: false, error: 'Contract not found or not active' },
        { status: 404 }
      );
    }

    // Get overall statistics for this contract
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
        WHERE balance > 0 AND LOWER(contract_address) = ? AND token_id = ?
      `).get(contractAddress, tokenId) as any;
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
        WHERE balance > 0 AND LOWER(contract_address) = ?
      `).get(contractAddress) as any;
    }

    // Get event statistics for this contract
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
        WHERE LOWER(contract_address) = ? AND token_id = ?
      `).get(contractAddress, tokenId) as any;
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
        WHERE LOWER(contract_address) = ?
      `).get(contractAddress) as any;
    }

    // Get holder distribution for this contract
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
        WHERE balance > 0 AND LOWER(contract_address) = ? AND token_id = ?
        GROUP BY range
        ORDER BY MIN(balance)
      `).all(contractAddress, tokenId) as any[];
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
        WHERE balance > 0 AND LOWER(contract_address) = ?
        GROUP BY range
        ORDER BY MIN(balance)
      `).all(contractAddress) as any[];
    }

    // Get top holders for this contract
    let topHolders;
    if (tokenId) {
      topHolders = db.prepare(`
        SELECT 
          address,
          balance,
          1 as token_count
        FROM current_state
        WHERE balance > 0 AND LOWER(contract_address) = ? AND token_id = ?
        ORDER BY balance DESC
        LIMIT 10
      `).all(contractAddress, tokenId) as any[];
    } else {
      topHolders = db.prepare(`
        SELECT 
          address,
          SUM(balance) as balance,
          COUNT(DISTINCT token_id) as token_count
        FROM current_state
        WHERE balance > 0 AND LOWER(contract_address) = ?
        GROUP BY address
        ORDER BY balance DESC
        LIMIT 10
      `).all(contractAddress) as any[];
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
        WHERE balance > 0 AND LOWER(contract_address) = ?
        GROUP BY token_id
        ORDER BY holders DESC
        LIMIT 10
      `).all(contractAddress) as any[];
    }

    // Get time series data based on timeRange for this contract
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
        WHERE block_timestamp >= strftime('%s', ${timeCondition}) 
          AND LOWER(contract_address) = ? AND token_id = ?
        GROUP BY DATE(block_timestamp, 'unixepoch')
        ORDER BY date DESC
      `).all(contractAddress, tokenId) as any[];
    } else {
      timeSeries = db.prepare(`
        SELECT 
          DATE(block_timestamp, 'unixepoch') as date,
          COUNT(*) as events,
          COUNT(DISTINCT from_address) as unique_from,
          COUNT(DISTINCT to_address) as unique_to
        FROM events
        WHERE block_timestamp >= strftime('%s', ${timeCondition}) 
          AND LOWER(contract_address) = ?
        GROUP BY DATE(block_timestamp, 'unixepoch')
        ORDER BY date DESC
      `).all(contractAddress) as any[];
    }

    // Get latest contract analytics if available
    const contractAnalytics = db.prepare(`
      SELECT 
        gini_coefficient,
        whale_concentration,
        volume_24h,
        volume_7d,
        volume_30d,
        unique_traders_24h,
        unique_traders_7d,
        unique_traders_30d,
        avg_holding_period
      FROM contract_analytics ca
      JOIN contracts c ON ca.contract_id = c.id
      WHERE LOWER(c.address) = ?
      ORDER BY ca.analysis_date DESC
      LIMIT 1
    `).get(contractAddress) as any;

    // Calculate growth metrics
    const growth = {
      newHolders24h: 0,
      newHolders7d: 0,
      volumeChange24h: 0,
      activeAddresses24h: 0
    };

    if (timeSeries.length > 0) {
      const recent = timeSeries.slice(0, 7);
      growth.newHolders7d = recent.reduce((sum, day) => sum + day.unique_to, 0);
      if (timeSeries.length > 0) {
        growth.newHolders24h = timeSeries[0].unique_to;
        growth.activeAddresses24h = timeSeries[0].unique_from + timeSeries[0].unique_to;
      }
    }

    return NextResponse.json({
      success: true,
      analytics: {
        contract: {
          address: contractAddress,
          name: contractInfo.name,
          symbol: contractInfo.symbol,
          contractType: contractInfo.contract_type,
          isVerified: !!contractInfo.is_verified
        },
        overview: {
          totalHolders: overallStats?.unique_holders || 0,
          uniqueTokens: overallStats?.unique_tokens || 0,
          totalSupply: overallStats?.total_supply?.toString() || '0',
          avgHoldingPerUser: overallStats?.avg_balance?.toFixed(2) || '0'
        },
        events: {
          totalTransfers: eventStats?.total_events || 0,
          last24hTransfers: timeSeries[0]?.events || 0,
          uniqueSenders: eventStats?.unique_senders || 0,
          uniqueReceivers: eventStats?.unique_receivers || 0,
          firstBlock: eventStats?.first_block,
          lastBlock: eventStats?.last_block
        },
        distribution,
        topHolders: topHolders?.map(h => ({
          address: h.address,
          balance: h.balance.toString(),
          tokenCount: h.token_count,
          percentage: overallStats?.total_supply && overallStats.total_supply !== '0' 
            ? ((BigInt(h.balance) * BigInt(10000)) / BigInt(overallStats.total_supply)) / BigInt(100)
            : '0'
        })) || [],
        tokenActivity,
        timeSeries,
        growth,
        advanced: contractAnalytics ? {
          giniCoefficient: contractAnalytics.gini_coefficient,
          whaleConcentration: contractAnalytics.whale_concentration,
          volume24h: contractAnalytics.volume_24h,
          volume7d: contractAnalytics.volume_7d,
          volume30d: contractAnalytics.volume_30d,
          uniqueTraders24h: contractAnalytics.unique_traders_24h,
          uniqueTraders7d: contractAnalytics.unique_traders_7d,
          uniqueTraders30d: contractAnalytics.unique_traders_30d,
          avgHoldingPeriod: contractAnalytics.avg_holding_period
        } : null,
        metadata: {
          contractAddress,
          tokenId,
          timeRange,
          generatedAt: new Date().toISOString()
        }
      }
    });
  } catch (error: any) {
    console.error('Contract analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate contract analytics'
      },
      { status: 500 }
    );
  }
}