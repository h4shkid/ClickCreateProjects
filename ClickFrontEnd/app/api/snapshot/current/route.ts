import { NextRequest, NextResponse } from 'next/server';
import { SnapshotGenerator } from '@/lib/processing/snapshot-generator';
import { getDatabase } from '@/lib/database/init';
import { SyncManager } from '@/lib/blockchain/sync-manager';
import { FullSeasonDetector } from '@/lib/processing/full-season-detector';
import { ExactMatchDetector } from '@/lib/processing/exact-match-detector';
import { SEASON_GROUPS } from '@/lib/constants/season-tokens';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tokenId = searchParams.get('tokenId');
    const tokenIds = searchParams.get('tokenIds');
    // If no limit specified or it's 0, return all holders
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : undefined;
    const offset = parseInt(searchParams.get('offset') || '0');
    const minBalance = searchParams.get('minBalance');
    const sortBy = searchParams.get('sortBy') || 'balance';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const fullSeasonMode = searchParams.get('fullSeason') === 'true';
    const seasonName = searchParams.get('season');
    const exactMatch = searchParams.get('exactMatch');

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();

    // Handle full season mode - find only complete set holders
    if (fullSeasonMode && seasonName) {
      const seasonGroup = SEASON_GROUPS.find(g => g.name === seasonName);
      if (!seasonGroup) {
        return NextResponse.json({
          success: false,
          error: 'Invalid season name'
        }, { status: 400 });
      }

      const detector = new FullSeasonDetector();
      const fullSeasonHolders = await detector.findFullSeasonHolders(seasonGroup.tokenIds);
      const completeHolders = fullSeasonHolders.filter(h => h.isComplete);
      const stats = await detector.getSeasonCompletionStats(seasonGroup.tokenIds);
      
      console.log(`Full season detection for ${seasonName}:`, {
        totalTokensRequired: seasonGroup.tokenIds.length,
        totalHoldersWithAnyToken: fullSeasonHolders.length,
        completeSetHolders: completeHolders.length,
        firstCompleteHolder: completeHolders[0]
      });

      // Format response with the new format: [WalletID] || [Number of Sets] || [Number of tokens held] || [Token IDs Held]
      const formattedHolders = completeHolders.map((holder: any, index: number) => ({
        holderAddress: holder.address,
        numberOfSets: holder.numberOfCompleteSets,
        totalTokensHeld: holder.totalTokensHeld,
        tokensOwned: holder.tokensOwned,
        tokenBalances: holder.tokenBalances,
        balance: holder.totalTokensHeld.toString(),
        percentage: 100, // They own the complete set
        rank: index + 1,
        isCompleteSet: true,
        formattedOutput: `${holder.address} || ${holder.numberOfCompleteSets} || ${holder.totalTokensHeld} || [${holder.tokensOwned.join(',')}]`
      }));

      return NextResponse.json({
        success: true,
        data: {
          snapshot: formattedHolders,
          holders: formattedHolders,
          pagination: {
            total: completeHolders.length,
            limit: limit || completeHolders.length,
            offset: 0,
            hasMore: false
          },
          metadata: {
            mode: 'full_season',
            season: seasonName,
            seasonDisplayName: seasonGroup.displayName,
            totalTokensInSeason: seasonGroup.tokenIds.length,
            timestamp: new Date().toISOString(),
            tokenIdList: seasonGroup.tokenIds,
            stats: {
              totalHoldersWithAnyToken: stats.totalHolders,
              completeSetHolders: stats.completeSetHolders,
              averageCompletion: stats.averageCompletion.toFixed(2) + '%'
            }
          },
          totalHolders: completeHolders.length,
          blockNumber: null
        }
      });
    }

    // Handle exact match mode for multiple tokens
    if (exactMatch !== null && exactMatch !== undefined && (tokenIds || tokenId)) {
      const isExactMatch = exactMatch === 'true';
      const tokenIdList = tokenIds ? tokenIds.split(',').map(id => id.trim()) : 
                          tokenId ? [tokenId] : [];
      
      if (tokenIdList.length > 0) {
        const detector = new ExactMatchDetector();
        const holders = isExactMatch 
          ? await detector.findExactMatchHolders(tokenIdList)
          : await detector.findAnyMatchHolders(tokenIdList);
        
        const stats = await detector.getMatchStatistics(tokenIdList);
        
        // Format response with the new format
        const formattedHolders = holders.map((holder: any, index: number) => ({
          holderAddress: holder.address,
          numberOfSets: holder.numberOfCompleteSets,
          totalTokensHeld: holder.totalBalance,
          tokensOwned: holder.tokenIds,
          tokenBalances: holder.tokenBalances,
          balance: holder.totalBalance,
          percentage: 0, // Will be calculated if needed
          rank: index + 1,
          exactMatch: isExactMatch,
          formattedOutput: `${holder.address} || ${holder.numberOfCompleteSets} || ${holder.totalBalance} || [${holder.tokenIds.join(',')}]`
        }));

        return NextResponse.json({
          success: true,
          data: {
            snapshot: formattedHolders,
            holders: formattedHolders,
            pagination: {
              total: holders.length,
              limit: limit || holders.length,
              offset: 0,
              hasMore: false
            },
            metadata: {
              mode: isExactMatch ? 'exact_match' : 'any_match',
              queryTokens: tokenIdList,
              timestamp: new Date().toISOString(),
              stats: {
                exactMatchCount: stats.exactMatchCount,
                anyMatchCount: stats.anyMatchCount,
                tokenCombinations: Array.from(stats.tokenCombinations.entries()).map(([combo, count]) => ({
                  combination: combo,
                  holderCount: count
                }))
              }
            },
            totalHolders: holders.length,
            blockNumber: null
          }
        });
      }
    }

    // Create snapshot generator for regular mode
    const generator = new SnapshotGenerator();

    // Generate current snapshot
    const snapshots = await generator.generateCurrentSnapshot({
      tokenId: tokenId || undefined,
      minBalance: minBalance ? BigInt(minBalance) : undefined,
      limit: limit,  // undefined means get all holders
      offset: limit ? offset : undefined  // only use offset when limit is specified
    });

    // Get the first snapshot (since we're only querying one token or all)
    const snapshot = snapshots[0];
    if (!snapshot) {
      return NextResponse.json({
        success: false,
        error: 'No snapshot data found'
      }, { status: 404 });
    }

    // Sort holders
    const sorted = [...snapshot.holders].sort((a, b) => {
      if (sortBy === 'balance') {
        const diff = BigInt(b.balance || 0) - BigInt(a.balance || 0);
        return sortOrder === 'desc' ? (diff > BigInt(0) ? 1 : -1) : (diff < BigInt(0) ? 1 : -1);
      } else if (sortBy === 'percentage') {
        return sortOrder === 'desc' 
          ? (b.percentage || 0) - (a.percentage || 0) 
          : (a.percentage || 0) - (b.percentage || 0);
      }
      return 0;
    });

    // Use the holder count from the snapshot which is calculated correctly
    const totalHolders = snapshot.holderCount;

    // Get sync status
    const syncManager = new SyncManager();
    const syncStatus = syncManager.getSyncStatus();

    return NextResponse.json({
      success: true,
      data: {
        snapshot: sorted,
        holders: sorted.map((holder: any) => ({
          address: holder.holderAddress || holder.address,
          balance: holder.balance,
          percentage: holder.percentage,
          rank: holder.rank
        })),
        pagination: {
          total: totalHolders,
          limit: limit || totalHolders,
          offset,
          hasMore: limit ? (offset + limit < totalHolders) : false
        },
        metadata: {
          tokenId: snapshot.tokenId,
          timestamp: new Date().toISOString(),
          totalSupply: snapshot.totalSupply,
          uniqueHolders: totalHolders
        },
        totalHolders,
        blockNumber: snapshot.blockNumber,
        syncStatus: {
          lastSyncedBlock: syncStatus.lastSyncedBlock,
          isSynced: syncStatus.isSynced,
          currentBlockNumber: snapshot.blockNumber
        }
      }
    });
  } catch (error: any) {
    console.error('Snapshot API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate snapshot'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tokenIds, minBalance, exportFormat } = body;

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();

    // Create snapshot generator
    const generator = new SnapshotGenerator();

    // Generate snapshots for multiple tokens
    const snapshots = new Map();
    
    for (const tokenId of (tokenIds || ['all'])) {
      const snapshot = await generator.generateCurrentSnapshot({
        tokenId: tokenId === 'all' ? undefined : tokenId,
        minBalance: minBalance ? BigInt(minBalance) : undefined
      });
      snapshots.set(tokenId, snapshot);
    }

    // Format response based on export format
    if (exportFormat === 'csv') {
      // Return CSV format in response
      const csvData = Array.from(snapshots.entries()).flatMap(([tokenId, snapshot]) =>
        snapshot.map((holder: any) => ({
          token_id: tokenId,
          holder_address: holder.holderAddress,
          balance: holder.balance,
          percentage: holder.percentage,
          rank: holder.rank
        }))
      );
      
      return NextResponse.json({
        success: true,
        data: csvData,
        format: 'csv'
      });
    }

    return NextResponse.json({
      success: true,
      data: Object.fromEntries(snapshots),
      metadata: {
        timestamp: new Date().toISOString(),
        tokenCount: snapshots.size
      }
    });
  } catch (error: any) {
    console.error('Batch snapshot error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate batch snapshot'
      },
      { status: 500 }
    );
  }
}