import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timeRange = searchParams.get('timeRange') || '7d';

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();

    // Calculate time condition for queries
    const timeConditions = {
      '24h': "datetime('now', '-1 day')",
      '7d': "datetime('now', '-7 days')",
      '30d': "datetime('now', '-30 days')",
      'all': '0'
    };
    const timeCondition = timeConditions[timeRange as keyof typeof timeConditions] || timeConditions['7d'];

    // 1. PLATFORM OVERVIEW - Contract statistics
    const contractStats = db.prepare(`
      SELECT
        COUNT(*) as total_contracts,
        COUNT(CASE WHEN contract_type = 'ERC721' THEN 1 END) as erc721_count,
        COUNT(CASE WHEN contract_type = 'ERC1155' THEN 1 END) as erc1155_count,
        COUNT(CASE WHEN is_verified = 1 THEN 1 END) as verified_count,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_count
      FROM contracts
      WHERE is_active = 1
    `).get() as any;

    // 2. Total unique holders across all contracts
    const holderStats = db.prepare(`
      SELECT
        COUNT(DISTINCT address) as total_unique_holders,
        COUNT(DISTINCT token_id) as total_unique_tokens,
        SUM(CAST(balance AS INTEGER)) as total_supply
      FROM current_state
      WHERE balance > 0
    `).get() as any;

    // 3. Total transfers
    const transferStats = db.prepare(`
      SELECT
        COUNT(*) as total_transfers,
        COUNT(CASE WHEN block_timestamp >= strftime('%s', datetime('now', '-1 day')) THEN 1 END) as transfers_24h,
        COUNT(CASE WHEN block_timestamp >= strftime('%s', datetime('now', '-7 days')) THEN 1 END) as transfers_7d,
        COUNT(CASE WHEN block_timestamp >= strftime('%s', datetime('now', '-30 days')) THEN 1 END) as transfers_30d
      FROM events
    `).get() as any;

    // 4. Active contracts (had transfers in last 24h)
    const activeContracts = db.prepare(`
      SELECT COUNT(DISTINCT contract_address) as active_24h
      FROM events
      WHERE block_timestamp >= strftime('%s', datetime('now', '-1 day'))
    `).get() as any;

    // 5. ERC721 SPECIFIC METRICS
    const erc721Stats = db.prepare(`
      SELECT
        COUNT(DISTINCT cs.address) as unique_holders,
        COUNT(DISTINCT cs.token_id) as unique_tokens,
        SUM(CAST(cs.balance AS INTEGER)) as total_supply,
        COUNT(DISTINCT cs.contract_address) as contract_count
      FROM current_state cs
      JOIN contracts c ON cs.contract_address = c.address
      WHERE cs.balance > 0 AND c.contract_type = 'ERC721' AND c.is_active = 1
    `).get() as any;

    const erc721Transfers = db.prepare(`
      SELECT COUNT(*) as total_transfers
      FROM events e
      JOIN contracts c ON e.contract_address = c.address
      WHERE c.contract_type = 'ERC721'
    `).get() as any;

    // Top 5 ERC721 contracts by holders
    const topErc721 = db.prepare(`
      SELECT
        c.address,
        c.name,
        c.symbol,
        c.contract_type,
        c.total_supply,
        COUNT(DISTINCT cs.address) as holder_count,
        (
          SELECT COUNT(*)
          FROM events e
          WHERE e.contract_address = c.address
          AND e.block_timestamp >= strftime('%s', ${timeCondition})
        ) as recent_transfers
      FROM contracts c
      JOIN current_state cs ON c.address = cs.contract_address
      WHERE c.contract_type = 'ERC721' AND c.is_active = 1 AND cs.balance > 0
      GROUP BY c.address
      ORDER BY holder_count DESC
      LIMIT 5
    `).all() as any[];

    // 6. ERC1155 SPECIFIC METRICS
    const erc1155Stats = db.prepare(`
      SELECT
        COUNT(DISTINCT cs.address) as unique_holders,
        COUNT(DISTINCT cs.token_id) as unique_tokens,
        SUM(CAST(cs.balance AS INTEGER)) as total_supply,
        COUNT(DISTINCT cs.contract_address) as contract_count
      FROM current_state cs
      JOIN contracts c ON cs.contract_address = c.address
      WHERE cs.balance > 0 AND c.contract_type = 'ERC1155' AND c.is_active = 1
    `).get() as any;

    const erc1155Transfers = db.prepare(`
      SELECT COUNT(*) as total_transfers
      FROM events e
      JOIN contracts c ON e.contract_address = c.address
      WHERE c.contract_type = 'ERC1155'
    `).get() as any;

    // Top 5 ERC1155 contracts by holders
    const topErc1155 = db.prepare(`
      SELECT
        c.address,
        c.name,
        c.symbol,
        c.contract_type,
        c.total_supply,
        COUNT(DISTINCT cs.address) as holder_count,
        (
          SELECT COUNT(*)
          FROM events e
          WHERE e.contract_address = c.address
          AND e.block_timestamp >= strftime('%s', ${timeCondition})
        ) as recent_transfers
      FROM contracts c
      JOIN current_state cs ON c.address = cs.contract_address
      WHERE c.contract_type = 'ERC1155' AND c.is_active = 1 AND cs.balance > 0
      GROUP BY c.address
      ORDER BY holder_count DESC
      LIMIT 5
    `).all() as any[];

    // 7. TIME SERIES DATA - Daily activity breakdown
    const timeSeries = db.prepare(`
      SELECT
        DATE(e.block_timestamp, 'unixepoch') as date,
        c.contract_type,
        COUNT(*) as transfers,
        COUNT(DISTINCT e.from_address) as unique_from,
        COUNT(DISTINCT e.to_address) as unique_to
      FROM events e
      JOIN contracts c ON e.contract_address = c.address
      WHERE e.block_timestamp >= strftime('%s', ${timeCondition})
      GROUP BY date, c.contract_type
      ORDER BY date DESC
    `).all() as any[];

    // Process time series into format for frontend
    const timeSeriesMap = new Map<string, any>();
    timeSeries.forEach((row) => {
      const date = row.date;
      if (!timeSeriesMap.has(date)) {
        timeSeriesMap.set(date, {
          date,
          erc721Transfers: 0,
          erc1155Transfers: 0,
          totalTransfers: 0,
          uniqueTraders: 0
        });
      }
      const entry = timeSeriesMap.get(date);
      if (row.contract_type === 'ERC721') {
        entry.erc721Transfers = row.transfers;
      } else if (row.contract_type === 'ERC1155') {
        entry.erc1155Transfers = row.transfers;
      }
      entry.totalTransfers += row.transfers;
      entry.uniqueTraders += row.unique_from + row.unique_to;
    });

    const processedTimeSeries = Array.from(timeSeriesMap.values());

    // 8. CONTRACT DISTRIBUTION
    const contractDistribution = [
      {
        type: 'ERC-721',
        count: contractStats.erc721_count,
        percentage: contractStats.total_contracts > 0
          ? Math.round((contractStats.erc721_count / contractStats.total_contracts) * 100)
          : 0
      },
      {
        type: 'ERC-1155',
        count: contractStats.erc1155_count,
        percentage: contractStats.total_contracts > 0
          ? Math.round((contractStats.erc1155_count / contractStats.total_contracts) * 100)
          : 0
      }
    ];

    // 9. HOLDER SIZE DISTRIBUTION
    const holderDistribution = db.prepare(`
      SELECT
        CASE
          WHEN holder_count BETWEEN 1 AND 10 THEN '1-10 holders'
          WHEN holder_count BETWEEN 11 AND 100 THEN '11-100 holders'
          WHEN holder_count BETWEEN 101 AND 1000 THEN '101-1K holders'
          WHEN holder_count BETWEEN 1001 AND 10000 THEN '1K-10K holders'
          ELSE '10K+ holders'
        END as range,
        COUNT(*) as contract_count
      FROM (
        SELECT
          c.address,
          COUNT(DISTINCT cs.address) as holder_count
        FROM contracts c
        JOIN current_state cs ON c.address = cs.contract_address
        WHERE c.is_active = 1 AND cs.balance > 0
        GROUP BY c.address
      ) subquery
      GROUP BY range
      ORDER BY MIN(holder_count)
    `).all() as any[];

    // 10. TOP PERFORMERS
    // By holders
    const topByHolders = db.prepare(`
      SELECT
        c.address,
        c.name,
        c.symbol,
        c.contract_type,
        c.total_supply,
        COUNT(DISTINCT cs.address) as holder_count,
        (
          SELECT COUNT(*)
          FROM events e
          WHERE e.contract_address = c.address
          AND e.block_timestamp >= strftime('%s', ${timeCondition})
        ) as recent_transfers
      FROM contracts c
      JOIN current_state cs ON c.address = cs.contract_address
      WHERE c.is_active = 1 AND cs.balance > 0
      GROUP BY c.address
      ORDER BY holder_count DESC
      LIMIT 10
    `).all() as any[];

    // By activity (most transfers)
    const topByActivity = db.prepare(`
      SELECT
        c.address,
        c.name,
        c.symbol,
        c.contract_type,
        c.total_supply,
        COUNT(e.id) as transfer_count,
        COUNT(DISTINCT cs.address) as holder_count
      FROM contracts c
      JOIN events e ON c.address = e.contract_address
      LEFT JOIN current_state cs ON c.address = cs.contract_address AND cs.balance > 0
      WHERE c.is_active = 1 AND e.block_timestamp >= strftime('%s', ${timeCondition})
      GROUP BY c.address
      ORDER BY transfer_count DESC
      LIMIT 10
    `).all() as any[];

    // By growth (holder growth in time period)
    // Calculate growth by comparing current holders vs holders at start of period
    const topByGrowth = db.prepare(`
      SELECT
        c.address,
        c.name,
        c.symbol,
        c.contract_type,
        c.total_supply,
        COUNT(DISTINCT cs.address) as current_holders,
        (
          SELECT COUNT(DISTINCT to_address)
          FROM events e
          WHERE e.contract_address = c.address
          AND e.block_timestamp >= strftime('%s', ${timeCondition})
        ) as new_holders
      FROM contracts c
      LEFT JOIN current_state cs ON c.address = cs.contract_address AND cs.balance > 0
      WHERE c.is_active = 1
      GROUP BY c.address
      HAVING new_holders > 0
      ORDER BY new_holders DESC
      LIMIT 10
    `).all() as any[];

    // Assemble final response
    return NextResponse.json({
      success: true,
      data: {
        overview: {
          totalContracts: contractStats.total_contracts || 0,
          erc721Count: contractStats.erc721_count || 0,
          erc1155Count: contractStats.erc1155_count || 0,
          verifiedCount: contractStats.verified_count || 0,
          totalHolders: holderStats.total_unique_holders || 0,
          totalTransfers: transferStats.total_transfers || 0,
          transfers24h: transferStats.transfers_24h || 0,
          transfers7d: transferStats.transfers_7d || 0,
          transfers30d: transferStats.transfers_30d || 0,
          activeContracts24h: activeContracts.active_24h || 0
        },
        erc721: {
          contracts: erc721Stats.contract_count || 0,
          holders: erc721Stats.unique_holders || 0,
          tokens: erc721Stats.unique_tokens || 0,
          transfers: erc721Transfers.total_transfers || 0,
          topContracts: topErc721.map(c => ({
            address: c.address,
            name: c.name || 'Unknown',
            symbol: c.symbol || 'N/A',
            contractType: c.contract_type,
            holders: c.holder_count,
            transfers: c.recent_transfers,
            totalSupply: c.total_supply || '0'
          }))
        },
        erc1155: {
          contracts: erc1155Stats.contract_count || 0,
          holders: erc1155Stats.unique_holders || 0,
          tokens: erc1155Stats.unique_tokens || 0,
          transfers: erc1155Transfers.total_transfers || 0,
          topContracts: topErc1155.map(c => ({
            address: c.address,
            name: c.name || 'Unknown',
            symbol: c.symbol || 'N/A',
            contractType: c.contract_type,
            holders: c.holder_count,
            transfers: c.recent_transfers,
            totalSupply: c.total_supply || '0'
          }))
        },
        timeSeries: processedTimeSeries,
        distribution: {
          contractTypes: contractDistribution,
          holderSizes: holderDistribution.map(d => ({
            range: d.range,
            count: d.contract_count
          }))
        },
        topPerformers: {
          byHolders: topByHolders.map(c => ({
            address: c.address,
            name: c.name || 'Unknown',
            symbol: c.symbol || 'N/A',
            contractType: c.contract_type,
            holders: c.holder_count,
            transfers: c.recent_transfers,
            totalSupply: c.total_supply || '0'
          })),
          byActivity: topByActivity.map(c => ({
            address: c.address,
            name: c.name || 'Unknown',
            symbol: c.symbol || 'N/A',
            contractType: c.contract_type,
            holders: c.holder_count || 0,
            transfers: c.transfer_count,
            totalSupply: c.total_supply || '0'
          })),
          byGrowth: topByGrowth.map(c => ({
            address: c.address,
            name: c.name || 'Unknown',
            symbol: c.symbol || 'N/A',
            contractType: c.contract_type,
            holders: c.current_holders,
            transfers: 0,
            totalSupply: c.total_supply || '0',
            growth: c.new_holders
          }))
        },
        metadata: {
          timeRange,
          generatedAt: new Date().toISOString()
        }
      }
    });
  } catch (error: any) {
    console.error('Platform analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate platform analytics'
      },
      { status: 500 }
    );
  }
}
