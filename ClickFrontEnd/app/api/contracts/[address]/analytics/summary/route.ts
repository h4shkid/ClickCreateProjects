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
    const timeRange = searchParams.get('timeRange') || 'all';

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
      WHERE LOWER(address) = ?
    `).get(contractAddress) as any;

    if (!contractInfo) {
      return NextResponse.json(
        { success: false, error: 'Contract not found or not active' },
        { status: 404 }
      );
    }

    // Use proper casting for balance - PostgreSQL needs ::numeric, SQLite can use CAST
    const balanceCast = isPostgres ? 'balance::numeric' : 'CAST(balance AS INTEGER)';

    // Get overall statistics for this contract
    let overallStats;
    try {
      if (tokenId) {
        overallStats = await db.prepare(`
          SELECT
            COUNT(DISTINCT address) as unique_holders,
            COUNT(DISTINCT token_id) as unique_tokens,
            COALESCE(SUM(${balanceCast}), 0) as total_supply,
            COALESCE(AVG(${balanceCast}), 0) as avg_balance,
            COALESCE(MAX(${balanceCast}), 0) as max_balance,
            MIN(CASE WHEN ${balanceCast} > 0 THEN ${balanceCast} END) as min_balance
          FROM current_state
          WHERE ${balanceCast} > 0 AND LOWER(contract_address) = ? AND token_id = ?
        `).get(contractAddress, tokenId) as any;
      } else {
        overallStats = await db.prepare(`
          SELECT
            COUNT(DISTINCT address) as unique_holders,
            COUNT(DISTINCT token_id) as unique_tokens,
            COALESCE(SUM(${balanceCast}), 0) as total_supply,
            COALESCE(AVG(${balanceCast}), 0) as avg_balance,
            COALESCE(MAX(${balanceCast}), 0) as max_balance,
            MIN(CASE WHEN ${balanceCast} > 0 THEN ${balanceCast} END) as min_balance
          FROM current_state
          WHERE ${balanceCast} > 0 AND LOWER(contract_address) = ?
        `).get(contractAddress) as any;
      }
    } catch (err) {
      console.error('Error fetching overall stats:', err);
      overallStats = {
        unique_holders: 0,
        unique_tokens: 0,
        total_supply: 0,
        avg_balance: 0,
        max_balance: 0,
        min_balance: 0
      };
    }

    // Get event statistics for this contract
    let eventStats;
    try {
      if (tokenId) {
        eventStats = await db.prepare(`
          SELECT
            COUNT(*) as total_events,
            COUNT(DISTINCT from_address) as unique_senders,
            COUNT(DISTINCT to_address) as unique_receivers,
            MIN(block_number) as first_block,
            MAX(block_number) as last_block,
            MIN(CASE WHEN block_timestamp > 0 THEN block_timestamp END) as first_event,
            MAX(CASE WHEN block_timestamp > 0 THEN block_timestamp END) as last_event
          FROM events
          WHERE LOWER(contract_address) = ? AND token_id = ?
        `).get(contractAddress, tokenId) as any;
      } else {
        eventStats = await db.prepare(`
          SELECT
            COUNT(*) as total_events,
            COUNT(DISTINCT from_address) as unique_senders,
            COUNT(DISTINCT to_address) as unique_receivers,
            MIN(block_number) as first_block,
            MAX(block_number) as last_block,
            MIN(CASE WHEN block_timestamp > 0 THEN block_timestamp END) as first_event,
            MAX(CASE WHEN block_timestamp > 0 THEN block_timestamp END) as last_event
          FROM events
          WHERE LOWER(contract_address) = ?
        `).get(contractAddress) as any;
      }
    } catch (err) {
      console.error('Error fetching event stats:', err);
      eventStats = {
        total_events: 0,
        unique_senders: 0,
        unique_receivers: 0,
        first_block: null,
        last_block: null,
        first_event: null,
        last_event: null
      };
    }

    // Get holder distribution for this contract
    // For ERC-721: Group addresses by how many NFTs they own
    // For ERC-1155: Group addresses by their balance of a specific token
    let distribution = [];
    try {
      if (tokenId) {
        // For specific token, show distribution of balances
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
            COALESCE(SUM(${balanceCast}), 0) as total_balance
          FROM current_state
          WHERE ${balanceCast} > 0 AND LOWER(contract_address) = ? AND token_id = ?
          GROUP BY range
          ORDER BY MIN(${balanceCast})
        `).all(contractAddress, tokenId) as any[];
      } else {
        // For collection-wide: First count NFTs per address, then group by count ranges
        distribution = await db.prepare(`
          WITH holder_counts AS (
            SELECT
              address,
              COUNT(*) as nft_count
            FROM current_state
            WHERE ${balanceCast} > 0 AND LOWER(contract_address) = ?
            GROUP BY address
          )
          SELECT
            CASE
              WHEN nft_count = 1 THEN '1'
              WHEN nft_count BETWEEN 2 AND 5 THEN '2-5'
              WHEN nft_count BETWEEN 6 AND 10 THEN '6-10'
              WHEN nft_count BETWEEN 11 AND 50 THEN '11-50'
              WHEN nft_count BETWEEN 51 AND 100 THEN '51-100'
              WHEN nft_count > 100 THEN '100+'
            END as range,
            COUNT(*) as holders,
            COALESCE(SUM(nft_count), 0) as total_balance
          FROM holder_counts
          GROUP BY range
          ORDER BY MIN(nft_count)
        `).all(contractAddress) as any[];
      }
    } catch (err) {
      console.error('Error fetching distribution:', err);
      distribution = [];
    }

    // Get top holders for this contract
    let topHolders = [];
    try {
      if (tokenId) {
        topHolders = await db.prepare(`
          SELECT
            address,
            balance,
            1 as token_count
          FROM current_state
          WHERE ${balanceCast} > 0 AND LOWER(contract_address) = ? AND token_id = ?
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
          WHERE ${balanceCast} > 0 AND LOWER(contract_address) = ?
          GROUP BY address
          ORDER BY SUM(${balanceCast}) DESC
          LIMIT 10
        `).all(contractAddress) as any[];
      }
    } catch (err) {
      console.error('Error fetching top holders:', err);
      topHolders = [];
    }

    // Get token activity (if not filtering by specific token)
    let tokenActivity = [];
    if (!tokenId) {
      try {
        tokenActivity = await db.prepare(`
          SELECT
            token_id,
            COUNT(DISTINCT address) as holders,
            COALESCE(SUM(${balanceCast}), 0) as total_supply,
            COALESCE(MAX(${balanceCast}), 0) as max_holding
          FROM current_state
          WHERE ${balanceCast} > 0 AND LOWER(contract_address) = ?
          GROUP BY token_id
          ORDER BY holders DESC
          LIMIT 10
        `).all(contractAddress) as any[];
      } catch (err) {
        console.error('Error fetching token activity:', err);
        tokenActivity = [];
      }
    }

    // Get time series data - using block_number ranges instead of timestamps
    // Most events have block_timestamp = 0, so we'll show all-time data grouped by block ranges
    let timeSeries = [];
    try {
      // For now, show all-time data since timestamps are unreliable (99.9% have timestamp=0)
      // Group by block number ranges to show activity over time
      const blockRange = 100000; // ~15 days worth of blocks on Ethereum

      if (tokenId) {
        timeSeries = await db.prepare(`
          SELECT
            (block_number / ${blockRange}) * ${blockRange} as block_range,
            COUNT(*) as events,
            COUNT(DISTINCT from_address) as unique_from,
            COUNT(DISTINCT to_address) as unique_to,
            MIN(block_number) as min_block,
            MAX(block_number) as max_block
          FROM events
          WHERE LOWER(contract_address) = ? AND token_id = ?
          GROUP BY block_number / ${blockRange}
          ORDER BY block_range DESC
          LIMIT 30
        `).all(contractAddress, tokenId) as any[];
      } else {
        timeSeries = await db.prepare(`
          SELECT
            (block_number / ${blockRange}) * ${blockRange} as block_range,
            COUNT(*) as events,
            COUNT(DISTINCT from_address) as unique_from,
            COUNT(DISTINCT to_address) as unique_to,
            MIN(block_number) as min_block,
            MAX(block_number) as max_block
          FROM events
          WHERE LOWER(contract_address) = ?
          GROUP BY block_number / ${blockRange}
          ORDER BY block_range DESC
          LIMIT 30
        `).all(contractAddress) as any[];
      }
    } catch (err) {
      console.error('Error fetching time series:', err);
      timeSeries = [];
    }

    // Get latest contract analytics if available
    let contractAnalytics = null;
    try {
      contractAnalytics = await db.prepare(`
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
    } catch (err) {
      console.error('Error fetching contract analytics:', err);
      contractAnalytics = null;
    }

    // Calculate growth metrics based on block ranges
    const growth = {
      newHolders24h: 0,
      newHolders7d: 0,
      volumeChange24h: 0,
      activeAddresses24h: 0
    };

    if (timeSeries && timeSeries.length > 0) {
      // Use first block range for "recent" activity
      const recent = timeSeries.slice(0, 7);
      growth.newHolders7d = recent.reduce((sum: number, range: any) => sum + (range.unique_to || 0), 0);
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
          name: contractInfo.name || 'Unknown',
          symbol: contractInfo.symbol || 'N/A',
          contractType: contractInfo.contract_type || 'Unknown',
          isVerified: !!contractInfo.is_verified
        },
        overview: {
          totalHolders: overallStats?.unique_holders || 0,
          uniqueTokens: overallStats?.unique_tokens || 0,
          totalSupply: (overallStats?.total_supply || 0).toString(),
          avgHoldingPerUser: parseFloat(overallStats?.avg_balance || 0).toFixed(2)
        },
        events: {
          totalTransfers: eventStats?.total_events || 0,
          last24hTransfers: (timeSeries && timeSeries.length > 0) ? timeSeries[0]?.events || 0 : 0,
          uniqueSenders: eventStats?.unique_senders || 0,
          uniqueReceivers: eventStats?.unique_receivers || 0,
          firstBlock: eventStats?.first_block || null,
          lastBlock: eventStats?.last_block || null
        },
        distribution: (distribution || []).map((d: any) => ({
          range: d.range,
          holders: parseInt(d.holders) || 0,
          total_balance: parseInt(d.total_balance) || 0
        })),
        topHolders: (topHolders || []).map((h: any) => {
          const balance = h.balance || '0';
          const totalSupply = overallStats?.total_supply || 0;
          let percentage = '0';

          try {
            if (totalSupply && totalSupply > 0) {
              percentage = ((BigInt(balance) * BigInt(10000)) / BigInt(totalSupply.toString())).toString();
              percentage = (parseFloat(percentage) / 100).toFixed(2);
            }
          } catch (err) {
            console.error('Error calculating percentage:', err);
            percentage = '0';
          }

          return {
            address: h.address,
            balance: balance.toString(),
            tokenCount: h.token_count || 0,
            percentage
          };
        }),
        tokenActivity: tokenActivity || [],
        timeSeries: (timeSeries || []).map((range: any) => ({
          // Convert block range to approximate date for display
          blockRange: range.block_range || 0,
          minBlock: range.min_block || 0,
          maxBlock: range.max_block || 0,
          events: range.events || 0,
          uniqueFrom: range.unique_from || 0,
          uniqueTo: range.unique_to || 0
        })),
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
          timeRange: 'all', // Force to 'all' since timestamps are unreliable
          generatedAt: new Date().toISOString(),
          note: 'Time-based filtering disabled due to missing timestamps in event data'
        }
      }
    });
  } catch (error: any) {
    console.error('Contract analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate contract analytics',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
