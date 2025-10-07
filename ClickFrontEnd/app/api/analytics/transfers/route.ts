import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const tokenId = searchParams.get('tokenId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const direction = searchParams.get('direction'); // 'in', 'out', or null for both

    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: 'Address parameter is required'
        },
        { status: 400 }
      );
    }

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();

    // Build query based on direction
    let conditions = [];
    if (direction === 'in') {
      conditions.push('to_address = ?');
    } else if (direction === 'out') {
      conditions.push('from_address = ?');
    } else {
      conditions.push('(from_address = ? OR to_address = ?)');
    }

    if (tokenId) {
      conditions.push('token_id = ?');
    }

    const query = `
      SELECT 
        transaction_hash,
        block_number,
        block_timestamp,
        from_address,
        to_address,
        token_id,
        amount,
        operator,
        log_index,
        CASE 
          WHEN from_address = ? THEN 'out'
          WHEN to_address = ? THEN 'in'
        END as direction
      FROM events
      WHERE ${conditions.join(' AND ')}
      ORDER BY block_number DESC, log_index DESC
      LIMIT ? OFFSET ?
    `;

    // Prepare parameters based on conditions
    const params = [address, address]; // For the CASE statement
    if (direction === 'in' || direction === 'out') {
      params.push(address);
    } else {
      params.push(address, address);
    }
    if (tokenId) {
      params.push(tokenId);
    }
    params.push(limit.toString(), offset.toString());

    const transfers = db.prepare(query).all(...params) as any[];

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as count
      FROM events
      WHERE ${conditions.join(' AND ')}
    `;
    
    const countParams = [];
    if (direction === 'in' || direction === 'out') {
      countParams.push(address);
    } else {
      countParams.push(address, address);
    }
    if (tokenId) {
      countParams.push(tokenId);
    }
    
    const totalCount = (db.prepare(countQuery).get(...countParams) as any).count;

    // Get summary statistics
    const statsQuery = `
      SELECT 
        COUNT(CASE WHEN to_address = ? THEN 1 END) as total_received,
        COUNT(CASE WHEN from_address = ? THEN 1 END) as total_sent,
        COUNT(DISTINCT token_id) as unique_tokens,
        COUNT(DISTINCT CASE WHEN from_address = ? THEN to_address END) as unique_recipients,
        COUNT(DISTINCT CASE WHEN to_address = ? THEN from_address END) as unique_senders
      FROM events
      WHERE from_address = ? OR to_address = ?
      ${tokenId ? 'AND token_id = ?' : ''}
    `;

    const statsParams = [address, address, address, address, address, address];
    if (tokenId) statsParams.push(tokenId);
    
    const stats = db.prepare(statsQuery).get(...statsParams) as any;

    // Format transfers
    const formattedTransfers = transfers.map((t: any) => ({
      transactionHash: t.transaction_hash,
      blockNumber: t.block_number,
      timestamp: t.block_timestamp,
      direction: t.direction,
      from: t.from_address,
      to: t.to_address,
      tokenId: t.token_id,
      amount: t.amount,
      operator: t.operator,
      logIndex: t.log_index
    }));

    return NextResponse.json({
      success: true,
      data: {
        transfers: formattedTransfers,
        statistics: {
          totalReceived: stats.total_received,
          totalSent: stats.total_sent,
          uniqueTokens: stats.unique_tokens,
          uniqueRecipients: stats.unique_recipients,
          uniqueSenders: stats.unique_senders,
          netTransfers: stats.total_received - stats.total_sent
        },
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        },
        filters: {
          address,
          tokenId,
          direction
        }
      }
    });
  } catch (error: any) {
    console.error('Transfer history error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch transfer history'
      },
      { status: 500 }
    );
  }
}