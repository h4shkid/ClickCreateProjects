import { NextRequest, NextResponse } from 'next/server';
import { MetadataFetcher } from '@/lib/metadata/metadata-fetcher';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  try {
    const { tokenId } = await params;
    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x300e7a5fb0ab08af367d5fb3915930791bb08c2b';
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true';

    // Initialize metadata fetcher
    const fetcher = new MetadataFetcher();

    // Fetch metadata
    const metadata = await fetcher.fetchMetadata(
      contractAddress,
      tokenId,
      forceRefresh
    );

    if (!metadata) {
      return NextResponse.json(
        {
          success: false,
          error: 'Metadata not found for this token'
        },
        { status: 404 }
      );
    }

    // Process IPFS URLs if needed
    if (metadata.imageUrl && metadata.imageUrl.startsWith('ipfs://')) {
      metadata.imageUrl = fetcher.processIPFSUrl(metadata.imageUrl);
    }
    if (metadata.image && metadata.image.startsWith('ipfs://')) {
      metadata.image = fetcher.processIPFSUrl(metadata.image);
    }

    return NextResponse.json({
      success: true,
      data: metadata
    });
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