import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'holders';

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();

    // Get unique tokens with holder counts and total supply
    let query = `
      SELECT 
        token_id,
        COUNT(DISTINCT address) as holder_count,
        SUM(CAST(balance AS INTEGER)) as total_supply,
        MAX(CAST(balance AS INTEGER)) as max_balance,
        MIN(CAST(balance AS INTEGER)) as min_balance
      FROM current_state 
      WHERE balance > 0
      GROUP BY token_id
    `;

    // Add sorting
    if (sortBy === 'holders') {
      query += ' ORDER BY holder_count DESC';
    } else if (sortBy === 'supply') {
      query += ' ORDER BY total_supply DESC';
    } else if (sortBy === 'tokenId') {
      query += ' ORDER BY token_id ASC';
    }

    query += ` LIMIT ? OFFSET ?`;

    const stmt = db.prepare(query);
    const tokens = stmt.all(limit, offset) as any[];

    // Get top holders for each token
    const tokensWithHolders = await Promise.all(
      tokens.map(async (token) => {
        const topHoldersStmt = db.prepare(`
          SELECT address, balance
          FROM current_state
          WHERE token_id = ? AND balance > 0
          ORDER BY CAST(balance AS INTEGER) DESC
          LIMIT 5
        `);
        const topHolders = topHoldersStmt.all(token.token_id) as any[];

        // Get recent activity
        const activityStmt = db.prepare(`
          SELECT event_type, from_address, to_address, block_number, block_timestamp
          FROM events
          WHERE token_id = ?
          ORDER BY block_number DESC
          LIMIT 5
        `);
        const recentActivity = activityStmt.all(token.token_id) as any[];

        // Get metadata for this token
        const metadataStmt = db.prepare(`
          SELECT name, description, image_url, attributes
          FROM nft_metadata
          WHERE token_id = ?
        `);
        const metadata = metadataStmt.get(token.token_id) as any;

        return {
          tokenId: token.token_id,
          name: metadata?.name || `Token #${token.token_id.substring(0, 8)}`,
          description: metadata?.description,
          imageUrl: metadata?.image_url,
          attributes: metadata?.attributes ? JSON.parse(metadata.attributes) : [],
          holderCount: token.holder_count,
          totalSupply: token.total_supply?.toString() || '0',
          maxBalance: token.max_balance?.toString() || '0',
          minBalance: token.min_balance?.toString() || '0',
          topHolders: topHolders.map(h => ({
            address: h.address,
            balance: h.balance,
            percentage: token.total_supply > 0 
              ? ((parseInt(h.balance) * 100) / token.total_supply).toFixed(2)
              : '0'
          })),
          recentActivity: recentActivity.map(a => ({
            type: a.event_type,
            from: a.from_address,
            to: a.to_address,
            blockNumber: a.block_number,
            timestamp: a.block_timestamp
          }))
        };
      })
    );

    // Get total count
    const totalCount = (db.prepare(
      'SELECT COUNT(DISTINCT token_id) as count FROM current_state WHERE balance > 0'
    ).get() as any).count;

    return NextResponse.json({
      success: true,
      data: {
        tokens: tokensWithHolders,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        },
        stats: {
          totalTokens: totalCount,
          totalHolders: (db.prepare(
            'SELECT COUNT(DISTINCT address) as count FROM current_state WHERE balance > 0'
          ).get() as any).count,
          totalSupply: (db.prepare(
            'SELECT SUM(CAST(balance AS INTEGER)) as sum FROM current_state WHERE balance > 0'
          ).get() as any).sum || 0
        }
      }
    });
  } catch (error: any) {
    console.error('Tokens API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch tokens'
      },
      { status: 500 }
    );
  }
}