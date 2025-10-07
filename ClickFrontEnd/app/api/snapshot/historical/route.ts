import { NextRequest, NextResponse } from 'next/server';
import { SnapshotGenerator } from '@/lib/processing/snapshot-generator';
import { getDatabase } from '@/lib/database/init';
import { createDateToBlockConverter } from '@/lib/utils/date-to-block';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const blockNumber = searchParams.get('blockNumber');
    const date = searchParams.get('date');
    const timestamp = searchParams.get('timestamp'); // Keep for backward compatibility
    const tokenId = searchParams.get('tokenId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const minBalance = searchParams.get('minBalance');

    if (!blockNumber && !date && !timestamp) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either blockNumber, date, or timestamp is required. Use date parameter for user-friendly date input (YYYY-MM-DD or ISO format)'
        },
        { status: 400 }
      );
    }

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();

    // Convert date/timestamp to block number if needed
    let targetBlock = blockNumber ? parseInt(blockNumber) : null;
    let actualDate: Date | undefined;
    
    if (!targetBlock && (date || timestamp)) {
      const converter = createDateToBlockConverter();
      
      try {
        if (date) {
          // Modern date parameter - more user friendly
          const targetDate = new Date(date);
          if (isNaN(targetDate.getTime())) {
            return NextResponse.json({
              success: false,
              error: 'Invalid date format. Use YYYY-MM-DD or ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)'
            }, { status: 400 });
          }
          
          targetBlock = await converter.dateToBlock(targetDate);
          actualDate = await converter.blockToDate(targetBlock);
          console.log(`📅 Converted date ${date} to block ${targetBlock} (actual: ${actualDate.toISOString()})`);
          
        } else if (timestamp) {
          // Legacy timestamp support
          const targetDate = new Date(timestamp);
          if (isNaN(targetDate.getTime())) {
            return NextResponse.json({
              success: false,
              error: 'Invalid timestamp format'
            }, { status: 400 });
          }
          
          targetBlock = await converter.dateToBlock(targetDate);
          actualDate = await converter.blockToDate(targetBlock);
        }
      } catch (error: any) {
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to convert date to block number'
        }, { status: 400 });
      }
    }

    if (!targetBlock) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid block number, date, or timestamp'
        },
        { status: 400 }
      );
    }

    // Create snapshot generator
    const generator = new SnapshotGenerator();

    // Generate historical snapshot
    const snapshots = await generator.generateHistoricalSnapshot({
      blockNumber: targetBlock,
      tokenId: tokenId || undefined,
      minBalance: minBalance ? BigInt(minBalance) : undefined,
      limit,
      offset
    });

    // Get the first snapshot (since we're only querying one token)
    const snapshot = snapshots[0];
    if (!snapshot) {
      return NextResponse.json({
        success: false,
        error: 'No snapshot data found'
      }, { status: 404 });
    }

    // Sort holders by balance
    const sorted = [...snapshot.holders].sort((a, b) => {
      const diff = BigInt(b.balance || 0) - BigInt(a.balance || 0);
      return diff > BigInt(0) ? 1 : -1;
    });

    // Get block info
    const blockInfo = db.prepare(`
      SELECT MIN(block_number) as first_block, MAX(block_number) as last_block
      FROM events
      WHERE block_number <= ?
    `).get(targetBlock) as any;

    return NextResponse.json({
      success: true,
      data: {
        snapshot: sorted,
        metadata: {
          blockNumber: targetBlock,
          blockDate: actualDate ? actualDate.toISOString() : (timestamp || new Date().toISOString()),
          inputDate: date || timestamp,
          dateConversion: actualDate ? {
            requestedDate: date || timestamp,
            actualBlockDate: actualDate.toISOString(),
            accuracy: '±12 seconds per block'
          } : undefined,
          tokenId: snapshot.tokenId,
          totalSupply: snapshot.totalSupply,
          uniqueHolders: snapshot.holderCount,
          dataRange: {
            firstBlock: blockInfo?.first_block || 0,
            lastBlock: blockInfo?.last_block || targetBlock
          }
        },
        pagination: {
          limit,
          offset,
          total: snapshot.holderCount,
          hasMore: limit ? (offset + limit < snapshot.holderCount) : false
        }
      }
    });
  } catch (error: any) {
    console.error('Historical snapshot error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate historical snapshot'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { blockNumbers, timestamps, tokenId, comparison } = body;

    if (!blockNumbers && !timestamps) {
      return NextResponse.json(
        {
          success: false,
          error: 'Either blockNumbers or timestamps array is required'
        },
        { status: 400 }
      );
    }

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();

    // Create snapshot generator
    const generator = new SnapshotGenerator();

    // Generate multiple historical snapshots
    const snapshots = [];
    const blocks = blockNumbers || timestamps.map((t: string) => {
      // Convert timestamp to approximate block number
      const targetTime = new Date(t).getTime() / 1000;
      const currentBlock = 18500000;
      const currentTime = Date.now() / 1000;
      const blocksDiff = Math.floor((currentTime - targetTime) / 12);
      return currentBlock - blocksDiff;
    });

    for (const block of blocks) {
      const snapshotResults = await generator.generateHistoricalSnapshot({
        blockNumber: block,
        tokenId: tokenId || undefined
      });
      
      const snapshotData = snapshotResults[0];
      if (snapshotData) {
        snapshots.push({
          blockNumber: block,
          snapshot: snapshotData.holders.slice(0, 100), // Limit to top 100 for comparison
          totalSupply: snapshotData.totalSupply,
          uniqueHolders: snapshotData.holderCount
        });
      }
    }

    // If comparison mode, calculate changes
    if (comparison && snapshots.length >= 2) {
      const changes = [];
      for (let i = 1; i < snapshots.length; i++) {
        const prev = snapshots[i - 1];
        const curr = snapshots[i];
        
        // Create maps for easy lookup
        const prevMap = new Map(prev.snapshot.map(h => [h.holderAddress, h]));
        const currMap = new Map(curr.snapshot.map(h => [h.holderAddress, h]));
        
        // Find new holders
        const newHolders = curr.snapshot.filter(h => !prevMap.has(h.holderAddress));
        const removedHolders = prev.snapshot.filter(h => !currMap.has(h.holderAddress));
        
        changes.push({
          fromBlock: prev.blockNumber,
          toBlock: curr.blockNumber,
          newHolders: newHolders.length,
          removedHolders: removedHolders.length,
          supplyChange: (BigInt(curr.totalSupply) - BigInt(prev.totalSupply)).toString()
        });
      }
      
      return NextResponse.json({
        success: true,
        data: {
          snapshots,
          changes
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: snapshots
    });
  } catch (error: any) {
    console.error('Historical comparison error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate historical comparison'
      },
      { status: 500 }
    );
  }
}