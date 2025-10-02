NFT Snapshot Tool - Build Instructions & Verification Checklist
Project Build Methodology
Critical Rules

Never proceed to the next step until current step is 100% verified
Each feature must be tested with real data before moving forward
If a component fails verification, fix it completely before continuing
Document any issues and their solutions
Keep a build log with timestamps and test results

Phase 1: Project Foundation & Setup
Timeline: Day 1-2
Goal: Establish working development environment
Step 1.1: Project Initialization

 Create new Next.js project with TypeScript
 VERIFY: Run npm run dev and access http://localhost:3000
 VERIFY: TypeScript compilation works without errors
 TEST: Create a test component and verify hot reload works

Step 1.2: Environment Configuration

 Create .env.local file with all required variables
 Add Alchemy API key
 Add QuickNode endpoint
 Add contract address and chain ID
 VERIFY: Create test file to console.log each env variable
 TEST: Ensure no undefined values
 TEST: Verify API keys are valid format

Step 1.3: Install Core Dependencies

 Install ethers.js
 Install better-sqlite3
 Install required UI libraries
 VERIFY: No npm vulnerabilities or conflicts
 TEST: Import each library in a test file
 TEST: Verify versions are compatible

Step 1.4: Project Structure Setup

 Create all required directories (lib, components, data, etc.)
 Setup path aliases in tsconfig.json
 VERIFY: Can import from @/lib, @/components
 TEST: Create dummy file in each folder and import successfully

Step 1.5: Database Setup

 Create SQLite database file
 Run schema creation script
 VERIFY: Database file exists in data folder
 TEST: Connect to database and verify all tables exist
 TEST: Insert test record and retrieve it
 TEST: Verify indexes are created

CHECKPOINT 1: Stop here and verify everything works. Do not proceed until all checks pass.

Phase 2: Blockchain Connection & Event Fetching
Timeline: Day 3-5
Goal: Successfully connect and fetch blockchain data
Step 2.1: RPC Provider Connection

 Create provider initialization module
 Implement Alchemy connection
 Implement QuickNode fallback
 VERIFY: Can connect to mainnet
 TEST: Fetch current block number
 TEST: Get network chain ID
 TEST: Provider switching works on failure

Step 2.2: Smart Contract Interface

 Add ERC-1155 ABI
 Create contract instance
 VERIFY: Contract address is valid
 TEST: Call a read function (e.g., name, uri)
 TEST: Verify contract is ERC-1155
 TEST: Get total supply or similar metric

Step 2.3: Event Filter Setup

 Create TransferSingle event filter
 Create TransferBatch event filter
 VERIFY: Filters are properly formatted
 TEST: Query last 100 blocks for events
 TEST: Successfully parse at least 1 event
 TEST: Event data structure is correct

Step 2.4: Historical Event Fetching

 Implement block range chunking (1000 blocks per query)
 Add retry logic for failed queries
 Add progress tracking
 VERIFY: Can fetch from specific block range
 TEST: Fetch 10,000 blocks of history
 TEST: Verify no blocks are skipped
 TEST: All events are captured
 TEST: Retry works on RPC timeout

Step 2.5: Event Parsing & Storage

 Parse event log data
 Extract: from, to, tokenId, amount, block, timestamp
 Store in database
 VERIFY: Data types are correct (BigInt handling)
 TEST: Parse 100 real events
 TEST: Verify database has no duplicate events
 TEST: Timestamps are accurate
 TEST: Zero address (mint/burn) handled correctly

CHECKPOINT 2: Verify you can fetch and store at least 1000 real events correctly.

Phase 3: State Calculation & Snapshot Generation
Timeline: Day 6-8
Goal: Accurately calculate holder balances
Step 3.1: Balance Calculation Logic

 Create balance aggregation function
 Handle transfers in/out
 Handle mints and burns
 VERIFY: Math is accurate with BigInt
 TEST: Calculate balance for single address
 TEST: Verify against Etherscan
 TEST: Handle edge cases (self-transfers)

Step 3.2: Current Snapshot Generator

 Query all holders for specific token IDs
 Calculate current balances
 Filter zero balances
 VERIFY: Snapshot data structure is correct
 TEST: Generate snapshot for 1 token ID
 TEST: Verify holder count matches blockchain
 TEST: Sum of balances equals total supply
 TEST: Compare with Etherscan holders tab

Step 3.3: Historical Snapshot Logic

 Replay events up to specific block
 Build point-in-time state
 VERIFY: Historical calculation is accurate
 TEST: Generate snapshot for 1 week ago
 TEST: Generate snapshot for 1 month ago
 TEST: Verify with historical blockchain data
 TEST: Test with known historical holder

