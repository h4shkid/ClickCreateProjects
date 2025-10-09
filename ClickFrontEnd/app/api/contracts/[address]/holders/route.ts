import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sort = searchParams.get('sort') || 'balance';
    const search = searchParams.get('search');
    const minBalance = searchParams.get('minBalance');

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

    // Calculate total supply for percentage calculations
    const totalSupplyResult = db.prepare(`
      SELECT SUM(balance) as total_supply
      FROM current_state
      WHERE balance > 0 AND LOWER(contract_address) = ?
    `).get(contractAddress) as any;

    const totalSupply = BigInt(totalSupplyResult?.total_supply || 0);

    // Build holders query
    let query = `
      SELECT
        cs.address,
        SUM(cs.balance) as total_balance,
        COUNT(DISTINCT cs.token_id) as token_count,
        GROUP_CONCAT(cs.token_id || ':' || cs.balance) as token_details,
        MIN(e.block_timestamp) as first_transaction_date,
        MAX(e.block_timestamp) as last_transaction_date
      FROM current_state cs
      LEFT JOIN events e ON LOWER(e.contract_address) = LOWER(cs.contract_address)
        AND (e.from_address = cs.address OR e.to_address = cs.address)
      WHERE cs.balance > 0 AND LOWER(cs.contract_address) = ?
    `;

    const queryParams: any[] = [contractAddress];

    // Add search filter
    if (search) {
      query += ' AND cs.address LIKE ?';
      queryParams.push(`%${search}%`);
    }

    // Add minimum balance filter
    if (minBalance) {
      query += ' AND cs.balance >= ?';
      queryParams.push(minBalance);
    }

    query += ' GROUP BY cs.address';

    // Add sorting
    const sortColumn = {
      'balance': 'total_balance',
      'percentage': 'total_balance', // Same as balance for sorting
      'tokenCount': 'token_count',
      'firstSeen': 'first_transaction_date',
      'lastSeen': 'last_transaction_date'
    }[sort] || 'total_balance';

    query += ` ORDER BY ${sortColumn} DESC`;
    query += ` LIMIT ? OFFSET ?`;
    queryParams.push(limit, offset);

    const holders = db.prepare(query).all(...queryParams) as any[];

    // Check if addresses are contracts by looking for contract creation or code
    // This is a simplified check - in production you'd query the blockchain
    const holdersWithMetadata = holders.map((holder: any, index: number) => {
      const balance = BigInt(holder.total_balance);
      const percentage = totalSupply > BigInt(0) 
        ? Number((balance * BigInt(10000)) / totalSupply) / 100
        : 0;

      // Parse token details
      const tokenDetails = holder.token_details 
        ? holder.token_details.split(',').map((detail: string) => {
            const [tokenId, tokenBalance] = detail.split(':');
            return { tokenId, balance: tokenBalance };
          })
        : [];

      return {
        address: holder.address,
        balance: holder.total_balance.toString(),
        percentage: percentage.toFixed(2),
        tokenCount: holder.token_count,
        tokenDetails,
        firstTransactionDate: holder.first_transaction_date 
          ? new Date(holder.first_transaction_date * 1000).toISOString()
          : null,
        lastTransactionDate: holder.last_transaction_date
          ? new Date(holder.last_transaction_date * 1000).toISOString()
          : null,
        isContract: false // Would need blockchain query to determine accurately
      };
    });

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT cs.address) as count
      FROM current_state cs
      WHERE cs.balance > 0 AND LOWER(cs.contract_address) = ?
    `;
    const countParams = [contractAddress];

    if (search) {
      countQuery += ' AND cs.address LIKE ?';
      countParams.push(`%${search}%`);
    }

    if (minBalance) {
      countQuery += ' AND cs.balance >= ?';
      countParams.push(minBalance);
    }

    const totalCount = (db.prepare(countQuery).get(...countParams) as any).count;

    // Calculate holder distribution
    const distributionQuery = `
      SELECT
        CASE
          WHEN total_balance = 1 THEN '1'
          WHEN total_balance BETWEEN 2 AND 5 THEN '2-5'
          WHEN total_balance BETWEEN 6 AND 10 THEN '6-10'
          WHEN total_balance BETWEEN 11 AND 50 THEN '11-50'
          WHEN total_balance BETWEEN 51 AND 100 THEN '51-100'
          WHEN total_balance > 100 THEN '100+'
        END as range,
        COUNT(*) as holders,
        SUM(total_balance) as total_balance_in_range
      FROM (
        SELECT
          cs.address,
          SUM(cs.balance) as total_balance
        FROM current_state cs
        WHERE cs.balance > 0 AND LOWER(cs.contract_address) = ?
        GROUP BY cs.address
      ) holder_balances
      GROUP BY range
      ORDER BY MIN(total_balance)
    `;

    const distribution = db.prepare(distributionQuery).all(contractAddress) as any[];

    // Calculate whale/dolphin/fish categories
    const whales = holdersWithMetadata.filter(h => parseFloat(h.percentage) > 1).length;
    const dolphins = holdersWithMetadata.filter(h => {
      const pct = parseFloat(h.percentage);
      return pct >= 0.1 && pct <= 1;
    }).length;
    const fish = holdersWithMetadata.filter(h => parseFloat(h.percentage) < 0.1).length;

    // Calculate concentration metrics
    const sortedByBalance = [...holdersWithMetadata].sort((a, b) => 
      BigInt(b.balance) > BigInt(a.balance) ? 1 : -1
    );

    const top10Holdings = sortedByBalance.slice(0, 10).reduce((sum: bigint, holder) =>
      sum + BigInt(holder.balance), BigInt(0)
    );
    const top100Holdings = sortedByBalance.slice(0, 100).reduce((sum: bigint, holder) =>
      sum + BigInt(holder.balance), BigInt(0)
    );

    const top10Percentage = totalSupply > BigInt(0) 
      ? Number((top10Holdings * BigInt(10000)) / totalSupply) / 100
      : 0;
    const top100Percentage = totalSupply > BigInt(0) 
      ? Number((top100Holdings * BigInt(10000)) / totalSupply) / 100
      : 0;

    // Calculate Gini coefficient
    const balances = holdersWithMetadata.map(h => BigInt(h.balance)).sort((a, b) => Number(a - b));
    let giniCoefficient = 0;
    if (balances.length > 1 && totalSupply > BigInt(0)) {
      const n = balances.length;
      let numerator = BigInt(0);
      for (let i = 0; i < n; i++) {
        numerator += BigInt(i + 1) * balances[i];
      }
      giniCoefficient = Number((BigInt(2) * numerator) * BigInt(100) / (BigInt(n) * totalSupply) - BigInt(n + 1) * BigInt(100) / BigInt(n)) / 100;
    }

    return NextResponse.json({
      success: true,
      holders: holdersWithMetadata,
      distribution: {
        whales,
        dolphins,
        fish,
        giniCoefficient: Math.abs(giniCoefficient),
        top10Percentage,
        top100Percentage
      },
      ranges: distribution.map(d => ({
        range: d.range,
        holders: d.holders,
        totalBalance: d.total_balance_in_range.toString(),
        percentage: totalSupply > BigInt(0) 
          ? Number((BigInt(d.total_balance_in_range) * BigInt(10000)) / totalSupply) / 100
          : 0
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil(totalCount / limit)
      },
      contract: {
        address: contractAddress,
        name: contractInfo.name,
        symbol: contractInfo.symbol,
        contractType: contractInfo.contract_type
      },
      summary: {
        totalHolders: totalCount,
        totalSupply: totalSupply.toString(),
        averageHolding: totalCount > 0 ? Number(totalSupply / BigInt(totalCount)) : 0,
        uniqueTokens: contractInfo.contract_type === 'ERC1155' 
          ? (db.prepare(`
              SELECT COUNT(DISTINCT token_id) as count 
              FROM current_state 
              WHERE balance > 0 AND LOWER(contract_address) = ?
            `).get(contractAddress) as any)?.count || 0
          : totalCount // For ERC721, unique tokens = total holders
      }
    });
  } catch (error: any) {
    console.error('Contract holders API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch contract holders'
      },
      { status: 500 }
    );
  }
}