import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ address: string }> }
) {
  try {
    const params = await paramsPromise;
    const address = params.address;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const eventType = searchParams.get('eventType');
    const tokenId = searchParams.get('tokenId');
    const fromAddress = searchParams.get('from');
    const toAddress = searchParams.get('to');
    const since = searchParams.get('since'); // Unix timestamp

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
      SELECT id, name, symbol, contract_type 
      FROM contracts 
      WHERE LOWER(address) = ? AND is_active = 1
    `).get(contractAddress) as any;

    if (!contractExists) {
      return NextResponse.json(
        { success: false, error: 'Contract not found or not active' },
        { status: 404 }
      );
    }

    // Build query for contract-specific events
    let query = `
      SELECT 
        e.*,
        cs_from.balance as from_balance,
        cs_to.balance as to_balance
      FROM events e
      LEFT JOIN current_state cs_from ON e.from_address = cs_from.address 
        AND e.token_id = cs_from.token_id 
        AND LOWER(cs_from.contract_address) = LOWER(e.contract_address)
      LEFT JOIN current_state cs_to ON e.to_address = cs_to.address 
        AND e.token_id = cs_to.token_id 
        AND LOWER(cs_to.contract_address) = LOWER(e.contract_address)
      WHERE LOWER(e.contract_address) = ?
    `;

    const sqlParams: any[] = [contractAddress];

    // Add filters
    if (eventType) {
      query += ' AND e.event_type = ?';
      sqlParams.push(eventType);
    }

    if (tokenId) {
      query += ' AND e.token_id = ?';
      sqlParams.push(tokenId);
    }

    if (fromAddress) {
      query += ' AND LOWER(e.from_address) = ?';
      sqlParams.push(fromAddress.toLowerCase());
    }

    if (toAddress) {
      query += ' AND LOWER(e.to_address) = ?';
      sqlParams.push(toAddress.toLowerCase());
    }

    if (since) {
      query += ' AND e.block_timestamp >= ?';
      sqlParams.push(parseInt(since));
    }

    query += ' ORDER BY e.block_number DESC, e.log_index DESC LIMIT ?';
    sqlParams.push(limit);

    const events = db.prepare(query).all(...sqlParams) as any[];

    // Format events for display
    const formattedEvents = events.map(event => {
      // Determine event icon/type for UI
      let displayType = event.event_type;
      if (event.from_address === '0x0000000000000000000000000000000000000000') {
        displayType = 'Mint';
      } else if (event.to_address === '0x0000000000000000000000000000000000000000') {
        displayType = 'Burn';
      } else {
        displayType = 'Transfer';
      }

      return {
        id: event.transaction_hash + '_' + event.log_index,
        type: displayType,
        originalType: event.event_type,
        tokenId: event.token_id,
        from: event.from_address,
        to: event.to_address,
        amount: event.amount || '1',
        blockNumber: event.block_number,
        transactionHash: event.transaction_hash,
        timestamp: new Date(event.block_timestamp * 1000).toISOString(),
        gasUsed: event.gas_used,
        gasPrice: event.gas_price,
        logIndex: event.log_index,
        fromBalance: event.from_balance || '0',
        toBalance: event.to_balance || '0',
        contractAddress: event.contract_address
      };
    });

    // Get contract-specific statistics
    const stats = {
      totalEvents: (db.prepare(`
        SELECT COUNT(*) as count 
        FROM events 
        WHERE LOWER(contract_address) = ?
      `).get(contractAddress) as any).count,

      last24hEvents: (db.prepare(`
        SELECT COUNT(*) as count 
        FROM events 
        WHERE LOWER(contract_address) = ? 
          AND block_timestamp > strftime('%s', 'now', '-24 hours')
      `).get(contractAddress) as any).count,

      last7dEvents: (db.prepare(`
        SELECT COUNT(*) as count 
        FROM events 
        WHERE LOWER(contract_address) = ? 
          AND block_timestamp > strftime('%s', 'now', '-7 days')
      `).get(contractAddress) as any).count,

      activeAddresses24h: (db.prepare(`
        SELECT COUNT(DISTINCT address) as count 
        FROM (
          SELECT from_address as address 
          FROM events 
          WHERE LOWER(contract_address) = ? 
            AND block_timestamp > strftime('%s', 'now', '-24 hours')
          UNION
          SELECT to_address as address 
          FROM events 
          WHERE LOWER(contract_address) = ? 
            AND block_timestamp > strftime('%s', 'now', '-24 hours')
        )
      `).get(contractAddress, contractAddress) as any).count,

      uniqueTokensTransferred24h: (db.prepare(`
        SELECT COUNT(DISTINCT token_id) as count 
        FROM events 
        WHERE LOWER(contract_address) = ? 
          AND block_timestamp > strftime('%s', 'now', '-24 hours')
      `).get(contractAddress) as any).count
    };

    // Get event type breakdown
    const eventTypeBreakdown = db.prepare(`
      SELECT 
        event_type,
        COUNT(*) as count,
        COUNT(CASE WHEN block_timestamp > strftime('%s', 'now', '-24 hours') THEN 1 END) as count_24h
      FROM events 
      WHERE LOWER(contract_address) = ?
      GROUP BY event_type
      ORDER BY count DESC
    `).all(contractAddress) as any[];

    // Get recent active blocks
    const recentBlocks = db.prepare(`
      SELECT 
        block_number,
        COUNT(*) as event_count,
        MIN(block_timestamp) as block_timestamp
      FROM events 
      WHERE LOWER(contract_address) = ?
        AND block_timestamp > strftime('%s', 'now', '-24 hours')
      GROUP BY block_number
      ORDER BY block_number DESC
      LIMIT 10
    `).all(contractAddress) as any[];

    return NextResponse.json({
      success: true,
      events: formattedEvents,
      stats: {
        ...stats,
        eventTypes: eventTypeBreakdown.map(et => ({
          type: et.event_type,
          total: et.count,
          last24h: et.count_24h
        })),
        recentBlocks: recentBlocks.map(rb => ({
          blockNumber: rb.block_number,
          eventCount: rb.event_count,
          timestamp: new Date(rb.block_timestamp * 1000).toISOString()
        }))
      },
      contract: {
        address: contractAddress,
        name: contractExists.name,
        symbol: contractExists.symbol,
        contractType: contractExists.contract_type
      },
      metadata: {
        contractAddress,
        lastBlock: events[0]?.block_number || 0,
        totalReturned: formattedEvents.length,
        filters: {
          eventType,
          tokenId,
          fromAddress,
          toAddress,
          since
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Contract events API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch contract events'
      },
      { status: 500 }
    );
  }
}