Step 3.4: Multi-Token Support

 Handle multiple token IDs simultaneously
 Aggregate holdings per address
 VERIFY: Correctly sums multiple tokens
 TEST: Snapshot with 5 different token IDs
 TEST: Verify address has correct total
 TEST: Performance is acceptable

Step 3.5: Snapshot Caching

 Store generated snapshots
 Implement cache key strategy
 Add cache expiration logic
 VERIFY: Cache retrieval works
 TEST: Generate same snapshot twice
 TEST: Second request is faster
 TEST: Cache invalidation works

CHECKPOINT 3: Generate a snapshot and manually verify 10 random addresses on Etherscan.

Phase 4: WebSocket Real-time Updates
Timeline: Day 9-11
Goal: Live monitoring of blockchain events
Step 4.1: WebSocket Connection

 Establish WebSocket connection to Alchemy
 Implement connection management
 VERIFY: Connection establishes successfully
 TEST: Connection stays alive for 10 minutes
 TEST: Receives ping/pong heartbeats

Step 4.2: Event Subscription

 Subscribe to contract events
 Filter for specific token IDs
 VERIFY: Subscription is accepted
 TEST: Receive at least 1 real event
 TEST: Event format matches expected

Step 4.3: Real-time State Updates

 Process incoming events
 Update database in real-time
 VERIFY: State updates correctly
 TEST: Make test transfer on testnet
 TEST: Verify update appears in database
 TEST: Snapshot reflects new state

Step 4.4: Reconnection Logic

 Implement automatic reconnection
 Add exponential backoff
 Queue events during disconnect
 VERIFY: Reconnection works
 TEST: Manually disconnect and verify reconnect
 TEST: No events lost during disconnection
 TEST: Backoff delays work correctly

Step 4.5: Event Broadcasting

 Create internal event emitter
 Broadcast updates to frontend
 VERIFY: Events propagate correctly
 TEST: Multiple subscribers receive updates
 TEST: Unsubscribe works properly

CHECKPOINT 4: Monitor real-time events for 1 hour and verify all are captured.

Phase 5: NFT Metadata & Image Management
Timeline: Day 12-14
Goal: Complete metadata and image handling
Step 5.1: Metadata API Integration

 Setup Alchemy NFT API client
 Implement metadata fetching
 VERIFY: API connection works
 TEST: Fetch metadata for 10 tokens
 TEST: Handle missing metadata gracefully
 TEST: Rate limiting is respected

Step 5.2: Metadata Parsing

 Parse JSON metadata
 Extract name, description, image, attributes
 VERIFY: All fields extracted correctly
 TEST: Parse 50 different metadata formats
 TEST: Handle malformed JSON
 TEST: IPFS URLs converted correctly

Step 5.3: Image Downloading

 Download images from URLs
 Handle IPFS gateway URLs
 Implement retry logic
 VERIFY: Images download successfully
 TEST: Download 100 images
 TEST: Various formats work (PNG, GIF, SVG)
 TEST: Failed downloads retry correctly

Step 5.4: Image Processing

 Generate thumbnails
 Convert to optimized formats
 VERIFY: Thumbnails generate correctly
 TEST: Process 50 images
 TEST: Output quality is acceptable
 TEST: File sizes are optimized

Step 5.5: Storage Management

 Organize file structure
 Implement cleanup logic
 VERIFY: Files stored correctly
 TEST: Can retrieve stored images
 TEST: Cleanup removes unused files
 TEST: Storage limits enforced

CHECKPOINT 5: Display gallery of 100 NFTs with all metadata and images loading correctly.

Phase 6: API Development
Timeline: Day 15-17
Goal: Complete REST API implementation
Step 6.1: API Route Structure

 Create all API route files
 Setup routing logic
 VERIFY: All routes accessible
 TEST: Each route returns 200 OK
 TEST: 404 for non-existent routes

Step 6.2: Snapshot Endpoints

 Implement /api/snapshot/current
 Implement /api/snapshot/historical
 VERIFY: Correct data returned
 TEST: Various parameter combinations
 TEST: Error handling for invalid params
 TEST: Response time < 5 seconds

Step 6.3: NFT Endpoints

 Implement /api/nft/metadata/[id]
 Implement /api/nft/gallery
 VERIFY: Pagination works
 TEST: Fetch individual metadata
 TEST: Gallery returns correct page
 TEST: Filters work properly

Step 6.4: Export Endpoints

 Implement CSV export
 Implement JSON export
 VERIFY: Files generate correctly
 TEST: Export 1000+ holders
 TEST: CSV opens in Excel
 TEST: JSON is valid format

