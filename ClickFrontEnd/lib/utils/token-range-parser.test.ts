/**
 * Test file for token-range-parser
 * Run with: npx tsx lib/utils/token-range-parser.test.ts
 */

import { parseTokenRanges, formatTokensToRanges } from './token-range-parser'

console.log('🧪 Testing Token Range Parser\n')

// Test 1: Simple range
console.log('Test 1: Simple range "1-10"')
const test1 = parseTokenRanges('1-10')
console.log('✅ Result:', test1)
console.log('Expected 10 tokens:', test1.parsedCount === 10 ? '✅ PASS' : '❌ FAIL')
console.log('First token is 1:', test1.tokens[0] === 1 ? '✅ PASS' : '❌ FAIL')
console.log('Last token is 10:', test1.tokens[9] === 10 ? '✅ PASS' : '❌ FAIL')
console.log()

// Test 2: Mixed format
console.log('Test 2: Mixed format "1-5,10,15-17"')
const test2 = parseTokenRanges('1-5,10,15-17')
console.log('✅ Result:', test2)
console.log('Expected 9 tokens:', test2.parsedCount === 9 ? '✅ PASS' : '❌ FAIL')
console.log('Contains [1,2,3,4,5,10,15,16,17]')
console.log()

// Test 3: With spaces
console.log('Test 3: With spaces "1-10, 15, 20-25"')
const test3 = parseTokenRanges('1-10, 15, 20-25')
console.log('✅ Result:', test3)
console.log('Expected 17 tokens:', test3.parsedCount === 17 ? '✅ PASS' : '❌ FAIL')
console.log()

// Test 4: Single tokens
console.log('Test 4: Single tokens "1,2,3,4,5"')
const test4 = parseTokenRanges('1,2,3,4,5')
console.log('✅ Result:', test4)
console.log('Expected 5 tokens:', test4.parsedCount === 5 ? '✅ PASS' : '❌ FAIL')
console.log()

// Test 5: Duplicates should be removed
console.log('Test 5: Duplicates "1-5,3,4,5-8"')
const test5 = parseTokenRanges('1-5,3,4,5-8')
console.log('✅ Result:', test5)
console.log('Expected 8 unique tokens:', test5.parsedCount === 8 ? '✅ PASS' : '❌ FAIL')
console.log('Tokens:', test5.tokens)
console.log()

// Test 6: Invalid range (reversed)
console.log('Test 6: Invalid range "10-1"')
const test6 = parseTokenRanges('10-1')
console.log('❌ Result:', test6)
console.log('Should fail:', !test6.success ? '✅ PASS' : '❌ FAIL')
console.log('Error:', test6.error)
console.log()

// Test 7: Invalid input
console.log('Test 7: Invalid input "abc"')
const test7 = parseTokenRanges('abc')
console.log('❌ Result:', test7)
console.log('Should fail:', !test7.success ? '✅ PASS' : '❌ FAIL')
console.log('Error:', test7.error)
console.log()

// Test 8: Negative numbers
console.log('Test 8: Negative numbers "-5-10"')
const test8 = parseTokenRanges('-5-10')
console.log('❌ Result:', test8)
console.log('Should fail:', !test8.success ? '✅ PASS' : '❌ FAIL')
console.log('Error:', test8.error)
console.log()

// Test 9: Empty input
console.log('Test 9: Empty input ""')
const test9 = parseTokenRanges('')
console.log('✅ Result:', test9)
console.log('Should succeed with 0 tokens:', test9.success && test9.parsedCount === 0 ? '✅ PASS' : '❌ FAIL')
console.log()

// Test 10: Large range
console.log('Test 10: Large range "1-1000"')
const test10 = parseTokenRanges('1-1000')
console.log('✅ Result (truncated):', { ...test10, tokens: `[${test10.tokens[0]}...${test10.tokens[test10.tokens.length - 1]}]` })
console.log('Expected 1000 tokens:', test10.parsedCount === 1000 ? '✅ PASS' : '❌ FAIL')
console.log()

// Test 11: Format back to ranges
console.log('Test 11: Format back to ranges')
const tokens = [1, 2, 3, 4, 5, 10, 15, 16, 17, 18, 20]
const formatted = formatTokensToRanges(tokens)
console.log('Input tokens:', tokens)
console.log('Formatted:', formatted)
console.log('Expected "1-5,10,15-18,20":', formatted === '1-5,10,15-18,20' ? '✅ PASS' : '❌ FAIL')
console.log()

// Test 12: Too large range (should fail)
console.log('Test 12: Too large range "1-20000"')
const test12 = parseTokenRanges('1-20000')
console.log('❌ Result:', test12)
console.log('Should fail:', !test12.success ? '✅ PASS' : '❌ FAIL')
console.log('Error:', test12.error)
console.log()

console.log('🎉 All tests completed!')
