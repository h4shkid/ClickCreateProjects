/**
 * Postgres Database Manager for Vercel Deployment
 */

import { Pool, PoolClient } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

export class PostgresDatabaseManager {
  private pool: Pool | null = null
  private connectionString: string

  constructor(connectionString?: string) {
    this.connectionString = connectionString || process.env.POSTGRES_URL || ''

    if (!this.connectionString) {
      throw new Error('POSTGRES_URL environment variable is required for Postgres database')
    }
  }

  /**
   * Initialize the database connection and create tables if needed
   */
  async initialize(): Promise<void> {
    try {
      // Create connection pool
      this.pool = new Pool({
        connectionString: this.connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      })

      // Test connection
      const client = await this.pool.connect()
      await client.query('SELECT NOW()')
      client.release()

      console.log('✅ Postgres database initialized successfully')
    } catch (error) {
      console.error('❌ Postgres database initialization failed:', error)
      throw error
    }
  }

  /**
   * Run schema migration
   */
  async runMigration(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.')
    }

    try {
      const migrationPath = join(process.cwd(), 'migrations', '001_initial_postgres_schema.sql')
      const migration = readFileSync(migrationPath, 'utf-8')

      const client = await this.pool.connect()

      try {
        await client.query('BEGIN')
        await client.query(migration)
        await client.query('COMMIT')
        console.log('✅ Database migration completed successfully')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    } catch (error) {
      console.error('❌ Database migration failed:', error)
      throw error
    }
  }

  /**
   * Get a database client from the pool
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    return await this.pool.connect()
  }

  /**
   * Execute a query
   */
  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    return await this.pool.query(sql, params)
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }
}

// Singleton instance
let postgresDb: PostgresDatabaseManager | null = null

export function getPostgresDatabase(): PostgresDatabaseManager {
  if (!postgresDb) {
    postgresDb = new PostgresDatabaseManager()
  }
  return postgresDb
}