Step 6.5: Error Handling

 Add global error handler
 Implement proper status codes
 VERIFY: Errors return correct format
 TEST: Database connection failure
 TEST: Invalid input handling
 TEST: RPC failure handling

CHECKPOINT 6: Test all API endpoints with Postman/Insomnia and verify responses.

Phase 7: Frontend Implementation
Timeline: Day 18-22
Goal: Complete user interface
Step 7.1: Layout & Navigation

 Create layout component
 Implement navigation
 Apply black/orange theme
 VERIFY: Navigation works
 TEST: All pages accessible
 TEST: Theme applied correctly
 TEST: Responsive on mobile

Step 7.2: Dashboard Page

 Create stats cards
 Add activity feed
 Implement charts
 VERIFY: Data displays correctly
 TEST: Real-time updates work
 TEST: Numbers are accurate
 TEST: Charts render properly

Step 7.3: NFT Gallery

 Build gallery grid
 Add filters and search
 Implement selection
 VERIFY: Images load
 TEST: Pagination works
 TEST: Selection state maintained
 TEST: Filters apply correctly

Step 7.4: Snapshot Builder

 Create form interface
 Add date pickers
 Build preview table
 VERIFY: Form submission works
 TEST: Date range selection
 TEST: Preview updates correctly
 TEST: Export triggers download

Step 7.5: Real-time Features

 Connect WebSocket to frontend
 Show live updates
 Add notifications
 VERIFY: Updates appear instantly
 TEST: Multiple tabs stay in sync
 TEST: Notifications trigger correctly

CHECKPOINT 7: Complete user flow from gallery selection to snapshot export.

Phase 8: Analytics & Advanced Features
Timeline: Day 23-25
Goal: Add analytics and polish
Step 8.1: Analytics Dashboard

 Implement distribution charts
 Add holder metrics
 Create activity heatmap
 VERIFY: Calculations are accurate
 TEST: Charts update with new data
 TEST: Interactions work (hover, click)

Step 8.2: Merkle Tree Generation

 Implement merkle tree algorithm
 Generate proofs
 VERIFY: Root hash is correct
 TEST: Generate tree for 100 addresses
 TEST: Proofs verify correctly
 TEST: Compatible with smart contracts

Step 8.3: Performance Optimization

 Add lazy loading
 Implement virtual scrolling
 Optimize queries
 VERIFY: Page load < 3 seconds
 TEST: Handle 10,000 holders
 TEST: Smooth scrolling with 1000 items

Step 8.4: Error Recovery

 Add retry mechanisms
 Implement fallbacks
 VERIFY: Graceful degradation
 TEST: Disable APIs and test fallbacks
 TEST: Network interruption recovery

Step 8.5: Final Testing

 Complete end-to-end test
 Load test with large dataset
 VERIFY: All features work together
 TEST: 1 hour continuous operation
 TEST: No memory leaks
 TEST: Data consistency maintained

CHECKPOINT 8: Run full system for 24 hours with real data.

Critical Verification Points
Data Accuracy Checks

Balance Verification

 Select 20 random addresses
 Compare balances with Etherscan
 Must match 100%


Historical Accuracy

 Pick 5 historical dates
 Generate snapshots
 Verify against blockchain


Real-time Accuracy

 Monitor 10 transfers
 Verify all are captured
 Check state updates



Performance Benchmarks

Response Times

 Current snapshot: < 3 seconds
 Historical snapshot: < 10 seconds
 API responses: < 1 second


Capacity Tests

 Handle 100,000 events
 Support 10,000 holders
 Process 1,000 token IDs



Integration Tests

Full Flow Test

 Select NFTs from gallery
 Generate snapshot
 Export to CSV
 Verify data accuracy


Real-time Flow

 Start monitoring
 Trigger test transfer
 Verify UI updates
 Check database state



Failure Recovery Procedures
If RPC Connection Fails

Check API key validity
Verify network connectivity
Test with alternative provider
Check rate limits

If Database Errors Occur

Check disk space
Verify schema integrity
Rebuild indexes
Restore from backup

If Snapshots Are Incorrect

Clear cache
Re-sync blockchain events
Verify calculation logic
Compare with reference implementation

Documentation Requirements
After Each Phase

 Document any deviations from plan
 Record performance metrics
 Note any bugs and fixes
 Update time estimates

Final Documentation

 Complete API documentation
 User guide
 Deployment instructions
 Troubleshooting guide

Success Criteria
The project is considered complete when:

All checkpoints pass verification
System runs for 48 hours without errors
Data accuracy is 100% verified
All features work as specified
Performance meets benchmarks

DO NOT mark as complete until every single checkbox is verified!