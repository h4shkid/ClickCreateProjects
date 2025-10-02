import { NextRequest, NextResponse } from 'next/server';
import { MetadataFetcher } from '@/lib/metadata/metadata-fetcher';
import { ImageManager } from '@/lib/metadata/image-manager';
import { getDatabase } from '@/lib/database/init';
import path from 'path';
import { promises as fs } from 'fs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const onlyWithImages = searchParams.get('onlyWithImages') === 'true';
    const sortBy = searchParams.get('sortBy') || 'recent';

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();

    // Build query based on filters
    let query = `
      SELECT 
        nm.*,
        cs.balance,
        cs.address
      FROM nft_metadata nm
      LEFT JOIN (
        SELECT token_id, address, balance
        FROM current_state
        WHERE balance > 0
      ) cs ON nm.token_id = cs.token_id
    `;

    const conditions = [];
    if (onlyWithImages) {
      conditions.push('nm.image_url IS NOT NULL');
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Add sorting
    if (sortBy === 'recent') {
      query += ' ORDER BY nm.updated_at DESC';
    } else if (sortBy === 'balance') {
      query += ' ORDER BY cs.balance DESC';
    } else if (sortBy === 'name') {
      query += ' ORDER BY nm.name ASC';
    }

    query += ` LIMIT ? OFFSET ?`;

    const stmt = db.prepare(query);
    const rows = stmt.all(limit, offset) as any[];

    // Process results for gallery
    const galleryItems = await Promise.all(
      rows.map(async (row) => {
        const metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {};
        
        // Check for local image files
        let imagePaths = null;
        if (row.image_cached) {
          const imageManager = new ImageManager();
          imagePaths = await imageManager.getImagePaths(row.token_id);
        }

        return {
          tokenId: row.token_id,
          name: row.name || `Token #${row.token_id.substring(0, 8)}`,
          description: row.description,
          imageUrl: row.image_url,
          thumbnailUrl: imagePaths?.thumbnail ? `/api/nft/image?path=${encodeURIComponent(imagePaths.thumbnail)}` : null,
          originalUrl: imagePaths?.original ? `/api/nft/image?path=${encodeURIComponent(imagePaths.original)}` : null,
          externalUrl: row.external_url,
          attributes: row.attributes ? JSON.parse(row.attributes) : [],
          holder: row.address,
          balance: row.balance || '0',
          metadata
        };
      })
    );

    // Get total count
    const countQuery = onlyWithImages
      ? 'SELECT COUNT(*) as count FROM nft_metadata WHERE image_url IS NOT NULL'
      : 'SELECT COUNT(*) as count FROM nft_metadata';
    const totalCount = (db.prepare(countQuery).get() as any).count;

    return NextResponse.json({
      success: true,
      data: {
        items: galleryItems,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      }
    });
  } catch (error: any) {
    console.error('Gallery API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch gallery items'
      },
      { status: 500 }
    );
  }
}