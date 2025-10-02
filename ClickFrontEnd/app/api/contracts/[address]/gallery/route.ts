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
    const onlyWithImages = searchParams.get('onlyWithImages') === 'true';
    const sortBy = searchParams.get('sortBy') || 'recent';
    const search = searchParams.get('search');

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

    // Verify contract exists
    const contractExists = db.prepare(`
      SELECT id FROM contracts 
      WHERE LOWER(address) = ? AND is_active = 1
    `).get(contractAddress);

    if (!contractExists) {
      return NextResponse.json(
        { success: false, error: 'Contract not found or not active' },
        { status: 404 }
      );
    }

    // Build query based on filters
    let query = `
      SELECT 
        nm.*,
        cs.balance,
        cs.address as holder_address
      FROM nft_metadata nm
      LEFT JOIN (
        SELECT token_id, address, balance, contract_address
        FROM current_state
        WHERE balance > 0 AND LOWER(contract_address) = ?
      ) cs ON nm.token_id = cs.token_id AND LOWER(nm.contract_address) = LOWER(cs.contract_address)
      WHERE LOWER(nm.contract_address) = ?
    `;

    const queryParams: any[] = [contractAddress, contractAddress];
    const conditions = [];

    if (onlyWithImages) {
      conditions.push('nm.image_url IS NOT NULL');
    }

    if (search) {
      conditions.push('(nm.name LIKE ? OR nm.token_id LIKE ?)');
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      query += ' AND ' + conditions.join(' AND ');
    }

    // Add sorting
    if (sortBy === 'recent') {
      query += ' ORDER BY nm.updated_at DESC';
    } else if (sortBy === 'balance') {
      query += ' ORDER BY cs.balance DESC NULLS LAST';
    } else if (sortBy === 'name') {
      query += ' ORDER BY nm.name ASC NULLS LAST';
    } else if (sortBy === 'tokenId') {
      query += ' ORDER BY CAST(nm.token_id AS INTEGER) ASC';
    }

    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const stmt = db.prepare(query);
    const rows = stmt.all(...queryParams) as any[];

    // Process results for gallery
    const tokens = rows.map((row) => {
      const metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
      
      // Parse attributes if they exist
      let attributes = [];
      if (row.attributes) {
        try {
          attributes = JSON.parse(row.attributes);
        } catch (e) {
          console.warn(`Failed to parse attributes for token ${row.token_id}`);
        }
      }

      return {
        tokenId: row.token_id,
        name: row.name || `Token #${row.token_id}`,
        description: row.description,
        image: row.image_url,
        externalUrl: row.external_url,
        attributes,
        owner: row.holder_address,
        balance: row.balance?.toString() || '0',
        contractAddress: row.contract_address,
        metadata: {
          lastUpdated: row.updated_at,
          cached: !!row.image_cached,
          ...metadata
        }
      };
    });

    // Get total count for this contract
    let countQuery = `
      SELECT COUNT(*) as count 
      FROM nft_metadata 
      WHERE LOWER(contract_address) = ?
    `;
    const countParams = [contractAddress];

    if (onlyWithImages) {
      countQuery += ' AND image_url IS NOT NULL';
    }

    if (search) {
      countQuery += ' AND (name LIKE ? OR token_id LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const totalCount = (db.prepare(countQuery).get(...countParams) as any).count;

    // Get contract stats for the gallery
    const contractStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT nm.token_id) as total_tokens,
        COUNT(CASE WHEN nm.image_url IS NOT NULL THEN 1 END) as tokens_with_images,
        COUNT(DISTINCT cs.address) as unique_holders
      FROM nft_metadata nm
      LEFT JOIN current_state cs ON nm.token_id = cs.token_id 
        AND LOWER(nm.contract_address) = LOWER(cs.contract_address)
        AND cs.balance > 0
      WHERE LOWER(nm.contract_address) = ?
    `).get(contractAddress) as any;

    return NextResponse.json({
      success: true,
      tokens,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit)
      },
      stats: {
        totalTokens: contractStats?.total_tokens || 0,
        tokensWithImages: contractStats?.tokens_with_images || 0,
        uniqueHolders: contractStats?.unique_holders || 0,
        imageProgress: contractStats?.total_tokens > 0 
          ? Math.round((contractStats.tokens_with_images / contractStats.total_tokens) * 100)
          : 0
      },
      filters: {
        contractAddress,
        search,
        onlyWithImages,
        sortBy
      }
    });
  } catch (error: any) {
    console.error('Contract gallery API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch contract gallery'
      },
      { status: 500 }
    );
  }
}