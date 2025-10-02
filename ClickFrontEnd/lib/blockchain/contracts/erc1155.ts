import { ethers } from 'ethers';
import ERC1155_ABI from './erc1155-abi.json';
import { getProviderManager } from '../provider';

export { default as ERC1155_ABI } from './erc1155-abi.json';

export interface TransferEvent {
  operator: string;
  from: string;
  to: string;
  tokenId: string;
  amount: string;
  blockNumber: number;
  blockTimestamp: number;
  transactionHash: string;
  logIndex: number;
  eventType: 'TransferSingle' | 'TransferBatch';
}

export class ERC1155Contract {
  private contract: ethers.Contract | null = null;
  private contractAddress: string;
  private provider: ethers.JsonRpcProvider | null = null;

  constructor(contractAddress: string) {
    this.contractAddress = contractAddress;
  }

  /**
   * Initialize the contract instance
   */
  async initialize(): Promise<void> {
    const providerManager = getProviderManager();
    await providerManager.initialize();
    this.provider = await providerManager.getProvider();
    
    this.contract = new ethers.Contract(
      this.contractAddress,
      ERC1155_ABI,
      this.provider
    );
    
    console.log(`✅ Contract interface initialized for ${this.contractAddress}`);
  }

  /**
   * Get the contract instance
   */
  getContract(): ethers.Contract {
    if (!this.contract) {
      throw new Error('Contract not initialized. Call initialize() first.');
    }
    return this.contract;
  }

  /**
   * Check if address is valid ERC-1155 contract
   */
  async isERC1155(): Promise<boolean> {
    try {
      const contract = this.getContract();
      // ERC-1155 interface ID
      const isERC1155 = await contract.supportsInterface('0xd9b67a26');
      return isERC1155;
    } catch (error) {
      console.error('Error checking ERC-1155 interface:', error);
      return false;
    }
  }

  /**
   * Get balance of a specific token for an address
   */
  async balanceOf(address: string, tokenId: string): Promise<string> {
    const contract = this.getContract();
    const balance = await contract.balanceOf(address, tokenId);
    return balance.toString();
  }

  /**
   * Get balances for multiple addresses and tokens
   */
  async balanceOfBatch(addresses: string[], tokenIds: string[]): Promise<string[]> {
    const contract = this.getContract();
    const balances = await contract.balanceOfBatch(addresses, tokenIds);
    return balances.map((b: bigint) => b.toString());
  }

  /**
   * Get URI for a token
   */
  async uri(tokenId: string): Promise<string> {
    const contract = this.getContract();
    return await contract.uri(tokenId);
  }

  /**
   * Get TransferSingle event filter
   */
  getTransferSingleFilter(
    from?: string,
    to?: string,
    tokenId?: string
  ): ethers.EventFilter {
    const contract = this.getContract();
    return contract.filters.TransferSingle(null, from, to) as any;
  }

  /**
   * Get TransferBatch event filter
   */
  getTransferBatchFilter(
    from?: string,
    to?: string
  ): ethers.EventFilter {
    const contract = this.getContract();
    return contract.filters.TransferBatch(null, from, to) as any;
  }

  /**
   * Query TransferSingle events
   */
  async queryTransferSingleEvents(
    fromBlock: number,
    toBlock: number,
    from?: string,
    to?: string
  ): Promise<TransferEvent[]> {
    const contract = this.getContract();
    const filter = this.getTransferSingleFilter(from, to);
    
    const events = await contract.queryFilter(filter as any, fromBlock, toBlock);
    const transfers: TransferEvent[] = [];
    
    for (const event of events) {
      const block = await event.getBlock();
      const eventArgs = (event as any).args;
      transfers.push({
        operator: eventArgs![0],
        from: eventArgs![1],
        to: eventArgs![2],
        tokenId: eventArgs![3].toString(),
        amount: eventArgs![4].toString(),
        blockNumber: event.blockNumber,
        blockTimestamp: block.timestamp,
        transactionHash: event.transactionHash,
        logIndex: (event as any).index,
        eventType: 'TransferSingle'
      });
    }
    
    return transfers;
  }

