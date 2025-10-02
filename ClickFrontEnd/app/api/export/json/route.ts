import { NextRequest, NextResponse } from 'next/server';
import { SnapshotGenerator } from '@/lib/processing/snapshot-generator';
import { MetadataFetcher } from '@/lib/metadata/metadata-fetcher';
import { getDatabase } from '@/lib/database/init';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'snapshot';
    const tokenId = searchParams.get('tokenId');
    const blockNumber = searchParams.get('blockNumber');
    const includeMetadata = searchParams.get('includeMetadata') === 'true';
    const limit = parseInt(searchParams.get('limit') || '1000');

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();

    let jsonData: any = {};
    let filename = '';

    switch (type) {
      case 'snapshot': {
        const generator = new SnapshotGenerator();
        const snapshots = blockNumber
          ? await generator.generateHistoricalSnapshot({
              blockNumber: parseInt(blockNumber),
              tokenId: tokenId || undefined,
              limit
            })
          : await generator.generateCurrentSnapshot({
              tokenId: tokenId || undefined,
              limit
            });

        // Get the first snapshot
        const snapshot = snapshots[0];
        if (!snapshot || !snapshot.holders) {
          return NextResponse.json(
            {
              success: false,
              error: 'No snapshot data found'
            },
            { status: 404 }
          );
        }

        // Include metadata if requested
        let metadata = null;
        if (includeMetadata && tokenId) {
          const fetcher = new MetadataFetcher();
          const nftMetadata = await fetcher.fetchMetadata(
            process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
            tokenId
          );
          metadata = nftMetadata;
        }

        jsonData = {
          snapshot: {
            tokenId: snapshot.tokenId || 'all',
            blockNumber: snapshot.blockNumber || 'current',
            timestamp: snapshot.timestamp || new Date().toISOString(),
            totalSupply: snapshot.totalSupply,
            uniqueHolders: snapshot.holderCount,
            holders: snapshot.holders.map((h: any) => ({
              address: h.holderAddress,
              balance: h.balance,
              percentage: h.percentage,
              rank: h.rank
            }))
          },
          metadata
        };
        
        filename = `snapshot_${snapshot.tokenId || 'all'}_${blockNumber || 'current'}.json`;
        break;
      }

      case 'full': {
        // Full export with all data
        const currentState = db.prepare(`
          SELECT * FROM current_state
          WHERE balance > 0
          ${tokenId ? 'AND token_id = ?' : ''}
          LIMIT ?
        `).all(tokenId ? [tokenId, limit] : [limit]) as any[];

        const events = db.prepare(`
          SELECT * FROM events
          ${tokenId ? 'WHERE token_id = ?' : ''}
          ORDER BY block_number DESC
          LIMIT ?
        `).all(tokenId ? [tokenId, limit] : [limit]) as any[];

        const metadata = db.prepare(`
          SELECT * FROM nft_metadata
          ${tokenId ? 'WHERE token_id = ?' : ''}
          LIMIT ?
        `).all(tokenId ? [tokenId, limit] : [limit]) as any[];

        jsonData = {
          exportInfo: {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            tokenId: tokenId || 'all',
            recordCounts: {
              currentState: currentState.length,
              events: events.length,
              metadata: metadata.length
            }
          },
          currentState: currentState.map(s => ({
            holderAddress: s.address,
            tokenId: s.token_id,
            balance: s.balance,
            lastUpdated: s.last_updated
          })),
          events: events.map((e: any) => ({
            transactionHash: e.transaction_hash,
            blockNumber: e.block_number,
            timestamp: e.block_timestamp,
            eventType: e.event_type,
            from: e.from_address,
            to: e.to_address,
            tokenId: e.token_id,
            amount: e.amount,
            operator: e.operator
          })),
          metadata: metadata.map(m => ({
            tokenId: m.token_id,
            name: m.name,
            description: m.description,
            imageUrl: m.image_url,
            externalUrl: m.external_url,
            attributes: m.attributes ? JSON.parse(m.attributes) : null
          }))
        };
        
        filename = `full_export_${tokenId || 'all'}_${Date.now()}.json`;
        break;
      }

      case 'merkle': {
        // Merkle tree data for airdrops
        const generator = new SnapshotGenerator();
        const snapshot = await generator.generateCurrentSnapshot({
          tokenId: tokenId || undefined,
          limit
        });

        // Create merkle tree compatible format
        const merkleData = {
          root: null, // Would be calculated with merkle tree library
          claims: snapshot.reduce((acc: any, holder: any) => {
            acc[holder.holderAddress] = {
              index: holder.rank - 1,
              amount: holder.balance,
              proof: [] // Would be generated with merkle tree
            };
            return acc;
          }, {} as any)
        };

        jsonData = {
          tokenId: tokenId || 'all',
          timestamp: new Date().toISOString(),
          totalClaims: snapshot.length,
          totalAmount: snapshot.reduce((sum: bigint, h: any) => sum + BigInt(h.balance || 0), BigInt(0)).toString(),
          merkleRoot: merkleData.root,
          claims: merkleData.claims
        };
        
        filename = `merkle_${tokenId || 'all'}_${Date.now()}.json`;
        break;
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid export type'
          },
          { status: 400 }
        );
    }

    // Return JSON file
    return NextResponse.json(jsonData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error: any) {
    console.error('JSON export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to export JSON'
      },
      { status: 500 }
    );
  }
}