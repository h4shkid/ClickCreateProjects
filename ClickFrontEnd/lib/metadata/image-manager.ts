import axios from 'axios';
import sharp from 'sharp';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { MetadataFetcher } from './metadata-fetcher';

export interface ImageInfo {
  tokenId: string;
  originalUrl: string;
  localPath?: string;
  thumbnailPath?: string;
  format?: string;
  width?: number;
  height?: number;
  size?: number;
  downloaded: boolean;
  error?: string;
}

export interface ImageProcessingOptions {
  generateThumbnail?: boolean;
  thumbnailSize?: { width: number; height: number };
  optimize?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export class ImageManager {
  private basePath: string;
  private metadataFetcher: MetadataFetcher;
  private downloadQueue: Array<{ tokenId: string; url: string }> = [];
  private isProcessing = false;
  private imageCache = new Map<string, ImageInfo>();
  
  constructor(basePath = './public/nft-images') {
    this.basePath = basePath;
    this.metadataFetcher = new MetadataFetcher();
    this.initializeDirectories();
  }

  /**
   * Initialize storage directories
   */
  private async initializeDirectories(): Promise<void> {
    const dirs = [
      this.basePath,
      path.join(this.basePath, 'original'),
      path.join(this.basePath, 'thumbnails'),
      path.join(this.basePath, 'optimized')
    ];
    
    for (const dir of dirs) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.error(`Error creating directory ${dir}:`, error);
      }
    }
  }

  /**
   * Download image from URL
   */
  async downloadImage(
    tokenId: string,
    imageUrl: string
  ): Promise<ImageInfo> {
    // Check cache first
    const cacheKey = `${tokenId}:${imageUrl}`;
    if (this.imageCache.has(cacheKey)) {
      return this.imageCache.get(cacheKey)!;
    }
    
    const imageInfo: ImageInfo = {
      tokenId,
      originalUrl: imageUrl,
      downloaded: false
    };
    
    try {
      // Process IPFS URLs
      const processedUrl = this.metadataFetcher.processIPFSUrl(imageUrl);
      
      console.log(`📥 Downloading image for token ${tokenId.substring(0, 10)}...`);
      
      // Download image
      const response = await axios.get(processedUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024, // 50MB max
        headers: {
          'User-Agent': 'NFT-Snapshot-Tool/1.0'
        }
      });
      
      const buffer = Buffer.from(response.data);
      
      // Generate filename based on content hash
      const hash = createHash('sha256').update(buffer).digest('hex');
      const extension = this.getExtensionFromMimeType(response.headers['content-type']);
      const filename = `${hash}${extension}`;
      const filepath = path.join(this.basePath, 'original', filename);
      
      // Save original image
      await fs.writeFile(filepath, buffer);
      
      // Get image metadata
      const metadata = await sharp(buffer).metadata();
      
      imageInfo.localPath = filepath;
      imageInfo.format = metadata.format;
      imageInfo.width = metadata.width;
      imageInfo.height = metadata.height;
      imageInfo.size = buffer.length;
      imageInfo.downloaded = true;
      
      console.log(`✅ Downloaded image: ${filename} (${this.formatFileSize(buffer.length)})`);
      
      // Cache the result
      this.imageCache.set(cacheKey, imageInfo);
      
      // Update database
      await this.updateImageStatus(tokenId, true, filepath);
      
    } catch (error: any) {
      console.error(`❌ Failed to download image for token ${tokenId}:`, error.message);
      imageInfo.error = error.message;
      
      // Update database with error
      await this.updateImageStatus(tokenId, false, null, error.message);
    }
    
    return imageInfo;
  }

  /**
   * Process image (resize, optimize, generate thumbnail)
   */
  async processImage(
    imagePath: string,
    options: ImageProcessingOptions = {}
  ): Promise<{
    optimizedPath?: string;
    thumbnailPath?: string;
  }> {
    const defaultOptions: ImageProcessingOptions = {
      generateThumbnail: true,
      thumbnailSize: { width: 300, height: 300 },
      optimize: true,
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 85,
      ...options
    };
    
    const result: { optimizedPath?: string; thumbnailPath?: string } = {};
    
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      // Generate thumbnail
      if (defaultOptions.generateThumbnail) {
        const thumbnailFilename = path.basename(imagePath, path.extname(imagePath)) + '_thumb.webp';
        const thumbnailPath = path.join(this.basePath, 'thumbnails', thumbnailFilename);
        
        await sharp(imagePath)
          .resize(
            defaultOptions.thumbnailSize!.width,
            defaultOptions.thumbnailSize!.height,
            {
              fit: 'cover',
              position: 'center'
            }
          )
          .webp({ quality: 80 })
          .toFile(thumbnailPath);
        
        result.thumbnailPath = thumbnailPath;
        console.log(`🖼️ Generated thumbnail: ${thumbnailFilename}`);
      }
      
      // Optimize original if needed
      if (defaultOptions.optimize && metadata.width && metadata.height) {
        const needsResize = 
          metadata.width > defaultOptions.maxWidth! ||
          metadata.height > defaultOptions.maxHeight!;
        
        if (needsResize || metadata.format !== 'webp') {
          const optimizedFilename = path.basename(imagePath, path.extname(imagePath)) + '_opt.webp';
          const optimizedPath = path.join(this.basePath, 'optimized', optimizedFilename);
          
          await sharp(imagePath)
            .resize(defaultOptions.maxWidth, defaultOptions.maxHeight, {
              fit: 'inside',
              withoutEnlargement: true
            })
            .webp({ quality: defaultOptions.quality })
            .toFile(optimizedPath);
          
          result.optimizedPath = optimizedPath;
          console.log(`⚡ Optimized image: ${optimizedFilename}`);
        }
      }
      
    } catch (error) {
      console.error('Error processing image:', error);
    }
    
    return result;
  }

  /**
   * Download and process images for multiple tokens
   */
  async downloadBatchImages(
    tokens: Array<{ tokenId: string; imageUrl?: string }>,
    concurrency = 3
  ): Promise<Map<string, ImageInfo>> {
    const results = new Map<string, ImageInfo>();
    
    console.log(`📦 Downloading images for ${tokens.length} tokens...`);
    
    // Filter tokens with image URLs
    const tokensWithImages = tokens.filter(t => t.imageUrl);
    
    // Process in batches
    for (let i = 0; i < tokensWithImages.length; i += concurrency) {
      const batch = tokensWithImages.slice(i, i + concurrency);
      
      const promises = batch.map(async (token) => {
        const imageInfo = await this.downloadImage(token.tokenId, token.imageUrl!);
        
        // Process image if downloaded successfully
        if (imageInfo.downloaded && imageInfo.localPath) {
          const processed = await this.processImage(imageInfo.localPath);
          imageInfo.thumbnailPath = processed.thumbnailPath;
        }
        
        results.set(token.tokenId, imageInfo);
        return imageInfo;
      });
      
      await Promise.all(promises);
      
      // Progress update
      const progress = Math.min(i + concurrency, tokensWithImages.length);
      console.log(`  Progress: ${progress}/${tokensWithImages.length}`);
    }
    
    console.log(`✅ Downloaded ${results.size} images`);
    return results;
  }

  /**
   * Get image paths for a token
   */
  async getImagePaths(tokenId: string): Promise<{
    original?: string;
    thumbnail?: string;
    optimized?: string;
  } | null> {
    // Check database for cached paths
    const dbManager = require('../database/init').getDatabase();
    const db = dbManager.getDb();
    
    const stmt = db.prepare(`
      SELECT image_cached, metadata_json
      FROM nft_metadata
      WHERE token_id = ?
    `);
    
    const row = stmt.get(tokenId) as any;
    
    if (row && row.image_cached) {
      // Parse metadata for paths
      const metadata = JSON.parse(row.metadata_json);
      
      // Look for files in directories
      const files = await this.findTokenFiles(tokenId);
      return files;
    }
    
    return null;
  }

  /**
   * Find files for a token
   */
  private async findTokenFiles(tokenId: string): Promise<{
    original?: string;
    thumbnail?: string;
    optimized?: string;
  }> {
    const result: any = {};
    
    try {
      // Search in each directory
      const dirs = ['original', 'thumbnails', 'optimized'];
      
      for (const dir of dirs) {
        const dirPath = path.join(this.basePath, dir);
        const files = await fs.readdir(dirPath);
        
        // Find files that might belong to this token
        // (In production, would store filename mapping in DB)
        for (const file of files) {
          if (file.includes(tokenId.substring(0, 10))) {
            if (dir === 'original') result.original = path.join(dirPath, file);
            else if (dir === 'thumbnails') result.thumbnail = path.join(dirPath, file);
            else if (dir === 'optimized') result.optimized = path.join(dirPath, file);
          }
        }
      }
    } catch (error) {
      console.error('Error finding token files:', error);
    }
    
    return result;
  }

  /**
   * Clean up old images
   */
  async cleanupOldImages(daysOld = 30): Promise<number> {
    let deletedCount = 0;
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    try {
      const dirs = ['original', 'thumbnails', 'optimized'];
      
      for (const dir of dirs) {
        const dirPath = path.join(this.basePath, dir);
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
          const filepath = path.join(dirPath, file);
          const stats = await fs.stat(filepath);
          
          if (stats.mtimeMs < cutoffTime) {
            await fs.unlink(filepath);
            deletedCount++;
          }
        }
      }
      
      console.log(`🧹 Cleaned up ${deletedCount} old image files`);
    } catch (error) {
      console.error('Error cleaning up images:', error);
    }
    
    return deletedCount;
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalImages: number;
    totalSize: number;
    originalCount: number;
    thumbnailCount: number;
    optimizedCount: number;
  }> {
    const stats = {
      totalImages: 0,
      totalSize: 0,
      originalCount: 0,
      thumbnailCount: 0,
      optimizedCount: 0
    };
    
    try {
      const dirs = [
        { name: 'original', key: 'originalCount' },
        { name: 'thumbnails', key: 'thumbnailCount' },
        { name: 'optimized', key: 'optimizedCount' }
      ];
      
      for (const dir of dirs) {
        const dirPath = path.join(this.basePath, dir.name);
        const files = await fs.readdir(dirPath);
        
        stats[dir.key as keyof typeof stats] = files.length;
        stats.totalImages += files.length;
        
        // Calculate total size
        for (const file of files) {
          const filepath = path.join(dirPath, file);
          const fileStat = await fs.stat(filepath);
          stats.totalSize += fileStat.size;
        }
      }
    } catch (error) {
      console.error('Error getting storage stats:', error);
    }
    
    return stats;
  }

  /**
   * Update image status in database
   */
  private async updateImageStatus(
    tokenId: string,
    cached: boolean,
    filepath?: string | null,
    error?: string
  ): Promise<void> {
    const dbManager = require('../database/init').getDatabase();
    const db = dbManager.getDb();
    
    const stmt = db.prepare(`
      UPDATE nft_metadata
      SET image_cached = ?, updated_at = CURRENT_TIMESTAMP
      WHERE token_id = ?
    `);
    
    stmt.run(cached ? 1 : 0, tokenId);
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType?: string): string {
    const mimeMap: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/avif': '.avif'
    };
    
    return mimeMap[mimeType || ''] || '.jpg';
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /**
   * Clear image cache
   */
  clearCache(): void {
    this.imageCache.clear();
    console.log('🧹 Image cache cleared');
  }
}