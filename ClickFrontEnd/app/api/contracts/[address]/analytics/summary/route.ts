import { NextRequest, NextResponse } from 'next/server';
import { createDatabaseAdapter } from '@/lib/database/adapter';

// Detect database type from environment
const isPostgres = !!process.env.POSTGRES_URL;

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
    const db = createDatabaseAdapter();

    // Get contract info
    const contractInfo = await db.prepare(`
      SELECT id, name, symbol, contract_type, total_supply, is_verified
      FROM contracts
      WHERE LOWER(address) = $1
    `).get(contractAddress) as any;

    if (!contractInfo) {
      return NextResponse.json(
        { success: false, error: 'Contract not found or not active' },
        { status: 404 }
      );
    }

    // Prepare CAST for balance (TEXT in both DBs, but need to handle differently)
    const balanceCast = isPostgres ? 'CAST(balance AS NUMERIC)' : 'CAST(balance AS INTEGER)';

    // Get overall statistics for this contract
    let overallStats;
    if (tokenId) {
      overallStats = await db.prepare(`
        SELECT
          COUNT(DISTINCT address) as unique_holders,
          COUNT(DISTINCT token_id) as unique_tokens,
          SUM(${balanceCast}) as total_supply,
          AVG(${balanceCast}) as avg_balance,
          MAX(${balanceCast}) as max_balance,
          MIN(CASE WHEN ${balanceCast} > 0 THEN ${balanceCast} END) as min_balance
        FROM current_state
        WHERE ${balanceCast} > 0 AND LOWER(contract_address) = $1 AND token_id = $2
      `).get(contractAddress, tokenId) as any;
    } else {
      overallStats = await db.prepare(`
        SELECT
          COUNT(DISTINCT address) as unique_holders,
          COUNT(DISTINCT token_id) as unique_tokens,
          SUM(${balanceCast}) as total_supply,
          AVG(${balanceCast}) as avg_balance,
          MAX(${balanceCast}) as max_balance,
          MIN(CASE WHEN ${balanceCast} > 0 THEN ${balanceCast} END) as min_balance
        FROM current_state
        WHERE ${balanceCast} > 0 AND LOWER(contract_address) = $1
      `).get(contractAddress) as any;
    }

    // Get event statistics for this contract
    let eventStats;
    if (tokenId) {
      eventStats = await db.prepare(`
        SELECT
          COUNT(*) as total_events,
          COUNT(DISTINCT from_address) as unique_senders,
          COUNT(DISTINCT to_address) as unique_receivers,
          MIN(block_number) as first_block,
          MAX(block_number) as last_block,
          MIN(block_timestamp) as first_event,
          MAX(block_timestamp) as last_event
        FROM events
        WHERE LOWER(contract_address) = $1 AND token_id = $2
      `).get(contractAddress, tokenId) as any;
    } else {
      eventStats = await db.prepare(`
        SELECT
          COUNT(*) as total_events,
          COUNT(DISTINCT from_address) as unique_senders,
          COUNT(DISTINCT to_address) as unique_receivers,
          MIN(block_number) as first_block,
          MAX(block_number) as last_block,
          MIN(block_timestamp) as first_event,
          MAX(block_timestamp) as last_event
        FROM events
        WHERE LOWER(contract_address) = $1
      `).get(contractAddress) as any;
    }

    // Get holder distribution for this contract
    let distribution;
    if (tokenId) {
      distribution = await db.prepare(`
        SELECT
          CASE
            WHEN ${balanceCast} = 1 THEN '1'
            WHEN ${balanceCast} BETWEEN 2 AND 5 THEN '2-5'
            WHEN ${balanceCast} BETWEEN 6 AND 10 THEN '6-10'
            WHEN ${balanceCast} BETWEEN 11 AND 50 THEN '11-50'
            WHEN ${balanceCast} BETWEEN 51 AND 100 THEN '51-100'
            WHEN ${balanceCast} > 100 THEN '100+'
          END as range,
          COUNT(*) as holders,
          SUM(${balanceCast}) as total_balance
        FROM current_state
        WHERE ${balanceCast} > 0 AND LOWER(contract_address) = $1 AND token_id = $2
        GROUP BY range
        ORDER BY MIN(${balanceCast})
      `).all(contractAddress, tokenId) as any[];
    } else {
      distribution = await db.prepare(`
        SELECT
          CASE
            WHEN ${balanceCast} = 1 THEN '1'
            WHEN ${balanceCast} BETWEEN 2 AND 5 THEN '2-5'
            WHEN ${balanceCast} BETWEEN 6 AND 10 THEN '6-10'
            WHEN ${balanceCast} BETWEEN 11 AND 50 THEN '11-50'
            WHEN ${balanceCast} BETWEEN 51 AND 100 THEN '51-100'
            WHEN ${balanceCast} > 100 THEN '100+'
          END as range,
          COUNT(*) as holders,
          SUM(${balanceCast}) as total_balance
        FROM current_state
        WHERE ${balanceCast} > 0 AND LOWER(contract_address) = $1
        GROUP BY range
        ORDER BY MIN(${balanceCast})
      `).all(contractAddress) as any[];
    }

    // Get top holders for this contract
    let topHolders;
    if (tokenId) {
      topHolders = await db.prepare(`
        SELECT
          address,
          balance,
          1 as token_count
        FROM current_state
        WHERE ${balanceCast} > 0 AND LOWER(contract_address) = $1 AND token_id = $2
        ORDER BY ${balanceCast} DESC
        LIMIT 10
      `).all(contractAddress, tokenId) as any[];
    } else {
      topHolders = await db.prepare(`
        SELECT
          address,
          SUM(${balanceCast}) as balance,
          COUNT(DISTINCT token_id) as token_count
        FROM current_state
        WHERE ${balanceCast} > 0 AND LOWER(contract_address) = $1
        GROUP BY address
        ORDER BY SUM(${balanceCast}) DESC
        LIMIT 10
      `).all(contractAddress) as any[];
    }

    // Get token activity (if not filtering by specific token)
    let tokenActivity = [];
    if (!tokenId) {
      tokenActivity = await db.prepare(`
        SELECT
          token_id,
          COUNT(DISTINCT address) as holders,
          SUM(${balanceCast}) as total_supply,
          MAX(${balanceCast}) as max_holding
        FROM current_state
        WHERE ${balanceCast} > 0 AND LOWER(contract_address) = $1
        GROUP BY token_id
        ORDER BY holders DESC
        LIMIT 10
      `).all(contractAddress) as any[];
    }

    // Get time series data based on timeRange for this contract
    // Calculate the timestamp for filtering
    const now = Math.floor(Date.now() / 1000);
    const timeOffsets = {
      '24h': 24 * 60 * 60,
      '7d': 7 * 24 * 60 * 60,
      '30d': 30 * 24 * 60 * 60,
      '90d': 90 * 24 * 60 * 60,
      'all': now
    };
    const timeOffset = timeOffsets[timeRange as keyof typeof timeOffsets] || timeOffsets['7d'];
    const startTimestamp = timeRange === 'all' ? 0 : now - timeOffset;

    // Date formatting differs between SQLite and PostgreSQL
    const dateFormat = isPostgres
      ? "TO_CHAR(TO_TIMESTAMP(block_timestamp), 'YYYY-MM-DD')"
      : "DATE(block_timestamp, 'unixepoch')";

    let timeSeries;
    if (tokenId) {
      timeSeries = await db.prepare(`
        SELECT
          ${dateFormat} as date,
          COUNT(*) as events,
          COUNT(DISTINCT from_address) as unique_from,
          COUNT(DISTINCT to_address) as unique_to
        FROM events
        WHERE block_timestamp >= $1
          AND LOWER(contract_address) = $2 AND token_id = $3
        GROUP BY ${dateFormat}
        ORDER BY ${dateFormat} DESC
      `).all(startTimestamp, contractAddress, tokenId) as any[];
    } else {
      timeSeries = await db.prepare(`
        SELECT
          ${dateFormat} as date,
          COUNT(*) as events,
          COUNT(DISTINCT from_address) as unique_from,
          COUNT(DISTINCT to_address) as unique_to
        FROM events
        WHERE block_timestamp >= $1
          AND LOWER(contract_address) = $2
        GROUP BY ${dateFormat}
        ORDER BY ${dateFormat} DESC
      `).all(startTimestamp, contractAddress) as any[];
    }

    // Get latest contract analytics if available
    const contractAnalytics = await db.prepare(`
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
      WHERE LOWER(c.address) = $1
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

    if (timeSeries && timeSeries.length > 0) {
      const recent = timeSeries.slice(0, 7);
      growth.newHolders7d = recent.reduce((sum: number, day) => sum + (day.unique_to || 0), 0);
      if (timeSeries.length > 0) {
        growth.newHolders24h = timeSeries[0]?.unique_to || 0;
        growth.activeAddresses24h = (timeSeries[0]?.unique_from || 0) + (timeSeries[0]?.unique_to || 0);
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
          last24hTransfers: (timeSeries && timeSeries.length > 0) ? timeSeries[0]?.events || 0 : 0,
          uniqueSenders: eventStats?.unique_senders || 0,
          uniqueReceivers: eventStats?.unique_receivers || 0,
          firstBlock: eventStats?.first_block,
          lastBlock: eventStats?.last_block
        },
        distribution: distribution || [],
        topHolders: (topHolders || []).map((h: any) => ({
          address: h.address,
          balance: h.balance?.toString() || '0',
          tokenCount: h.token_count || 0,
          percentage: overallStats?.total_supply && overallStats.total_supply !== '0'
            ? ((BigInt(h.balance || '0') * BigInt(10000)) / BigInt(overallStats.total_supply)) / BigInt(100)
            : '0'
        })),
        tokenActivity: tokenActivity || [],
        timeSeries: timeSeries || [],
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
