import { Injectable } from '@angular/core';

/**
 * Map Handler Service
 * Provides utility functions for map operations
 * Similar to Airspace Map's MapHandlerService but adapted for Google Maps
 */
@Injectable({
  providedIn: 'root'
})
export class MapHandlerService {
  
  constructor() { }

  /**
   * Initialize map bounds for India
   * Returns bounds array [[south, west], [north, east]]
   */
  getIndiaBounds(): number[][] {
    // India bounds: [[8.07771586, 68.12381591], [37.0883474, 97.40783632]]
    return [[8.07771586, 68.12381591], [37.0883474, 97.40783632]];
  }

  /**
   * Get default map center (India center)
   */
  getDefaultCenter(): { lat: number; lng: number } {
    return { lat: 23.10, lng: 78.10 };
  }

  /**
   * Get default zoom level
   */
  getDefaultZoom(): number {
    return 5;
  }

  /**
   * Apply bounds to a Google Maps map instance
   */
  applyBounds(map: any, bounds: number[][]): void {
    if (!map || !bounds || bounds.length !== 2) return;

    const google = (window as any).google;
    if (!google || !google.maps) return;

    const southWest = new google.maps.LatLng(bounds[0][0], bounds[0][1]);
    const northEast = new google.maps.LatLng(bounds[1][0], bounds[1][1]);
    const boundsObj = new google.maps.LatLngBounds(southWest, northEast);

    map.fitBounds(boundsObj);
    map.setOptions({
      restriction: {
        latLngBounds: boundsObj,
        strictBounds: false
      },
      minZoom: map.getBounds() ? this.getBoundsZoom(map, boundsObj) : 4
    });
  }

  /**
   * Calculate appropriate zoom level for bounds
   */
  private getBoundsZoom(map: any, bounds: google.maps.LatLngBounds): number {
    const google = (window as any).google;
    if (!google || !google.maps) return 4;

    const mapDiv = map.getDiv();
    const mapWidth = mapDiv.offsetWidth;
    const mapHeight = mapDiv.offsetHeight;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();

    const latDiff = ne.lat() - sw.lat();
    const lngDiff = ne.lng() - sw.lng();

    const latZoom = Math.log2(360 * mapHeight / (256 * latDiff));
    const lngZoom = Math.log2(360 * mapWidth / (256 * lngDiff));

    return Math.min(Math.floor(Math.min(latZoom, lngZoom)), 18);
  }

  /**
   * Convert decimal coordinates to degrees, minutes, seconds format
   */
  toDegreesMinutesAndSeconds(coordinate: number): string {
    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

    return `${degrees}° ${minutes}' ${seconds}"`;
  }

  /**
   * Format coordinates for display
   */
  formatCoordinates(lat: number, lng: number, format: 'decimal' | 'dms' = 'decimal'): string {
    if (format === 'dms') {
      const latStr = this.toDegreesMinutesAndSeconds(lat);
      const lngStr = this.toDegreesMinutesAndSeconds(lng);
      const latCardinal = lat >= 0 ? 'N' : 'S';
      const lngCardinal = lng >= 0 ? 'E' : 'W';
      return `${latStr} ${latCardinal}, ${lngStr} ${lngCardinal}`;
    }
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}


