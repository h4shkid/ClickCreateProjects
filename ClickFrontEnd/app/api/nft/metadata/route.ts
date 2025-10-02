import { NextRequest, NextResponse } from 'next/server';
import { MetadataFetcher } from '@/lib/metadata/metadata-fetcher';
import { ImageManager } from '@/lib/metadata/image-manager';
import { getDatabase } from '@/lib/database/init';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenId = searchParams.get('tokenId');
    const contractAddress = searchParams.get('contractAddress') || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
    const refresh = searchParams.get('refresh') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const withImages = searchParams.get('withImages') !== 'false';

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();

    // Create metadata fetcher
    const fetcher = new MetadataFetcher();

    if (tokenId) {
      // Fetch specific token metadata
      const metadata = await fetcher.fetchMetadata(
        contractAddress!,
        tokenId,
        refresh
      );

      if (!metadata) {
        return NextResponse.json(
          {
            success: false,
            error: 'Metadata not found'
          },
          { status: 404 }
        );
      }

      // Check for cached image if requested
      let imageInfo = null;
      if (withImages) {
        const imageManager = new ImageManager();
        const paths = await imageManager.getImagePaths(tokenId);
        imageInfo = paths;
      }

      return NextResponse.json({
        success: true,
        data: {
          ...metadata,
          imagePaths: imageInfo
        }
      });
    } else {
      // Get all stored metadata
      const allMetadata = fetcher.getAllStoredMetadata(limit + offset);
      const paginated = allMetadata.slice(offset, offset + limit);

      // Get stats
      const stats = fetcher.getStats();

      return NextResponse.json({
        success: true,
        data: {
          metadata: paginated,
          pagination: {
            total: allMetadata.length,
            limit,
            offset,
            hasMore: offset + limit < allMetadata.length
          },
          stats
        }
      });
    }
  } catch (error: any) {
    console.error('Metadata API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch metadata'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenIds, contractAddress, downloadImages, forceRefresh } = body;

    if (!tokenIds || !Array.isArray(tokenIds)) {
      return NextResponse.json(
        {
          success: false,
          error: 'tokenIds array is required'
        },
        { status: 400 }
      );
    }

    const contract = contractAddress || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();

    // Create fetchers
    const metadataFetcher = new MetadataFetcher();
    const imageManager = new ImageManager();

    // Fetch metadata in batches
    const metadataMap = await metadataFetcher.fetchBatchMetadata(
      contract!,
      tokenIds,
      3 // Concurrency
    );

    // Download images if requested
    let imageResults = null;
    if (downloadImages) {
      const tokensWithImages = Array.from(metadataMap.entries())
        .filter(([_, metadata]) => metadata.imageUrl)
        .map(([tokenId, metadata]) => ({
          tokenId,
          imageUrl: metadata.imageUrl
        }));

      imageResults = await imageManager.downloadBatchImages(tokensWithImages, 2);
    }

    return NextResponse.json({
      success: true,
      data: {
        metadata: Object.fromEntries(metadataMap),
        images: imageResults ? Object.fromEntries(imageResults) : null,
        summary: {
          requested: tokenIds.length,
          fetched: metadataMap.size,
          withImages: Array.from(metadataMap.values()).filter(m => m.imageUrl).length,
          imagesDownloaded: imageResults?.size || 0
        }
      }
    });
  } catch (error: any) {
    console.error('Batch metadata error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch batch metadata'
      },
      { status: 500 }
    );
  }
}