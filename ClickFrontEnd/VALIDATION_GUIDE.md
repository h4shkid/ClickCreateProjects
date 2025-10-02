# Data Validation System

This comprehensive validation system ensures the accuracy of your NFT snapshot data and CSV exports. Use these tools to verify data integrity before making important business decisions.

## Quick Start

### 1. Validate Current Data
```bash
# Run full validation of current state
npx tsx scripts/validate-data.ts --verbose

# Quick balance check
npx tsx scripts/validate-data.ts --type balance
```

### 2. Web Interface Validation
1. Go to `/snapshot` page
2. Generate a snapshot
3. Click "Validate Data" button
4. Review validation results in the UI

### 3. CSV Export with Validation
Add `?validate=true` parameter to CSV exports:
```
/api/export/csv?type=snapshot&validate=true
```

## Validation Types

### Balance Validation
Verifies holder balances by recalculating from blockchain events:
- ✅ Checks database balances vs calculated balances
- ✅ Validates total supply consistency
- ✅ Identifies balance discrepancies

```bash
npx tsx scripts/validate-data.ts --type balance
```

### Block Range Validation
Ensures completeness of blockchain event data:
- ✅ Checks for missing blocks in event data
- ✅ Validates event ordering and timestamps
- ✅ Identifies duplicate events

```bash
npx tsx scripts/validate-data.ts --type blocks --start-block 18400000 --end-block 18500000
```

### Snapshot Validation
Cross-validates snapshot data against live blockchain:
- ✅ Verifies block timestamps
- ✅ Checks snapshot accuracy
- ✅ Validates metadata consistency

```bash
npx tsx scripts/validate-data.ts --type snapshot --block 18500000
```

### CSV Export Validation
Validates CSV data structure and business logic:
- ✅ Checks header consistency
- ✅ Validates number_of_sets calculations
- ✅ Ensures no duplicate addresses
- ✅ Verifies total token counts

```bash
npx tsx scripts/validate-data.ts --type csv --csv ./snapshot_export.csv
```

## API Endpoints

### Validation API
```
GET /api/contracts/[address]/validate?type=full&blockNumber=123456
```

**Parameters:**
- `type`: `full`, `balance`, `blocks`, `snapshot`
- `blockNumber`: Optional block number for historical validation
- `startBlock`/`endBlock`: For block range validation

**Response:**
```json
{
  "success": true,
  "data": {
    "validation": {
      "isValid": true,
      "errors": [],
      "warnings": [],
      "details": {
        "totalHolders": 1234,
        "totalSupplyValidated": true
      }
    }
  }
}
```

### CSV Validation
```
POST /api/contracts/[address]/validate
Content-Type: application/json

{
  "snapshotData": { ... },
  "csvData": "wallet_id,number_of_sets,total_tokens_held..."
}
```

## Validation Results

### Status Indicators
- **✅ GOOD**: No errors, minor warnings acceptable
- **⚠️ FAIR**: Some warnings, review recommended
- **❌ POOR**: Critical errors, fix before export

### Common Issues & Solutions

#### Balance Discrepancies
**Problem**: Database balances don't match calculated balances
**Solution**: 
```bash
npx tsx scripts/rebuild-state.js
```

#### Missing Events
**Problem**: Gaps in blockchain event data
**Solution**:
```bash
npx tsx scripts/sync-blockchain.ts
```

#### Timestamp Issues
**Problem**: Block timestamps seem incorrect
**Solution**: Verify provider connection and resync recent blocks

#### CSV Data Issues
**Problem**: number_of_sets equals total_tokens_held incorrectly
**Solution**: Check business logic in CSV export function

## Frontend Integration

### Automatic Validation
Historical snapshots now include validation info automatically:
```typescript
// Validation info included in snapshot response
response.data.metadata.validation = {
  dataIntegrity: {
    isValid: true,
    balanceErrors: 0,
    snapshotErrors: 0,
    totalSupplyValidated: true
  }
}
```

### Manual Validation Button
Users can click "Validate Data" to run comprehensive checks on any snapshot.

### CSV Export Enhancement
CSV exports include validation comments when issues are detected:
```csv
# CSV Export Validation Report
# Generated: 2024-01-15T10:30:00.000Z
# Valid: false
# Errors: 2
# Warnings: 1
# Errors:
# - Found 5 holders with balance discrepancies
# End Validation Report

wallet_id,number_of_sets,total_tokens_held...
```

## Best Practices

### Before Important Exports
1. Run full validation: `npx tsx scripts/validate-data.ts --verbose`
2. Fix any errors found
3. Re-run validation to confirm fixes
4. Export with validation enabled

### Regular Health Checks
1. Weekly: Run balance validation
2. After major syncs: Run block range validation
3. Before quarterly reports: Run comprehensive validation

### Troubleshooting
1. Check validation logs for specific error details
2. Compare validation results before/after sync operations
3. Use CSV validation to verify export accuracy
4. Cross-reference with blockchain explorers for critical data

## Files Created

- `lib/validation/data-validator.ts` - Core validation utilities
- `app/api/contracts/[address]/validate/route.ts` - Validation API endpoints
- `scripts/validate-data.ts` - Command-line validation tool
- Enhanced historical snapshot API with auto-validation
- Enhanced CSV export with validation checks
- Frontend validation UI in snapshot page

## Performance Notes

- Validation is optional for CSV exports (add `?validate=true`)
- Large datasets may take 30-60 seconds for full validation
- Use specific validation types for faster checks
- Validation runs automatically for historical snapshots