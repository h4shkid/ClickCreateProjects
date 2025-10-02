import axios from 'axios';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3001/api';
const OUTPUT_DIR = './test-csv-outputs';

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

interface TestCase {
  name: string;
  snapshotParams: string;
  exportParams: string;
  expectedToHaveData: boolean;
}

const testCases: TestCase[] = [
  // 1. Single token ID
  {
    name: 'single-token-1',
    snapshotParams: 'tokenId=1',
    exportParams: 'tokenId=1',
    expectedToHaveData: true
  },
  
  // 2. Multiple token IDs with exact match YES
  {
    name: 'multi-tokens-exact-yes',
    snapshotParams: 'tokenIds=1,2,3&exactMatch=true',
    exportParams: 'tokenIds=1,2,3',
    expectedToHaveData: false // Likely no one has exactly these 3
  },
  
  // 3. Multiple token IDs with exact match NO (any match)
  {
    name: 'multi-tokens-exact-no',
    snapshotParams: 'tokenIds=1,2,3&exactMatch=false',
    exportParams: 'tokenIds=1,2,3',
    expectedToHaveData: true
  },
  
  // 4. Season 1 regular snapshot
  {
    name: 'season1-regular',
    snapshotParams: 'tokenIds=' + [...Array(50)].map((_, i) => i + 2).join(','),
    exportParams: 'tokenIds=' + [...Array(50)].map((_, i) => i + 2).join(','),
    expectedToHaveData: true
  },
  
  // 5. Season 1 full season mode
  {
    name: 'season1-full-season',
    snapshotParams: 'fullSeason=true&season=season1',
    exportParams: 'fullSeason=true&season=season1',
    expectedToHaveData: true
  },
  
  // 6. Season 2 regular snapshot
  {
    name: 'season2-regular',
    snapshotParams: 'tokenIds=' + [...Array(39)].map((_, i) => i + 53).join(','),
    exportParams: 'tokenIds=' + [...Array(39)].map((_, i) => i + 53).join(','),
    expectedToHaveData: true
  },
  
  // 7. Season 2 full season mode
  {
    name: 'season2-full-season',
    snapshotParams: 'fullSeason=true&season=season2',
    exportParams: 'fullSeason=true&season=season2',
    expectedToHaveData: true
  },
  
  // 8. Season 3 regular snapshot
  {
    name: 'season3-regular',
    snapshotParams: 'tokenIds=92,93,94,95,96',
    exportParams: 'tokenIds=92,93,94,95,96',
    expectedToHaveData: true
  },
  
  // 9. Season 3 full season mode
  {
    name: 'season3-full-season',
    snapshotParams: 'fullSeason=true&season=season3',
    exportParams: 'fullSeason=true&season=season3',
    expectedToHaveData: true
  },
  
  // 10. All holders (no filter)
  {
    name: 'all-holders',
    snapshotParams: '',
    exportParams: '',
    expectedToHaveData: true
  },
  
  // 11. With limit and offset
  {
    name: 'limited-results',
    snapshotParams: 'tokenId=1&limit=10&offset=0',
    exportParams: 'tokenId=1',
    expectedToHaveData: true
  },
  
  // 12. Season 1 with exact match YES
  {
    name: 'season1-exact-yes',
    snapshotParams: 'tokenIds=' + [...Array(50)].map((_, i) => i + 2).join(',') + '&exactMatch=true',
    exportParams: 'tokenIds=' + [...Array(50)].map((_, i) => i + 2).join(','),
    expectedToHaveData: false // Very unlikely someone has exactly all Season 1
  },
  
  // 13. Season 1 with exact match NO
  {
    name: 'season1-exact-no',
    snapshotParams: 'tokenIds=' + [...Array(50)].map((_, i) => i + 2).join(',') + '&exactMatch=false',
    exportParams: 'tokenIds=' + [...Array(50)].map((_, i) => i + 2).join(','),
    expectedToHaveData: true
  }
];

async function testSnapshot(testCase: TestCase) {
  console.log(`\n🔍 Testing: ${testCase.name}`);
  console.log(`   Snapshot params: ${testCase.snapshotParams || '(none)'}`);
  
  try {
    // 1. Test snapshot generation
    const snapshotUrl = `${API_BASE}/snapshot/current?${testCase.snapshotParams}`;
    console.log(`   📸 Fetching snapshot...`);
    const snapshotRes = await axios.get(snapshotUrl);
    
    if (!snapshotRes.data.success) {
      console.error(`   ❌ Snapshot failed: ${snapshotRes.data.error}`);
      return false;
    }
    
    const holderCount = snapshotRes.data.data?.totalHolders || 
                        snapshotRes.data.data?.holders?.length || 
                        snapshotRes.data.data?.snapshot?.length || 0;
    
    console.log(`   ✅ Snapshot succeeded: ${holderCount} holders found`);
    
    // 2. Test CSV export
    const csvUrl = `${API_BASE}/export/csv?${testCase.exportParams}`;
    console.log(`   📄 Fetching CSV export...`);
    const csvRes = await axios.get(csvUrl, {
      responseType: 'text'
    });
    
    // Save CSV to file for inspection
    const csvPath = path.join(OUTPUT_DIR, `${testCase.name}.csv`);
    fs.writeFileSync(csvPath, csvRes.data);
    
    // Validate CSV
    const lines = csvRes.data.split('\n').filter((line: string) => line.trim());
    const hasHeader = lines[0]?.includes('holder_address');
    const dataRows = hasHeader ? lines.length - 1 : lines.length; // Exclude header if present
    
    console.log(`   📊 CSV export: ${dataRows} data rows (${lines.length} total lines)`);
    
    if (!hasHeader) {
      console.error(`   ❌ CSV missing header!`);
      return false;
    }
    
    if (testCase.expectedToHaveData && dataRows === 0) {
      console.error(`   ⚠️  Expected data but CSV is empty!`);
      return false;
    }
    
    if (!testCase.expectedToHaveData && dataRows > 0) {
      console.log(`   ℹ️  Not expected to have data but found ${dataRows} rows`);
    }
    
    // Check CSV structure
    if (dataRows > 0) {
      const firstDataLine = lines[1];
      const columns = firstDataLine.split(',');
      if (columns.length < 4) {
        console.error(`   ❌ CSV malformed - expected at least 4 columns, got ${columns.length}`);
        return false;
      }
    }
    
    console.log(`   ✅ CSV export valid and saved to ${csvPath}`);
    return true;
    
  } catch (error: any) {
    console.error(`   ❌ Test failed with error: ${error.message || error}`);
    if (error.code === 'ECONNREFUSED') {
      console.error(`      Connection refused - is the server running on port 3000?`);
    }
    if (error.response?.data) {
      console.error(`      Response: ${JSON.stringify(error.response.data)}`);
    }
    if (error.response?.status) {
      console.error(`      Status: ${error.response.status}`);
    }
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting comprehensive CSV export tests...');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  
  const results: { name: string; success: boolean }[] = [];
  
  for (const testCase of testCases) {
    const success = await testSnapshot(testCase);
    results.push({ name: testCase.name, success });
    
    // Small delay between tests to not overwhelm the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  results.forEach(r => {
    console.log(`${r.success ? '✅' : '❌'} ${r.name}`);
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed} (${((passed/results.length)*100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed/results.length)*100).toFixed(1)}%)`);
  console.log('='.repeat(60));
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed! Check the output above for details.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

// Run tests
runAllTests().catch(console.error);