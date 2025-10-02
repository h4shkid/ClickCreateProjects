import { NextRequest, NextResponse } from 'next/server';
import { MetadataFetcher } from '@/lib/metadata/metadata-fetcher';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenIds, concurrency = 3 } = body;
    
    if (!tokenIds || !Array.isArray(tokenIds)) {
      return NextResponse.json(
        {
          success: false,
          error: 'tokenIds array is required'
        },
        { status: 400 }
      );
    }

    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';

    // Initialize metadata fetcher
    const fetcher = new MetadataFetcher();

    // Fetch metadata for all tokens
    const metadataMap = await fetcher.fetchBatchMetadata(
      contractAddress,
      tokenIds,
      concurrency
    );

    // Convert Map to object and process IPFS URLs
    const result: any = {};
    for (const [tokenId, metadata] of metadataMap.entries()) {
      if (metadata.imageUrl && metadata.imageUrl.startsWith('ipfs://')) {
        metadata.imageUrl = fetcher.processIPFSUrl(metadata.imageUrl);
      }
      if (metadata.image && metadata.image.startsWith('ipfs://')) {
        metadata.image = fetcher.processIPFSUrl(metadata.image);
      }
      result[tokenId] = metadata;
    }

    return NextResponse.json({
      success: true,
      data: result,
      stats: {
        requested: tokenIds.length,
        fetched: metadataMap.size
      }
    });
  } catch (error: any) {
    console.error('Batch metadata API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch batch metadata'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenIdsParam = searchParams.get('tokenIds');
    
    if (!tokenIdsParam) {
      return NextResponse.json(
        {
          success: false,
          error: 'tokenIds query parameter is required'
        },
        { status: 400 }
      );
    }

    const tokenIds = tokenIdsParam.split(',');
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';

    // Initialize metadata fetcher
    const fetcher = new MetadataFetcher();

    // Fetch metadata for all tokens
    const metadataMap = await fetcher.fetchBatchMetadata(
      contractAddress,
      tokenIds,
      3
    );

    // Convert Map to object and process IPFS URLs
    const result: any = {};
    for (const [tokenId, metadata] of metadataMap.entries()) {
      if (metadata.imageUrl && metadata.imageUrl.startsWith('ipfs://')) {
        metadata.imageUrl = fetcher.processIPFSUrl(metadata.imageUrl);
      }
      if (metadata.image && metadata.image.startsWith('ipfs://')) {
        metadata.image = fetcher.processIPFSUrl(metadata.image);
      }
      result[tokenId] = metadata;
    }

    return NextResponse.json({
      success: true,
      data: result,
      stats: {
        requested: tokenIds.length,
        fetched: metadataMap.size
      }
    });
  } catch (error: any) {
    console.error('Batch metadata GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch batch metadata'
      },
      { status: 500 }
    );
  }
}