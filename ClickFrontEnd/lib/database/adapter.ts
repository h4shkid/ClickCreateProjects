/**
 * Database Adapter - Abstraction layer for SQLite (local) and Postgres (production)
 *
 * This adapter allows the app to work with both databases seamlessly
 */

import Database from 'better-sqlite3'
import { Pool, PoolClient } from 'pg'
import path from 'path'

export type DatabaseType = 'sqlite' | 'postgres'

export interface DatabaseAdapter {
  prepare(sql: string): PreparedStatement
  exec(sql: string): void
  close(): void
  pragma?(directive: string): void
}

export interface PreparedStatement {
  get(...params: any[]): any
  all(...params: any[]): any[]
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint }
}

class SQLiteAdapter implements DatabaseAdapter {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepare(sql)
    return {
      get: (...params: any[]) => stmt.get(...params),
      all: (...params: any[]) => stmt.all(...params),
      run: (...params: any[]) => stmt.run(...params)
    }
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  pragma(directive: string): void {
    this.db.pragma(directive)
  }

  close(): void {
    this.db.close()
  }
}

class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool
  private client: PoolClient | null = null

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }

  private async getClient(): Promise<PoolClient> {
    if (!this.client) {
      this.client = await this.pool.connect()
    }
    return this.client
  }

  prepare(sql: string): PreparedStatement {
    // Convert SQLite ? placeholders to Postgres $1, $2, etc.
    let paramCounter = 0
    const pgSql = sql.replace(/\?/g, () => `$${++paramCounter}`)

    return {
      get: async (...params: any[]) => {
        const client = await this.getClient()
        const result = await client.query(pgSql, params)
        return result.rows[0] || null
      },
      all: async (...params: any[]) => {
        const client = await this.getClient()
        const result = await client.query(pgSql, params)
        return result.rows
      },
      run: async (...params: any[]) => {
        const client = await this.getClient()
        const result = await client.query(pgSql, params)
        return {
          changes: result.rowCount || 0,
          lastInsertRowid: result.rows[0]?.id || 0
        }
      }
    }
  }

  async exec(sql: string): Promise<void> {
    const client = await this.getClient()
    await client.query(sql)
  }

  async close(): Promise<void> {
    if (this.client) {
      this.client.release()
      this.client = null
    }
    await this.pool.end()
  }
}

/**
 * Create database adapter based on environment
 */
export function createDatabaseAdapter(): DatabaseAdapter {
  const dbType = process.env.DATABASE_TYPE as DatabaseType || 'sqlite'

  if (dbType === 'postgres') {
    const connectionString = process.env.POSTGRES_URL
    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is required for Postgres')
    }
    return new PostgresAdapter(connectionString)
  } else {
    // SQLite for local development
    const dbPath = path.join(process.cwd(), 'data', 'nft-snapshot.db')
    return new SQLiteAdapter(dbPath)
  }
}

/**
 * Get database type from environment
 */
export function getDatabaseType(): DatabaseType {
  return (process.env.DATABASE_TYPE as DatabaseType) || 'sqlite'
}

/**
 * Check if using Postgres
 */
export function isPostgres(): boolean {
  return getDatabaseType() === 'postgres'
}

/**
 * Check if using SQLite
 */
export function isSQLite(): boolean {
  return getDatabaseType() === 'sqlite'
}