  /**
   * Query TransferBatch events
   */
  async queryTransferBatchEvents(
    fromBlock: number,
    toBlock: number,
    from?: string,
    to?: string
  ): Promise<TransferEvent[]> {
    const contract = this.getContract();
    const filter = this.getTransferBatchFilter(from, to);
    
    const events = await contract.queryFilter(filter as any, fromBlock, toBlock);
    const transfers: TransferEvent[] = [];
    
    for (const event of events) {
      const block = await event.getBlock();
      const eventArgs = (event as any).args;
      const ids = eventArgs![3];
      const values = eventArgs![4];
      
      // Expand batch transfers into individual transfer events
      for (let i = 0; i < ids.length; i++) {
        transfers.push({
          operator: eventArgs![0],
          from: eventArgs![1],
          to: eventArgs![2],
          tokenId: ids[i].toString(),
          amount: values[i].toString(),
          blockNumber: event.blockNumber,
          blockTimestamp: block.timestamp,
          transactionHash: event.transactionHash,
          logIndex: (event as any).index,
          eventType: 'TransferBatch'
        });
      }
    }
    
    return transfers;
  }

  /**
   * Query all transfer events (both Single and Batch)
   */
  async queryAllTransferEvents(
    fromBlock: number,
    toBlock: number,
    from?: string,
    to?: string
  ): Promise<TransferEvent[]> {
    console.log(`📊 Querying events from block ${fromBlock} to ${toBlock}`);
    
    const [singleEvents, batchEvents] = await Promise.all([
      this.queryTransferSingleEvents(fromBlock, toBlock, from, to),
      this.queryTransferBatchEvents(fromBlock, toBlock, from, to)
    ]);
    
    // Combine and sort by block number and log index
    const allEvents = [...singleEvents, ...batchEvents].sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber;
      }
      return a.logIndex - b.logIndex;
    });
    
    console.log(`✅ Found ${allEvents.length} transfer events`);
    return allEvents;
  }

  /**
   * Get contract deployment block (simplified - would need indexer for accurate data)
   */
  async getDeploymentBlock(): Promise<number> {
    // For now, return a reasonable default
    // In production, this would query an indexer or use binary search
    return 15000000; // Approximate block for many NFT contracts
  }

  /**
   * Listen to real-time transfer events
   */
  async listenToTransfers(
    callback: (event: TransferEvent) => void
  ): Promise<void> {
    const contract = this.getContract();
    
    // Listen to TransferSingle events
    contract.on('TransferSingle', async (operator, from, to, id, value, event) => {
      const block = await event.getBlock();
      callback({
        operator,
        from,
        to,
        tokenId: id.toString(),
        amount: value.toString(),
        blockNumber: event.blockNumber,
        blockTimestamp: block.timestamp,
        transactionHash: event.transactionHash,
        logIndex: event.index,
        eventType: 'TransferSingle'
      });
    });
    
    // Listen to TransferBatch events
    contract.on('TransferBatch', async (operator, from, to, ids, values, event) => {
      const block = await event.getBlock();
      for (let i = 0; i < ids.length; i++) {
        callback({
          operator,
          from,
          to,
          tokenId: ids[i].toString(),
          amount: values[i].toString(),
          blockNumber: event.blockNumber,
          blockTimestamp: block.timestamp,
          transactionHash: event.transactionHash,
          logIndex: event.index,
          eventType: 'TransferBatch'
        });
      }
    });
    
    console.log('👂 Listening to real-time transfer events');
  }

  /**
   * Stop listening to events
   */
  stopListening(): void {
    if (this.contract) {
      this.contract.removeAllListeners();
      console.log('🛑 Stopped listening to events');
    }
  }
}