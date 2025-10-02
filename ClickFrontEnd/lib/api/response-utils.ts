import { NextResponse } from 'next/server';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export class ApiResponseBuilder {
  /**
   * Create a successful response
   */
  static success<T>(
    data: T,
    metadata?: Record<string, any>,
    status = 200
  ): NextResponse {
    return NextResponse.json(
      {
        success: true,
        data,
        metadata: {
          timestamp: new Date().toISOString(),
          ...metadata
        }
      },
      { status }
    );
  }

  /**
   * Create an error response
   */
  static error(
    message: string,
    code = 'INTERNAL_ERROR',
    status = 500,
    details?: any
  ): NextResponse {
    return NextResponse.json(
      {
        success: false,
        error: {
          code,
          message,
          details
        }
      },
      { status }
    );
  }

  /**
   * Create a paginated response
   */
  static paginated<T>(
    data: T[],
    pagination: PaginationInfo,
    metadata?: Record<string, any>
  ): NextResponse {
    return NextResponse.json({
      success: true,
      data,
      pagination,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    });
  }

  /**
   * Create a not found response
   */
  static notFound(resource: string): NextResponse {
    return this.error(
      `${resource} not found`,
      'NOT_FOUND',
      404
    );
  }

  /**
   * Create a bad request response
   */
  static badRequest(message: string, details?: any): NextResponse {
    return this.error(
      message,
      'BAD_REQUEST',
      400,
      details
    );
  }

  /**
   * Create an unauthorized response
   */
  static unauthorized(message = 'Unauthorized'): NextResponse {
    return this.error(
      message,
      'UNAUTHORIZED',
      401
    );
  }

  /**
   * Create a rate limit response
   */
  static rateLimited(retryAfter?: number): NextResponse {
    const response = this.error(
      'Rate limit exceeded',
      'RATE_LIMITED',
      429
    );
    
    if (retryAfter) {
      response.headers.set('Retry-After', retryAfter.toString());
    }
    
    return response;
  }
}

/**
 * Error handler wrapper for API routes
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error: any) {
      console.error('API Error:', error);
      
      // Handle specific error types
      if (error.code === 'SQLITE_ERROR') {
        return ApiResponseBuilder.error(
          'Database error occurred',
          'DATABASE_ERROR',
          500,
          process.env.NODE_ENV === 'development' ? error.message : undefined
        );
      }
      
      if (error.name === 'ValidationError') {
        return ApiResponseBuilder.badRequest(
          error.message,
          error.details
        );
      }
      
      if (error.response?.status === 429) {
        return ApiResponseBuilder.rateLimited(
          error.response.headers?.['retry-after']
        );
      }
      
      // Default error response
      return ApiResponseBuilder.error(
        error.message || 'An unexpected error occurred',
        'INTERNAL_ERROR',
        500
      );
    }
  }) as T;
}

/**
 * Validate required parameters
 */
export function validateParams(
  params: Record<string, any>,
  required: string[]
): { valid: boolean; missing?: string[] } {
  const missing = required.filter(key => !params[key]);
  
  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined
  };
}

/**
 * Parse and validate numeric parameters
 */
export function parseNumericParam(
  value: string | null,
  defaultValue: number,
  min?: number,
  max?: number
): number {
  if (!value) return defaultValue;
  
  const parsed = parseInt(value);
  if (isNaN(parsed)) return defaultValue;
  
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  
  return parsed;
}

/**
 * Parse and validate BigInt parameters
 */
export function parseBigIntParam(
  value: string | null,
  defaultValue?: bigint
): bigint | undefined {
  if (!value) return defaultValue;
  
  try {
    return BigInt(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Format address for display
 */
export function formatAddress(address: string, length = 6): string {
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate transaction hash
 */
export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Cache control headers
 */
export const CacheHeaders = {
  noCache: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
  shortCache: { 'Cache-Control': 'public, max-age=60, s-maxage=60' },
  mediumCache: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
  longCache: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
  immutable: { 'Cache-Control': 'public, max-age=31536000, immutable' }
};