import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, from, tap } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ZoneCacheService } from './zone-cache.service';

export interface Zone {
  id?: number;
  name?: string;
  type?: string;
  type_display?: string;
  category?: string;
  distance?: string;
  geometry?: any;
  min_altitude?: number;
  max_altitude?: number;
  start_date?: string | null;
  end_date?: string | null;
  status?: string;
  source?: string;
  dsr_number?: number | string;
  original_type?: string;
  category_display?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ZoneService {
  private readonly API_URL = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private zoneCache: ZoneCacheService
  ) {}

  getZones(): Observable<Zone[]> {
    const cacheKey = this.zoneCache.getKeyForAllZones();
    
    // Check cache first
    const cached = this.zoneCache.getCached(cacheKey);
    if (cached !== null) {
      return of(cached);
    }
    
    // Check if already loading
    const loadingPromise = this.zoneCache.getLoadingPromise(cacheKey);
    if (loadingPromise) {
      return from(loadingPromise);
    }
    
    // Fetch from API and cache
    const fetchObservable = this.http.get<Zone[]>(`${this.API_URL}/zones`).pipe(
      map(zones => {
        // Filter out expired temporary zones as a safety measure
        if (zones) {
          const now = new Date();
          return zones.filter(zone => {
            // Only filter temporary zones
            if (zone.category === 'TEMPORARY' && zone.end_date) {
              const endDate = new Date(zone.end_date);
              return endDate >= now; // Only keep zones that haven't expired
            }
            return true; // Keep all non-temporary zones
          });
        }
        return zones || [];
      }),
      tap(zones => {
        // Cache the result
        if (zones) {
          this.zoneCache.setCached(cacheKey, zones);
        }
      }),
      catchError(error => {
        if (error.status === 401) {
          return of([]);
        }
        console.error('[ZoneService] Error fetching zones:', error);
        return of([]);
      })
    );
    
    // Convert to promise for loading promise tracking
    const fetchPromise = firstValueFrom(fetchObservable);
    this.zoneCache.setLoadingPromise(cacheKey, fetchPromise);
    
    return fetchObservable;
  }

  getZonesByTypeAndCategory(type: string, category: string, distance?: string): Observable<Zone[]> {
    const cacheKey = this.zoneCache.getKeyForTypeAndCategory(type, category, distance);
    
    // Check cache first
    const cached = this.zoneCache.getCached(cacheKey);
    if (cached !== null) {
      return of(cached);
    }
    
    // Check if already loading
    const loadingPromise = this.zoneCache.getLoadingPromise(cacheKey);
    if (loadingPromise) {
      return from(loadingPromise);
    }
    
    // Fetch from API and cache
    let url = `${this.API_URL}/zones?type=${type}`;
    if (category) {
      url += `&category=${category}`;
    }
    if (distance) {
      url += `&distance=${distance}`;
    }
    
    const fetchObservable = this.http.get<Zone[]>(url).pipe(
      map(zones => {
        // Filter out expired temporary zones as a safety measure
        if (zones) {
          const now = new Date();
          return zones.filter(zone => {
            if (!zone.end_date) return true; // Keep zones without end_date
            const endDate = new Date(zone.end_date);
            return endDate >= now; // Only keep zones that haven't expired
          });
        }
        // For non-temporary zones, return all zones (backend already filters by end_date >= NOW())
        return zones || [];
      }),
      tap(zones => {
        // Cache the result
        if (zones) {
          this.zoneCache.setCached(cacheKey, zones);
        }
      }),
      catchError(error => {
        if (error.status === 401) {
          return of([]);
        }
        console.error('[ZoneService] Error fetching zones by type/category:', error);
        return of([]);
      })
    );
    
    // Convert to promise for loading promise tracking
    const fetchPromise = firstValueFrom(fetchObservable);
    this.zoneCache.setLoadingPromise(cacheKey, fetchPromise);
    
    return fetchObservable;
  }

