import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = './data/nft-snapshot.db') {
    this.dbPath = dbPath;
  }

  /**
   * Initialize the database connection and create tables
   */
  async initialize(): Promise<void> {
    try {
      // Create database connection
      this.db = new Database(this.dbPath);
      
      // Enable foreign keys
      this.db.pragma('foreign_keys = ON');
      
      // Set journal mode for better concurrency
      this.db.pragma('journal_mode = WAL');
      
      // Read and execute schema
      const schemaPath = join(process.cwd(), 'lib', 'database', 'schema.sql');
      const schema = readFileSync(schemaPath, 'utf-8');
      
      // Execute schema statements
      this.db.exec(schema);
      
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Get the database instance
   */
  getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }

  /**
   * Test database connection and tables
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.db) {
        await this.initialize();
      }

      // Test each table exists
      const tables = [
        'events',
        'current_state',
        'snapshot_cache',
        'nft_metadata',
        'analytics_summary',
        'sync_status'
      ];

      for (const table of tables) {
        const result = this.db!.prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        ).get(table);
        
        if (!result) {
          console.error(`❌ Table ${table} does not exist`);
          return false;
        }
      }

      // Test insert and select
      const testResult = this.db!.prepare("SELECT datetime('now') as now").get();
      console.log('✅ Database connection test passed:', testResult);
      
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  getStats(): any {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const stats = {
      events: this.db.prepare('SELECT COUNT(*) as count FROM events').get(),
      holders: this.db.prepare('SELECT COUNT(DISTINCT address) as count FROM current_state').get(),
      tokens: this.db.prepare('SELECT COUNT(DISTINCT token_id) as count FROM current_state').get(),
      metadata: this.db.prepare('SELECT COUNT(*) as count FROM nft_metadata').get(),
      cacheEntries: this.db.prepare('SELECT COUNT(*) as count FROM snapshot_cache').get(),
    };

    return stats;
  }
}

// Export a singleton instance
let dbManager: DatabaseManager | null = null;

export function getDatabase(): DatabaseManager {
  if (!dbManager) {
    dbManager = new DatabaseManager(process.env.DATABASE_PATH || './data/nft-snapshot.db');
  }
  return dbManager;
}

// Initialize database on module load (for development)
if (process.env.NODE_ENV === 'development') {
  getDatabase().initialize().catch(console.error);
}