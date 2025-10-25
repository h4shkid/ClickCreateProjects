/**
 * Token Range Parser Utility
 * Converts token ID input with ranges to array of individual token IDs
 *
 * Supported formats:
 * - Single tokens: "1,2,3"
 * - Ranges: "1-10"
 * - Mixed: "1-10,15,20-25,30"
 * - With spaces: "1-10, 15, 20-25"
 */

export interface ParsedTokenResult {
  success: boolean
  tokens: number[]
  error?: string
  originalInput: string
  parsedCount: number
}

/**
 * Parse token ID input string with support for ranges
 * @param input - String input like "1-10,15,20-25"
 * @returns ParsedTokenResult with token array or error
 */
export function parseTokenRanges(input: string): ParsedTokenResult {
  if (!input || input.trim() === '') {
    return {
      success: true,
      tokens: [],
      originalInput: input,
      parsedCount: 0
    }
  }

  try {
    const tokens: number[] = []
    const parts = input.split(',').map(p => p.trim()).filter(p => p.length > 0)

    for (const part of parts) {
      if (part.includes('-')) {
        // Range format: "1-10"
        const rangeParts = part.split('-').map(p => p.trim())

        if (rangeParts.length !== 2) {
          return {
            success: false,
            tokens: [],
            error: `Invalid range format: "${part}". Use format like "1-10"`,
            originalInput: input,
            parsedCount: 0
          }
        }

        const start = parseInt(rangeParts[0], 10)
        const end = parseInt(rangeParts[1], 10)

        // Validation
        if (isNaN(start) || isNaN(end)) {
          return {
            success: false,
            tokens: [],
            error: `Invalid numbers in range: "${part}"`,
            originalInput: input,
            parsedCount: 0
          }
        }

        if (start < 0 || end < 0) {
          return {
            success: false,
            tokens: [],
            error: `Negative numbers not allowed: "${part}"`,
            originalInput: input,
            parsedCount: 0
          }
        }

        if (start > end) {
          return {
            success: false,
            tokens: [],
            error: `Invalid range: "${part}". Start must be less than or equal to end (use ${end}-${start} instead)`,
            originalInput: input,
            parsedCount: 0
          }
        }

        // Sanity check for very large ranges
        const rangeSize = end - start + 1
        if (rangeSize > 10000) {
          return {
            success: false,
            tokens: [],
            error: `Range too large: "${part}" would generate ${rangeSize.toLocaleString()} tokens. Maximum 10,000 per range.`,
            originalInput: input,
            parsedCount: 0
          }
        }

        // Add all tokens in range
        for (let i = start; i <= end; i++) {
          tokens.push(i)
        }
      } else {
        // Single token: "15"
        const token = parseInt(part, 10)

        if (isNaN(token)) {
          return {
            success: false,
            tokens: [],
            error: `Invalid token ID: "${part}". Must be a number or range (e.g., "1-10")`,
            originalInput: input,
            parsedCount: 0
          }
        }

        if (token < 0) {
          return {
            success: false,
            tokens: [],
            error: `Negative token ID not allowed: "${part}"`,
            originalInput: input,
            parsedCount: 0
          }
        }

        tokens.push(token)
      }
    }

    // Remove duplicates and sort
    const uniqueTokens = [...new Set(tokens)].sort((a, b) => a - b)

    // Final sanity check for total token count
    if (uniqueTokens.length > 50000) {
      return {
        success: false,
        tokens: [],
        error: `Total token count (${uniqueTokens.length.toLocaleString()}) exceeds maximum of 50,000 tokens`,
        originalInput: input,
        parsedCount: 0
      }
    }

    return {
      success: true,
      tokens: uniqueTokens,
      originalInput: input,
      parsedCount: uniqueTokens.length
    }
  } catch (error) {
    return {
      success: false,
      tokens: [],
      error: `Unexpected error parsing input: ${error instanceof Error ? error.message : 'Unknown error'}`,
      originalInput: input,
      parsedCount: 0
    }
  }
}

/**
 * Format token array back to compact range string
 * @param tokens - Array of token IDs
 * @returns Compact string like "1-10,15,20-25"
 */
export function formatTokensToRanges(tokens: number[]): string {
  if (!tokens || tokens.length === 0) return ''

  const sorted = [...new Set(tokens)].sort((a, b) => a - b)
  const ranges: string[] = []

  let rangeStart = sorted[0]
  let rangeEnd = sorted[0]

  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i]

    // Check if we're at the end or if there's a gap
    if (i === sorted.length || current !== rangeEnd + 1) {
      // Save the current range
      if (rangeStart === rangeEnd) {
        ranges.push(rangeStart.toString())
      } else if (rangeEnd === rangeStart + 1) {
        // Two consecutive numbers, write separately for clarity
        ranges.push(rangeStart.toString())
        ranges.push(rangeEnd.toString())
      } else {
        ranges.push(`${rangeStart}-${rangeEnd}`)
      }

      // Start new range
      if (i < sorted.length) {
        rangeStart = current
        rangeEnd = current
      }
    } else {
      // Continue current range
      rangeEnd = current
    }
  }

  return ranges.join(',')
}

/**
 * Validate token range input without parsing
 * Useful for real-time validation in UI
 */
export function validateTokenRangeInput(input: string): { isValid: boolean; error?: string } {
  const result = parseTokenRanges(input)
  return {
    isValid: result.success,
    error: result.error
  }
}
