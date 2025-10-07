import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId');
    const isPublic = searchParams.get('public') !== 'false'; // Default to public only

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

    // Get contract info first
    const contractInfo = db.prepare(`
      SELECT id, name, symbol, contract_type 
      FROM contracts 
      WHERE LOWER(address) = ? AND is_active = 1
    `).get(contractAddress) as any;

    if (!contractInfo) {
      return NextResponse.json(
        { success: false, error: 'Contract not found or not active' },
        { status: 404 }
      );
    }

    // Build query for user snapshots
    let query = `
      SELECT 
        us.id,
        us.snapshot_name,
        us.description,
        us.snapshot_type,
        us.block_number,
        us.total_holders,
        us.total_supply,
        us.unique_tokens,
        us.total_transfers,
        us.gini_coefficient,
        us.is_public,
        us.is_featured,
        us.view_count,
        us.created_at,
        up.username,
        up.display_name,
        up.wallet_address as creator_address
      FROM user_snapshots us
      JOIN user_profiles up ON us.user_id = up.id
      WHERE us.contract_id = ?
    `;

    const queryParams = [contractInfo.id];

    // Filter by public/private if not requesting specific user
    if (!userId && isPublic) {
      query += ' AND us.is_public = 1';
    }

    // Filter by specific user if provided
    if (userId) {
      query += ' AND us.user_id = ?';
      queryParams.push(userId);
    }

    // Add ordering and pagination
    query += ` 
      ORDER BY us.created_at DESC 
      LIMIT ? OFFSET ?
    `;
    queryParams.push(limit, offset);

    const snapshots = db.prepare(query).all(...queryParams) as any[];

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as count 
      FROM user_snapshots us
      WHERE us.contract_id = ?
    `;
    const countParams = [contractInfo.id];

    if (!userId && isPublic) {
      countQuery += ' AND us.is_public = 1';
    }

    if (userId) {
      countQuery += ' AND us.user_id = ?';
      countParams.push(userId);
    }

    const totalCount = (db.prepare(countQuery).get(...countParams) as any).count;

    // Format snapshots for response
    const formattedSnapshots = snapshots.map((snapshot: any) => ({
      id: snapshot.id,
      name: snapshot.snapshot_name || `${snapshot.snapshot_type === 'current' ? 'Current' : 'Historical'} Snapshot`,
      description: snapshot.description,
      type: snapshot.snapshot_type,
      blockNumber: snapshot.block_number,
      totalHolders: snapshot.total_holders,
      totalSupply: snapshot.total_supply,
      uniqueTokens: snapshot.unique_tokens,
      totalTransfers: snapshot.total_transfers,
      giniCoefficient: snapshot.gini_coefficient,
      isPublic: !!snapshot.is_public,
      isFeatured: !!snapshot.is_featured,
      viewCount: snapshot.view_count,
      createdAt: snapshot.created_at,
      creator: {
        username: snapshot.username,
        displayName: snapshot.display_name,
        walletAddress: snapshot.creator_address
      },
      downloadUrl: `/api/contracts/${contractAddress}/snapshots/${snapshot.id}/download`
    }));

    // Get contract statistics
    const contractStats = db.prepare(`
      SELECT 
        COUNT(*) as total_snapshots,
        COUNT(CASE WHEN us.is_public = 1 THEN 1 END) as public_snapshots,
        COUNT(DISTINCT us.user_id) as unique_creators,
        COUNT(CASE WHEN us.snapshot_type = 'current' THEN 1 END) as current_snapshots,
        COUNT(CASE WHEN us.snapshot_type = 'historical' THEN 1 END) as historical_snapshots,
        AVG(us.total_holders) as avg_holders,
        MAX(us.created_at) as last_snapshot_date
      FROM user_snapshots us
      WHERE us.contract_id = ?
    `).get(contractInfo.id) as any;

    return NextResponse.json({
      success: true,
      snapshots: formattedSnapshots,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit)
      },
      contract: {
        address: contractAddress,
        name: contractInfo.name,
        symbol: contractInfo.symbol,
        contractType: contractInfo.contract_type
      },
      stats: {
        totalSnapshots: contractStats?.total_snapshots || 0,
        publicSnapshots: contractStats?.public_snapshots || 0,
        uniqueCreators: contractStats?.unique_creators || 0,
        currentSnapshots: contractStats?.current_snapshots || 0,
        historicalSnapshots: contractStats?.historical_snapshots || 0,
        avgHolders: contractStats?.avg_holders || 0,
        lastSnapshotDate: contractStats?.last_snapshot_date
      }
    });
  } catch (error: any) {
    console.error('Contract snapshots API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch contract snapshots'
      },
      { status: 500 }
    );
  }
}