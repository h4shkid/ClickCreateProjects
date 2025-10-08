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
  all(...params: any[]): any[] | Promise<any[]>
  run(...params: any[]): { changes: number; lastInsertRowid: number | bigint } | Promise<{ changes: number; lastInsertRowid: number | bigint }>
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

  constructor(connectionString: string) {
    // Serverless-optimized pool configuration
    this.pool = new Pool({
      connectionString,
      max: 1, // Serverless: minimize connections
      idleTimeoutMillis: 10000, // Release idle connections quickly
      connectionTimeoutMillis: 10000, // Longer timeout for serverless cold starts
      allowExitOnIdle: true, // Allow process to exit when idle
    })
  }

  prepare(sql: string): PreparedStatement {
    // Convert SQLite syntax to Postgres syntax
    let pgSql = sql

    // Replace ? placeholders with $1, $2, etc.
    let paramCounter = 0
    pgSql = pgSql.replace(/\?/g, () => `$${++paramCounter}`)

    // Remove COLLATE NOCASE (Postgres is case-sensitive by default, but we use LOWER() for comparisons)
    // The values are already lowercased in the code, so we can safely remove COLLATE NOCASE
    pgSql = pgSql.replace(/\s+COLLATE\s+NOCASE/gi, '')

    return {
      get: async (...params: any[]) => {
        // Use fresh connection for each query (serverless-friendly)
        const client = await this.pool.connect()
        try {
          const result = await client.query(pgSql, params)
          return result.rows[0] || null
        } finally {
          client.release()
        }
      },
      all: async (...params: any[]) => {
        // Use fresh connection for each query (serverless-friendly)
        const client = await this.pool.connect()
        try {
          const result = await client.query(pgSql, params)
          return result.rows || []
        } finally {
          client.release()
        }
      },
      run: async (...params: any[]) => {
        // Use fresh connection for each query (serverless-friendly)
        const client = await this.pool.connect()
        try {
          const result = await client.query(pgSql, params)
          return {
            changes: result.rowCount || 0,
            lastInsertRowid: result.rows[0]?.id || 0
          }
        } finally {
          client.release()
        }
      }
    }
  }

  async exec(sql: string): Promise<void> {
    const client = await this.pool.connect()
    try {
      await client.query(sql)
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}

/**
 * Create database adapter based on environment
 */
export function createDatabaseAdapter(): DatabaseAdapter {
  const dbType = process.env.DATABASE_TYPE as DatabaseType || 'sqlite'

  console.log('[DatabaseAdapter] DATABASE_TYPE:', dbType)
  console.log('[DatabaseAdapter] POSTGRES_URL exists:', !!process.env.POSTGRES_URL)

  if (dbType === 'postgres') {
    const connectionString = process.env.POSTGRES_URL
    if (!connectionString) {
      console.error('[DatabaseAdapter] ERROR: DATABASE_TYPE is postgres but POSTGRES_URL is missing!')
      console.error('[DatabaseAdapter] Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('POSTGRES')))
      throw new Error('POSTGRES_URL environment variable is required for Postgres')
    }
    console.log('[DatabaseAdapter] Using Postgres adapter')
    return new PostgresAdapter(connectionString)
  } else {
    // SQLite for local development
    console.log('[DatabaseAdapter] Using SQLite adapter')
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
