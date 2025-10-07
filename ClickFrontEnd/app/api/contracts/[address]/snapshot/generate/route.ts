import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';
import { SnapshotGenerator } from '@/lib/processing/snapshot-generator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const body = await request.json();
    const { 
      type, 
      blockNumber, 
      name, 
      description, 
      tokenId, 
      minBalance,
      userId // User ID for authentication - should come from JWT in real implementation
    } = body;

    // Validate contract address
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { success: false, error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    // Validate snapshot type
    if (!type || !['current', 'historical'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid snapshot type. Must be "current" or "historical"' },
        { status: 400 }
      );
    }

    // Validate historical snapshot requirements
    if (type === 'historical' && !blockNumber) {
      return NextResponse.json(
        { success: false, error: 'Block number is required for historical snapshots' },
        { status: 400 }
      );
    }

    const contractAddress = address.toLowerCase();

    // Initialize database
    const dbManager = getDatabase();
    await dbManager.initialize();
    const db = dbManager.getDb();

    // Get contract info
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

    // Note: In a real implementation, you would validate userId against JWT token
    // For now, we'll create a default user if none provided
    let validUserId = userId;
    if (!validUserId) {
      // Create or get anonymous user (in real app, this would come from auth)
      const anonymousUser = db.prepare(`
        SELECT id FROM user_profiles WHERE wallet_address = 'anonymous'
      `).get() as any;

      if (!anonymousUser) {
        const result = await db.prepare(`
          INSERT INTO user_profiles (wallet_address, username, display_name)
          VALUES ('anonymous', 'anonymous', 'Anonymous User')
        `).run();
        validUserId = result.lastInsertRowid;
      } else {
        validUserId = anonymousUser.id;
      }
    }

    // Create snapshot generator
    const generator = new SnapshotGenerator();

    let snapshotData;
    let currentBlockNumber;

    if (type === 'current') {
      // Generate current snapshot
      const snapshots = await generator.generateCurrentSnapshot({
        tokenId: tokenId || undefined,
        minBalance: minBalance ? BigInt(minBalance) : undefined
      } as any);

      snapshotData = snapshots[0];
      currentBlockNumber = snapshotData?.blockNumber;
    } else {
      // Generate historical snapshot
      const snapshots = await generator.generateHistoricalSnapshot({
        blockNumber,
        tokenId: tokenId || undefined,
        minBalance: minBalance ? BigInt(minBalance) : undefined
      } as any);
      snapshotData = snapshots[0];
      currentBlockNumber = blockNumber;
    }

    if (!snapshotData) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate snapshot - no data found' },
        { status: 500 }
      );
    }

    // Calculate analytics
    const holders = snapshotData.holders || [];
    const totalSupply = snapshotData.totalSupply || '0';
    const totalHolders = holders.length;
    const uniqueTokens = tokenId ? 1 : 0;

    // Calculate Gini coefficient for wealth distribution
    const balances = holders.map(h => BigInt(h.balance || 0)).sort((a, b) => Number(a - b));
    let giniCoefficient = 0;
    if (balances.length > 1) {
      const n = balances.length;
      const sum = balances.reduce((acc, bal) => acc + bal, BigInt(0));
      if (sum > BigInt(0)) {
        let numerator = BigInt(0);
        for (let i = 0; i < n; i++) {
          numerator += BigInt(i + 1) * balances[i];
        }
        giniCoefficient = Number((BigInt(2) * numerator) * BigInt(100) / (BigInt(n) * sum) - BigInt(n + 1) * BigInt(100) / BigInt(n)) / 100;
      }
    }

    // Count total transfers for this contract
    const transferCount = db.prepare(`
      SELECT COUNT(*) as count
      FROM events 
      WHERE LOWER(contract_address) = ?
      ${tokenId ? 'AND token_id = ?' : ''}
      ${type === 'historical' ? 'AND block_number <= ?' : ''}
    `).get(
      contractAddress,
      ...(tokenId ? [tokenId] : []),
      ...(type === 'historical' ? [blockNumber] : [])
    ) as any;

    // Save snapshot to database
    const snapshotResult = await db.prepare(`
      INSERT INTO user_snapshots (
        user_id,
        contract_id,
        snapshot_type,
        block_number,
        snapshot_name,
        description,
        total_holders,
        total_supply,
        unique_tokens,
        total_transfers,
        gini_coefficient,
        snapshot_data,
        is_public
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validUserId,
      contractInfo.id,
      type,
      currentBlockNumber,
      name || `${type === 'current' ? 'Current' : 'Historical'} Snapshot`,
      description || '',
      totalHolders,
      totalSupply,
      uniqueTokens,
      transferCount?.count || 0,
      giniCoefficient,
      JSON.stringify({
        holders: holders.slice(0, 1000), // Store top 1000 holders to avoid huge JSON
        metadata: {
          contractAddress,
          tokenId,
          blockNumber: currentBlockNumber,
          generatedAt: new Date().toISOString(),
          totalHolders,
          totalSupply,
          uniqueTokens
        }
      }),
      1 // Default to public
    );

    const newSnapshot = {
      id: snapshotResult.lastInsertRowid.toString(),
      name: name || `${type === 'current' ? 'Current' : 'Historical'} Snapshot`,
      description: description || '',
      type,
      blockNumber: currentBlockNumber,
      totalHolders,
      totalSupply,
      uniqueTokens,
      totalTransfers: transferCount?.count || 0,
      giniCoefficient,
      isPublic: true,
      isFeatured: false,
      viewCount: 0,
      createdAt: new Date().toISOString(),
      downloadUrl: `/api/contracts/${contractAddress}/snapshots/${snapshotResult.lastInsertRowid}/download`
    };

    return NextResponse.json({
      success: true,
      snapshot: newSnapshot,
      metadata: {
        contractAddress,
        tokenId,
        blockNumber: currentBlockNumber,
        generatedAt: new Date().toISOString(),
        processingTime: 'Generated instantly' // Could track actual time
      }
    });
  } catch (error: any) {
    console.error('Contract snapshot generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate contract snapshot'
      },
      { status: 500 }
    );
  }
}