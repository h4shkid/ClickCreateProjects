import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/init';
import DataValidator from '@/lib/validation/data-validator';

function convertToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',');
  const csvRows = data.map((row: any) =>
    headers.map((header: any) => {
      const value = row[header];
      // Escape values containing commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value?.toString() || '';
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'snapshot'; // snapshot, transfers, holders
    const contractAddress = searchParams.get('contract'); // Support any contract address
    const tokenId = searchParams.get('tokenId');
    const tokenIds = searchParams.get('tokenIds');
    const blockNumber = searchParams.get('blockNumber');
    const limit = parseInt(searchParams.get('limit') || '1000000'); // Default to 1 million (no practical limit)
    const fullSeasonMode = searchParams.get('fullSeason') === 'true';
    const seasonName = searchParams.get('season');
    const exactMatch = searchParams.get('exactMatch');

    let csvData = '';
    let filename = '';
    let holders: any[] = [];
    let result: any = null;

    switch (type) {
      case 'snapshot': {
        // Snapshot export uses snapshot API, no direct database access needed
        // Build query parameters for snapshot API
        const params = new URLSearchParams();
        if (tokenId) params.append('tokenId', tokenId);
        if (tokenIds) params.append('tokenIds', tokenIds);
        if (limit) params.append('limit', limit.toString());
        if (fullSeasonMode) params.append('fullSeason', 'true');
        if (seasonName) params.append('season', seasonName);
        if (exactMatch !== null && exactMatch !== undefined) params.append('exactMatch', exactMatch);
        
        // Use the appropriate snapshot API based on contract address
        const baseUrl = request.nextUrl.origin;
        let snapshotUrl;
        
        if (contractAddress) {
          // Use contract-specific API
          snapshotUrl = blockNumber 
            ? `${baseUrl}/api/contracts/${contractAddress}/snapshot/historical?blockNumber=${blockNumber}&${params.toString()}`
            : `${baseUrl}/api/contracts/${contractAddress}/snapshot/current?${params.toString()}`;
        } else {
          // Use legacy internal API (for backward compatibility)
          snapshotUrl = blockNumber 
            ? `${baseUrl}/api/snapshot/historical?blockNumber=${blockNumber}&${params.toString()}`
            : `${baseUrl}/api/snapshot/current?${params.toString()}`;
        }
        
        const response = await fetch(snapshotUrl);
        result = await response.json();
        
        if (!result.success || !result.data) {
          return NextResponse.json(
            {
              success: false,
              error: 'No snapshot data found'
            },
            { status: 404 }
          );
        }
        
        // Extract holders from the response
        holders = result.data.snapshot || result.data.holders || [];

        // Parse requested token IDs for number_of_sets calculation
        let requestedTokenIds: string[] = []
        if (fullSeasonMode && seasonName) {
          // Get season token IDs
          const { getSeasonGroup } = await import('@/lib/constants/season-tokens')
          const seasonGroup = getSeasonGroup(seasonName)
          if (seasonGroup) {
            requestedTokenIds = seasonGroup.tokenIds.map((id: string | number) => id.toString())
          }
        } else if (tokenIds) {
          // Parse token range (e.g., "51-55" → ["51", "52", "53", "54", "55"])
          const parts = tokenIds.split(',').map(id => id.trim()).filter(id => id)
          for (const part of parts) {
            if (part.includes('-')) {
              const [start, end] = part.split('-').map(n => parseInt(n.trim()))
              if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let i = start; i <= end; i++) {
                  requestedTokenIds.push(i.toString())
                }
              }
            } else {
              requestedTokenIds.push(part)
            }
          }
        } else if (tokenId) {
          requestedTokenIds = [tokenId]
        }

        // Include number_of_sets column if specific tokens requested
        const includeNumberOfSets = requestedTokenIds.length > 0;

        // Define headers based on mode
        const csvHeaders = includeNumberOfSets
          ? ['wallet_id', 'number_of_sets', 'total_tokens_held', 'token_ids_held', 'snapshot_time', 'token_id_list']
          : ['wallet_id', 'total_tokens_held', 'token_ids_held', 'snapshot_time', 'token_id_list'];

        if (holders.length === 0) {
          // Return empty CSV with headers only
          csvData = csvHeaders.join(',');
        } else {
          // Initialize database adapter for token breakdown queries
          const { createDatabaseAdapter } = await import('@/lib/database/adapter')
          const db = createDatabaseAdapter()

          const timestamp = result.data.metadata?.timestamp || new Date().toISOString();
          const tokenIdListStr = result.data.metadata?.tokenIdList?.join(';') ||
                                result.data.metadata?.queryTokens?.join(';') ||
                                tokenIds || tokenId || 'all';

          const csvRows = await Promise.all(holders.map(async (holder: any) => {
            const holderAddress = holder.holderAddress || holder.address
            const totalTokensHeld = holder.totalTokensHeld || holder.balance || 0;

            const row: any = {
              wallet_id: holderAddress,
              total_tokens_held: totalTokensHeld,
              token_ids_held: holder.tokensOwned ? holder.tokensOwned.join(';') : holder.tokenIds?.join(';') || '',
              snapshot_time: timestamp,
              token_id_list: tokenIdListStr
            };

            // Calculate number_of_sets if specific tokens requested
            if (includeNumberOfSets && requestedTokenIds.length > 0 && contractAddress) {
              try {
                // Query how many of each requested token the holder owns
                const placeholders = requestedTokenIds.map(() => '?').join(',')
                const isPostgres = !!process.env.POSTGRES_URL
                const balanceCast = isPostgres ? 'balance::numeric' : 'CAST(balance AS INTEGER)'

                let tokenBreakdown: any[]
                if (blockNumber) {
                  // Historical snapshot - reconstruct from events
                  tokenBreakdown = await db.prepare(`
                    SELECT
                      token_id,
                      SUM(balance) as balance
                    FROM (
                      SELECT
                        token_id,
                        COUNT(*) as balance
                      FROM events
                      WHERE contract_address = ?
                      AND to_address = ?
                      AND token_id IN (${placeholders})
                      AND block_number <= ?
                      GROUP BY token_id

                      UNION ALL

                      SELECT
                        token_id,
                        -COUNT(*) as balance
                      FROM events
                      WHERE contract_address = ?
                      AND from_address = ?
                      AND token_id IN (${placeholders})
                      AND block_number <= ?
                      GROUP BY token_id
                    )
                    GROUP BY token_id
                    HAVING SUM(balance) > 0
                  `).all(
                    contractAddress.toLowerCase(),
                    holderAddress.toLowerCase(),
                    ...requestedTokenIds,
                    parseInt(blockNumber),
                    contractAddress.toLowerCase(),
                    holderAddress.toLowerCase(),
                    ...requestedTokenIds,
                    parseInt(blockNumber)
                  ) as any
                } else {
                  // Current snapshot - use current_state table
                  tokenBreakdown = await db.prepare(`
                    SELECT token_id, ${balanceCast} as balance
                    FROM current_state
                    WHERE contract_address = ?
                    AND address = ?
                    AND token_id IN (${placeholders})
                    AND ${balanceCast} > 0
                  `).all(
                    contractAddress.toLowerCase(),
                    holderAddress.toLowerCase(),
                    ...requestedTokenIds
                  ) as any
                }

                // Calculate number_of_sets = minimum balance across all requested tokens
                // If any token is missing (balance = 0), number_of_sets = 0
                if (tokenBreakdown.length < requestedTokenIds.length) {
                  // Missing some tokens
                  row.number_of_sets = 0
                } else {
                  // Find minimum balance across all tokens
                  const minBalance = Math.min(
                    ...tokenBreakdown.map((t: any) => parseInt(t.balance) || 0)
                  )
                  row.number_of_sets = minBalance
                }
              } catch (error) {
                console.error(`Error calculating number_of_sets for ${holderAddress}:`, error)
                row.number_of_sets = 0
              }
            }

            return row;
          }));

          csvData = convertToCSV(csvRows, csvHeaders);
        }
        
        // Generate appropriate filename
        let filenamePrefix = 'snapshot';
        if (fullSeasonMode && seasonName) {
          filenamePrefix = `snapshot_${seasonName}_fullseason`;
        } else if (exactMatch === 'true') {
          filenamePrefix = `snapshot_exact_match`;
        } else if (exactMatch === 'false') {
          filenamePrefix = `snapshot_any_match`;
        } else if (tokenIds) {
          filenamePrefix = `snapshot_multi`;
        } else if (tokenId) {
          filenamePrefix = `snapshot_token${tokenId}`;
        }
        
        filename = `${filenamePrefix}_${blockNumber || 'current'}.csv`;
        break;
      }

      case 'transfers': {
        // Initialize database for direct queries
        const dbManager = getDatabase();
        await dbManager.initialize();
        const db = dbManager.getDb();

        // Export transfer history
        const query = `
          SELECT 
            transaction_hash,
            block_number,
            block_timestamp as timestamp,
            from_address,
            to_address,
            token_id,
            amount,
            operator
          FROM events
          ${tokenId ? 'WHERE token_id = ?' : ''}
          ORDER BY block_number DESC
          LIMIT ?
        `;
        
        const transfers = tokenId
          ? db.prepare(query).all(tokenId, limit) as any
          : db.prepare(query).all(limit) as any;

        const csvHeaders = [
          'transaction_hash',
          'block_number',
          'timestamp',
          'from_address',
          'to_address',
          'token_id',
          'amount',
          'operator'
        ];

        csvData = convertToCSV(transfers as any[], csvHeaders);
        filename = `transfers_${tokenId || 'all'}_${Date.now()}.csv`;
        break;
      }

      case 'holders': {
        // Initialize database for direct queries
        const dbManager = getDatabase();
        await dbManager.initialize();
        const db = dbManager.getDb();

        // Export all holders with their balances
        const query = `
          SELECT 
            address as holder_address,
            token_id,
            balance,
            updated_at as last_updated
          FROM current_state
          WHERE balance > 0
          ${tokenId ? 'AND token_id = ?' : ''}
          ORDER BY balance DESC
          LIMIT ?
        `;
        
        const holders = tokenId
          ? db.prepare(query).all(tokenId, limit) as any
          : db.prepare(query).all(limit) as any;

        const csvHeaders = ['holder_address', 'token_id', 'balance', 'last_updated'];
        csvData = convertToCSV(holders as any[], csvHeaders);
        filename = `holders_${tokenId || 'all'}_${Date.now()}.csv`;
        break;
      }

      case 'analytics': {
        // Initialize database for direct queries
        const dbManager = getDatabase();
        await dbManager.initialize();
        const db = dbManager.getDb();

        // Export analytics summary
        const stats = db.prepare(`
          SELECT 
            token_id,
            COUNT(DISTINCT address) as unique_holders,
            SUM(balance) as total_supply,
            AVG(balance) as avg_balance,
            MAX(balance) as max_balance
          FROM current_state
          WHERE balance > 0
          GROUP BY token_id
          LIMIT ?
        `).all(limit) as any[];

        const csvHeaders = [
          'token_id',
          'unique_holders',
          'total_supply',
          'avg_balance',
          'max_balance'
        ];

        csvData = convertToCSV(stats, csvHeaders);
        filename = `analytics_${Date.now()}.csv`;
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

    // Validate CSV data before returning (optional - can be disabled for performance)
    const includeValidation = searchParams.get('validate') === 'true'
    let validationInfo: any = null

    if (includeValidation && type === 'snapshot') {
      try {
        console.log('🔍 Running CSV export validation...')
        const validator = new DataValidator()

        // Get the original snapshot data for comparison
        const snapshotData = {
          holders: holders,
          totalSupply: result.data?.metadata?.totalSupply || '',
          metadata: result.data?.metadata || {}
        }
        
        const validation = validator.validateCSVExport(snapshotData, csvData)
        validationInfo = {
          isValid: validation.isValid,
          errors: validation.errors,
          warnings: validation.warnings,
          summary: {
            totalRows: validation.details.csvRowCount,
            totalTokens: validation.details.csvTotalTokens,
            totalSets: validation.details.csvTotalSets,
            uniqueWallets: validation.details.uniqueWallets
          }
        }
        
        validator.close()
        
        console.log(`✅ CSV validation complete:`, {
          isValid: validation.isValid,
          errors: validation.errors.length,
          warnings: validation.warnings.length
        })
        
        // Add validation info as comments at the top of CSV if there are issues
        if (!validation.isValid || validation.warnings.length > 0) {
          const validationComments = [
            '# CSV Export Validation Report',
            `# Generated: ${new Date().toISOString()}`,
            `# Valid: ${validation.isValid}`,
            `# Errors: ${validation.errors.length}`,
            `# Warnings: ${validation.warnings.length}`
          ]
          
          if (validation.errors.length > 0) {
            validationComments.push('# Errors:')
            validation.errors.forEach(error => {
              validationComments.push(`# - ${error}`)
            })
          }
          
          if (validation.warnings.length > 0) {
            validationComments.push('# Warnings:')
            validation.warnings.forEach(warning => {
              validationComments.push(`# - ${warning}`)
            })
          }
          
          validationComments.push('# End Validation Report', '')
          csvData = validationComments.join('\n') + csvData
        }
        
      } catch (validationError: any) {
        console.warn('⚠️ CSV validation failed:', validationError)
        // Add warning comment to CSV
        const warningComment = `# Warning: CSV validation failed - ${validationError instanceof Error ? validationError.message : 'Unknown error'}\n`
        csvData = warningComment + csvData
      }
    }

    // Return CSV file
    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
        ...(validationInfo && {
          'X-Validation-Status': validationInfo.isValid ? 'valid' : 'invalid',
          'X-Validation-Errors': validationInfo.errors.length.toString(),
          'X-Validation-Warnings': validationInfo.warnings.length.toString()
        })
      }
    });
  } catch (error: any) {
    console.error('CSV export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to export CSV'
      },
      { status: 500 }
    );
  }
}