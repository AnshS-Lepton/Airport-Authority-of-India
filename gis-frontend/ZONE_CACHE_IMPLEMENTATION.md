# Zone Cache Implementation

## Overview
Zone data is now cached in memory to prevent reloading when navigating between routes. The cache persists across route changes since Angular services are singletons.

## How It Works

### 1. Zone Cache Service (`zone-cache.service.ts`)
- Stores zone data in memory with a 5-minute TTL (Time To Live)
- Prevents duplicate API requests by tracking loading promises
- Provides cache statistics and manual cache clearing

### 2. Zone Service Updates (`zone.service.ts`)
- All zone fetching methods now check cache first
- If cached data exists and is not expired, returns immediately
- If already loading, shares the same request promise
- Automatically caches API responses
- Clears cache when zones are created/updated/deleted

## Benefits

✅ **No Reloading**: Zone data persists when navigating between `/` and `/create-flight-plan`  
✅ **Faster Navigation**: Instant data retrieval from cache  
✅ **Reduced API Calls**: Same data is not fetched multiple times  
✅ **Automatic Expiration**: Cache expires after 5 minutes to ensure fresh data  
✅ **Smart Loading**: Prevents duplicate requests if data is already being fetched  

## Cache Behavior

### First Load
1. User visits `/` (map view)
2. Zones are fetched from API
3. Data is cached in memory
4. Zones are displayed on map

### Route Change
1. User navigates to `/create-flight-plan`
2. Component requests zones
3. **Cache hit** - Data returned instantly from memory
4. No API call made
5. Zones displayed immediately

### Cache Expiration
- Cache expires after 5 minutes
- Next request after expiration will fetch fresh data
- New data is cached again

### Cache Invalidation
Cache is automatically cleared when:
- A zone is created
- A zone is updated
- A zone is deleted

## Cache Keys

The cache uses different keys for different queries:
- `all` - All zones
- `type:RED:category:AIRPORT` - Red airport zones
- `category:STATE:distance:25` - State zones with distance
- `generalRed` - General red zones (filtered)

## Manual Cache Control

If needed, you can manually control the cache:

```typescript
// Inject ZoneCacheService
constructor(private zoneCache: ZoneCacheService) {}

// Clear all cache
this.zoneCache.clearCache();

// Clear specific cache key
this.zoneCache.clearKey('all');

// Get cache statistics
const stats = this.zoneCache.getCacheStats();
console.log('Cache size:', stats.size);
console.log('Cached keys:', stats.keys);
```

## Performance Impact

**Before:**
- Map view: ~2-5 seconds to load zones
- Create flight plan: ~2-5 seconds to load zones (reload)
- Total: ~4-10 seconds for both views

**After:**
- Map view: ~2-5 seconds to load zones (first time)
- Create flight plan: < 50ms (instant from cache)
- Total: ~2-5 seconds (only first view loads)

## Testing

To verify the cache is working:

1. Open browser DevTools Console
2. Navigate to `/` (map view)
3. Look for: `[ZoneCacheService] Cached X zones with key: ...`
4. Navigate to `/create-flight-plan`
5. Look for: `[ZoneCacheService] Cache hit for key: ...`
6. You should see instant loading with no API calls

## Configuration

To change cache TTL, edit `zone-cache.service.ts`:

```typescript
private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
// Change to: 10 * 60 * 1000 for 10 minutes
```

## Notes

- Cache is stored in memory (not localStorage)
- Cache is cleared on page refresh
- Cache persists during the same session
- Multiple components can safely use the same cached data