  getZonesByCategory(category: string, distance?: string): Observable<Zone[]> {
    const cacheKey = this.zoneCache.getKeyForCategory(category, distance);
    
    // Check cache first
    const cached = this.zoneCache.getCached(cacheKey);
    if (cached !== null) {
      return of(cached);
    }
    
    // Check if already loading
    const loadingPromise = this.zoneCache.getLoadingPromise(cacheKey);
    if (loadingPromise) {
      return from(loadingPromise);
    }
    
    // Fetch from API and cache
    let url = `${this.API_URL}/zones?category=${category}`;
    if (distance) {
      url += `&distance=${distance}`;
    }
    
    const fetchObservable = this.http.get<Zone[]>(url).pipe(
      map(zones => {
        // Filter out expired temporary zones as a safety measure
        if (zones && category === 'TEMPORARY') {
          const now = new Date();
          return zones.filter(zone => {
            if (!zone.end_date) return true; // Keep zones without end_date
            const endDate = new Date(zone.end_date);
            return endDate >= now; // Only keep zones that haven't expired
          });
        }
        return zones || [];
      }),
      tap(zones => {
        // Cache the result
        if (zones) {
          this.zoneCache.setCached(cacheKey, zones);
        }
      }),
      catchError(error => {
        if (error.status === 401) {
          return of([]);
        }
        console.error('[ZoneService] Error fetching zones by category:', error);
        return of([]);
      })
    );
    
    // Convert to promise for loading promise tracking
    const fetchPromise = firstValueFrom(fetchObservable);
    this.zoneCache.setLoadingPromise(cacheKey, fetchPromise);
    
    return fetchObservable;
  }

  getGeneralRedZones(): Observable<Zone[]> {
    // Use getZonesByTypeAndCategory to get all red zones (no category filtering)
    return this.getZonesByTypeAndCategory('RED', '');
  }

  getZoneById(id: number, source?: string): Observable<Zone | null> {
    let url = `${this.API_URL}/zones/${id}`;
    if (source) {
      url += `?source=${encodeURIComponent(source)}`;
    }
    return this.http.get<Zone>(url).pipe(
      catchError(error => {
        console.error('[ZoneService] Error fetching zone:', error);
        if (error.status === 401) {
          return of(null);
        }
        throw error;
      })
    );
  }

  createZone(zoneData: any): Observable<Zone> {
    return this.http.post<Zone>(`${this.API_URL}/zones`, zoneData).pipe(
      map(zone => {
        // Clear cache when zone is created
        this.zoneCache.clearCache();
        return zone;
      })
    );
  }

  updateZone(id: number, zoneData: any): Observable<Zone> {
    return this.http.put<Zone>(`${this.API_URL}/zones/${id}`, zoneData).pipe(
      map(zone => {
        // Clear cache when zone is updated
        this.zoneCache.clearCache();
        return zone;
      })
    );
  }

  deleteZone(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}/zones/${id}`).pipe(
      map(result => {
        // Clear cache when zone is deleted
        this.zoneCache.clearCache();
        return result;
      })
    );
  }

  submitZoneForApproval(id: number): Observable<Zone> {
    return this.http.put<Zone>(`${this.API_URL}/zones/${id}/submit`, {});
  }

  getStateBoundaries(): Observable<Zone[]> {
    const cacheKey = 'state_boundaries';
    
    // Check cache first
    const cached = this.zoneCache.getCached(cacheKey);
    if (cached !== null) {
      return of(cached);
    }
    
    // Check if already loading
    const loadingPromise = this.zoneCache.getLoadingPromise(cacheKey);
    if (loadingPromise) {
      return from(loadingPromise);
    }
    
    const fetchObservable = this.http.get<Zone[]>(`${this.API_URL}/zones/states`).pipe(
      tap(states => {
        // Cache the result
        if (states) {
          this.zoneCache.setCached(cacheKey, states);
        }
      }),
      catchError(error => {
        console.error('[ZoneService] Error fetching state boundaries:', error);
        if (error.status === 401) {
          return of([]);
        }
        return of([]);
      })
    );
    
    // Convert to promise for loading promise tracking
    const fetchPromise = firstValueFrom(fetchObservable);
    this.zoneCache.setLoadingPromise(cacheKey, fetchPromise);
    
    return fetchObservable;
  }
}

