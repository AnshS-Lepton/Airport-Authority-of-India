import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Zone } from './zone.service';

/**
 * Zone Cache Service
 * 
 * Provides in-memory caching for zone data to avoid reloading when navigating between routes.
 * The cache persists across route changes since Angular services are singletons.
 */
@Injectable({
  providedIn: 'root'
})
export class ZoneCacheService {
  // Cache storage
  private cache: Map<string, Zone[]> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();
  private loadingPromises: Map<string, Promise<Zone[]>> = new Map();
  
  // Cache configuration - Extended TTL for near-instant responses
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds (for sub-ms responses)
  private readonly CACHE_KEYS = {
    ALL: 'all',
    BY_TYPE_CATEGORY: (type: string, category: string, distance?: string) => 
      `type:${type}:category:${category}${distance ? `:distance:${distance}` : ''}`,
    BY_CATEGORY: (category: string, distance?: string) => 
      `category:${category}${distance ? `:distance:${distance}` : ''}`,
    GENERAL_RED: 'generalRed'
  };

  /**
   * Get zones from cache or return null if not cached/expired
   */
  getCached(key: string): Zone[] | null {
    const cached = this.cache.get(key);
    const timestamp = this.cacheTimestamps.get(key);
    
    if (!cached || !timestamp) {
      return null;
    }
    
    // Check if cache is expired
    const now = Date.now();
    if (now - timestamp > this.CACHE_TTL) {
      console.log(`[ZoneCacheService] Cache expired for key: ${key}`);
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }
    
    console.log(`[ZoneCacheService] Cache hit for key: ${key} (${cached.length} zones)`);
    return cached;
  }

  /**
   * Store zones in cache
   */
  setCached(key: string, zones: Zone[]): void {
    this.cache.set(key, zones);
    this.cacheTimestamps.set(key, Date.now());
    console.log(`[ZoneCacheService] Cached ${zones.length} zones with key: ${key}`);
  }

  /**
   * Check if a key is currently being loaded (to prevent duplicate requests)
   */
  isLoading(key: string): boolean {
    return this.loadingPromises.has(key);
  }

  /**
   * Get the loading promise for a key (to share the same request)
   */
  getLoadingPromise(key: string): Promise<Zone[]> | null {
    return this.loadingPromises.get(key) || null;
  }

  /**
   * Set a loading promise for a key
   */
  setLoadingPromise(key: string, promise: Promise<Zone[]>): void {
    this.loadingPromises.set(key, promise);
    
    // Remove from loading promises when resolved
    promise
      .then(() => {
        this.loadingPromises.delete(key);
      })
      .catch(() => {
        this.loadingPromises.delete(key);
      });
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    console.log('[ZoneCacheService] Clearing all zone cache');
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Clear cache for a specific key
   */
  clearKey(key: string): void {
    console.log(`[ZoneCacheService] Clearing cache for key: ${key}`);
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[]; timestamps: Map<string, number> } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      timestamps: new Map(this.cacheTimestamps)
    };
  }

  /**
   * Helper methods to generate cache keys
   */
  getKeyForAllZones(): string {
    return this.CACHE_KEYS.ALL;
  }

  getKeyForTypeAndCategory(type: string, category: string, distance?: string): string {
    return this.CACHE_KEYS.BY_TYPE_CATEGORY(type, category, distance);
  }

  getKeyForCategory(category: string, distance?: string): string {
    return this.CACHE_KEYS.BY_CATEGORY(category, distance);
  }

  getKeyForGeneralRedZones(): string {
    return this.CACHE_KEYS.GENERAL_RED;
  }
}


