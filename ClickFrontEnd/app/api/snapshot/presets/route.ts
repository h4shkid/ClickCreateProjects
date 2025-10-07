/**
 * Snapshot Presets API
 * List and search available snapshot presets
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  SNAPSHOT_PRESETS,
  getPreset,
  getPresetsByCategory,
  getRecommendedPresets,
  getPresetCategories
} from '@/lib/processing/snapshot-presets'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const recommended = searchParams.get('recommended') === 'true'
    const presetId = searchParams.get('id')

    // Get specific preset
    if (presetId) {
      const preset = getPreset(presetId)
      if (!preset) {
        return NextResponse.json({
          success: false,
          error: 'Preset not found'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: preset
      })
    }

    // Get presets by category
    if (category) {
      const presets = getPresetsByCategory(category as any)
      return NextResponse.json({
        success: true,
        data: {
          category,
          presets,
          count: presets.length
        }
      })
    }

    // Get recommended presets
    if (recommended) {
      const presets = getRecommendedPresets()
      return NextResponse.json({
        success: true,
        data: {
          presets,
          count: presets.length
        }
      })
    }

    // Get all presets with categories
    const categories = getPresetCategories()

    return NextResponse.json({
      success: true,
      data: {
        categories,
        presets: SNAPSHOT_PRESETS,
        totalPresets: SNAPSHOT_PRESETS.length
      }
    })

  } catch (error: any) {
    console.error('Snapshot presets API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error'
    }, { status: 500 })
  }
}
