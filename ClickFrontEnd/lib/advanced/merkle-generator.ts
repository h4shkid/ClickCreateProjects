import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';
import { getDatabase } from '../database/init';

export interface MerkleLeaf {
  address: string;
  amount: string;
  index: number;
}

export interface MerkleProof {
  address: string;
  amount: string;
  proof: string[];
  index: number;
}

export interface MerkleTreeData {
  root: string;
  leaves: MerkleLeaf[];
  proofs: Map<string, MerkleProof>;
  ipfsHash?: string;
  metadata: {
    totalAmount: string;
    totalRecipients: number;
    generatedAt: Date;
    tokenId?: string;
    blockNumber?: number;
  };
}

export class MerkleGenerator {
  private db;

  constructor() {
    const dbManager = getDatabase();
    this.db = dbManager.getDb();
  }

  /**
   * Generate merkle tree for airdrop distribution
   */
  async generateMerkleTree(
    recipients: Array<{ address: string; amount: string }>,
    options: {
      tokenId?: string;
      blockNumber?: number;
      sortByAmount?: boolean;
    } = {}
  ): Promise<MerkleTreeData> {
    console.log(`🌳 Generating merkle tree for ${recipients.length} recipients...`);

    // Sort recipients if requested (helps with gas optimization)
    if (options.sortByAmount) {
      recipients.sort((a, b) => {
        const amountA = BigInt(a.amount);
        const amountB = BigInt(b.amount);
        return amountB > amountA ? 1 : -1;
      });
    }

    // Create leaves with index
    const leaves: MerkleLeaf[] = recipients.map((recipient, index) => ({
      address: recipient.address.toLowerCase(),
      amount: recipient.amount,
      index
    }));

    // Generate leaf hashes
    const leafHashes = leaves.map(leaf => 
      this.generateLeafHash(leaf.address, leaf.amount, leaf.index)
    );

    // Create merkle tree
    const tree = new MerkleTree(leafHashes, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    // Generate proofs for all leaves
    const proofs = new Map<string, MerkleProof>();
    leaves.forEach((leaf, index) => {
      const proof = tree.getHexProof(leafHashes[index]);
      proofs.set(leaf.address, {
        address: leaf.address,
        amount: leaf.amount,
        proof,
        index
      });
    });

    // Calculate total amount
    const totalAmount = recipients.reduce(
      (sum, r) => sum + BigInt(r.amount),
      BigInt(0)
    ).toString();

    // Store merkle tree data in database
    await this.storeMerkleTree(root, leaves, options);

    const merkleData: MerkleTreeData = {
      root,
      leaves,
      proofs,
      metadata: {
        totalAmount,
        totalRecipients: recipients.length,
        generatedAt: new Date(),
        tokenId: options.tokenId,
        blockNumber: options.blockNumber
      }
    };

    console.log(`✅ Merkle tree generated with root: ${root}`);
    return merkleData;
  }

  /**
   * Generate merkle tree from current snapshot
   */
  async generateFromSnapshot(
    tokenId?: string,
    minBalance?: string
  ): Promise<MerkleTreeData> {
    console.log('📸 Generating merkle tree from current snapshot...');

    // Get current holders from database
    let query = `
      SELECT address, balance
      FROM current_state
      WHERE balance > 0
    `;
    const params: any[] = [];

    if (tokenId) {
      query += ' AND token_id = ?';
      params.push(tokenId);
    }

    if (minBalance) {
      query += ' AND CAST(balance AS INTEGER) >= ?';
      params.push(minBalance);
    }

    query += ' ORDER BY CAST(balance AS INTEGER) DESC';

    const holders = this.db.prepare(query).all(...params) as Array<{
      address: string;
      balance: string;
    }>;

    const recipients = holders.map(h => ({
      address: h.address,
      amount: h.balance
    }));

    return this.generateMerkleTree(recipients, { tokenId });
  }

  /**
   * Verify a merkle proof
   */
  verifyProof(
    root: string,
    address: string,
    amount: string,
    index: number,
    proof: string[]
  ): boolean {
    const leaf = this.generateLeafHash(address.toLowerCase(), amount, index);
    const tree = new MerkleTree([], keccak256, { sortPairs: true });
    return tree.verify(proof, leaf, root);
  }

  /**
   * Generate leaf hash for merkle tree
   */
  private generateLeafHash(address: string, amount: string, index: number): Buffer {
    // Pack the data similar to Solidity's abi.encodePacked
    const packed = Buffer.concat([
      Buffer.from(address.slice(2), 'hex'), // Remove 0x prefix
      Buffer.from(BigInt(amount).toString(16).padStart(64, '0'), 'hex'),
      Buffer.from(index.toString(16).padStart(8, '0'), 'hex')
    ]);
    return keccak256(packed);
  }

  /**
   * Store merkle tree in database
   */
  private async storeMerkleTree(
    root: string,
    leaves: MerkleLeaf[],
    options: any
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO merkle_trees (
        root,
        token_id,
        block_number,
        recipients_count,
        total_amount,
        leaves_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const totalAmount = leaves.reduce(
      (sum, leaf) => sum + BigInt(leaf.amount),
      BigInt(0)
    ).toString();

    stmt.run(
      root,
      options.tokenId || null,
      options.blockNumber || null,
      leaves.length,
      totalAmount,
      JSON.stringify(leaves)
    );
  }

  /**
   * Get stored merkle tree by root
   */
  async getMerkleTree(root: string): Promise<MerkleTreeData | null> {
    const row = this.db.prepare(`
      SELECT * FROM merkle_trees WHERE root = ?
    `).get(root) as any;

    if (!row) return null;

    const leaves = JSON.parse(row.leaves_json);
    
    // Regenerate proofs
    const leafHashes = leaves.map((leaf: MerkleLeaf) =>
      this.generateLeafHash(leaf.address, leaf.amount, leaf.index)
    );
    
    const tree = new MerkleTree(leafHashes, keccak256, { sortPairs: true });
    const proofs = new Map<string, MerkleProof>();
    
    leaves.forEach((leaf: MerkleLeaf, index: number) => {
      const proof = tree.getHexProof(leafHashes[index]);
      proofs.set(leaf.address, {
        address: leaf.address,
        amount: leaf.amount,
        proof,
        index
      });
    });

    return {
      root: row.root,
      leaves,
      proofs,
      metadata: {
        totalAmount: row.total_amount,
        totalRecipients: row.recipients_count,
        generatedAt: new Date(row.created_at),
        tokenId: row.token_id,
        blockNumber: row.block_number
      }
    };
  }

  /**
   * Generate merkle tree for whitelist (addresses only, no amounts)
   */
  async generateWhitelistTree(addresses: string[]): Promise<{
    root: string;
    proofs: Map<string, string[]>;
  }> {
    console.log(`🌳 Generating whitelist merkle tree for ${addresses.length} addresses...`);

    // Normalize addresses and create leaf hashes
    const normalizedAddresses = addresses.map(a => a.toLowerCase());
    const leafHashes = normalizedAddresses.map(address => keccak256(address));

    // Create merkle tree
    const tree = new MerkleTree(leafHashes, keccak256, { sortPairs: true });
    const root = tree.getHexRoot();

    // Generate proofs
    const proofs = new Map<string, string[]>();
    normalizedAddresses.forEach((address, index) => {
      const proof = tree.getHexProof(leafHashes[index]);
      proofs.set(address, proof);
    });

    console.log(`✅ Whitelist merkle tree generated with root: ${root}`);
    return { root, proofs };
  }

  /**
   * Optimize merkle tree for gas efficiency
   */
  optimizeForGas(recipients: Array<{ address: string; amount: string }>): {
    batches: Array<Array<{ address: string; amount: string }>>;
    estimatedGas: number;
  } {
    // Group recipients by amount ranges to optimize claim gas
    const ranges = [
      { min: BigInt(0), max: BigInt(10), batch: [] as any[] },
      { min: BigInt(11), max: BigInt(100), batch: [] as any[] },
      { min: BigInt(101), max: BigInt(1000), batch: [] as any[] },
      { min: BigInt(1001), max: BigInt(Number.MAX_SAFE_INTEGER), batch: [] as any[] }
    ];

    recipients.forEach(r => {
      const amount = BigInt(r.amount);
      const range = ranges.find(range => amount >= range.min && amount <= range.max);
      if (range) {
        range.batch.push(r);
      }
    });

    const batches = ranges.map(r => r.batch).filter(b => b.length > 0);
    
    // Estimate gas per claim (approximate)
    const baseGas = 50000; // Base gas for claim transaction
    const proofGas = 3000; // Gas per proof element
    const avgProofLength = Math.ceil(Math.log2(recipients.length));
    const estimatedGas = baseGas + (proofGas * avgProofLength);

    return { batches, estimatedGas };
  }

  /**
   * Get merkle tree statistics
   */
  async getStats(): Promise<{
    totalTrees: number;
    totalRecipients: number;
    totalAmount: string;
    largestTree: number;
    averageTreeSize: number;
  }> {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total_trees,
        SUM(recipients_count) as total_recipients,
        SUM(total_amount) as total_amount,
        MAX(recipients_count) as largest_tree,
        AVG(recipients_count) as avg_tree_size
      FROM merkle_trees
    `).get() as any;

    return {
      totalTrees: stats.total_trees || 0,
      totalRecipients: stats.total_recipients || 0,
      totalAmount: stats.total_amount || '0',
      largestTree: stats.largest_tree || 0,
      averageTreeSize: Math.round(stats.avg_tree_size || 0)
    };
  }
}