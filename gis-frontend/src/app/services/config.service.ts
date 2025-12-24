import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly API_URL = environment.apiUrl;
  private cachedApiKey: string | null = null;
  private loadingPromise: Promise<string> | null = null;
  private googleMapsLoaded = false;

  constructor(private http: HttpClient) {}

  /**
   * Get Google Maps API key from backend
   */
  getGoogleMapsApiKey(): Promise<string> {
    if (this.cachedApiKey) {
      return Promise.resolve(this.cachedApiKey);
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = firstValueFrom(
      this.http.get<{ apiKey: string }>(`${this.API_URL}/config/maps-key`)
    ).then(response => {
      this.cachedApiKey = response.apiKey;
      return this.cachedApiKey;
    }).catch(error => {
      console.error('[ConfigService] Failed to load Google Maps API key:', error);
      throw new Error('Failed to load Google Maps API key. Please ensure the backend is running and the API key is configured.');
    }).finally(() => {
      this.loadingPromise = null;
    });

    return this.loadingPromise;
  }

  /**
   * Load Google Maps JavaScript API dynamically
   */
  loadGoogleMapsAPI(apiKey: string, libraries: string = environment.googleMapsLibraries): Promise<void> {
    const google = (window as any).google;
    if (this.googleMapsLoaded && google && google.maps) {
      return Promise.resolve();
    }

    if (google && google.maps) {
      this.googleMapsLoaded = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // Check if script is already being loaded
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          this.googleMapsLoaded = true;
          resolve();
        });
        existingScript.addEventListener('error', () => {
          reject(new Error('Failed to load Google Maps API script'));
        });
        return;
      }

      // Create script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${libraries}&callback=initGoogleMaps`;
      script.async = true;
      script.defer = true;

      // Set up callback
      (window as any).initGoogleMaps = () => {
        this.googleMapsLoaded = true;
        console.log('[ConfigService] Google Maps API loaded successfully');
        delete (window as any).initGoogleMaps;
        resolve();
      };

      script.onerror = () => {
        console.error('[ConfigService] Failed to load Google Maps API script');
        delete (window as any).initGoogleMaps;
        reject(new Error('Failed to load Google Maps API script. Check your API key and network connection.'));
      };

      // Add script to document
      document.head.appendChild(script);
      console.log('[ConfigService] Loading Google Maps API with key:', apiKey ? apiKey.substring(0, 10) + '...' : 'NO KEY');
    });
  }

  /**
   * Initialize Google Maps API (get key and load script)
   */
  initializeGoogleMaps(): Promise<void> {
    return this.getGoogleMapsApiKey()
      .then(apiKey => this.loadGoogleMapsAPI(apiKey))
      .catch(error => {
        console.error('[ConfigService] Failed to initialize Google Maps:', error);
        throw error;
      });
  }

  /**
   * Check if Google Maps API is loaded and ready
   */
  isGoogleMapsReady(): boolean {
    const google = (window as any).google;
    return this.googleMapsLoaded && google && google.maps;
  }
}

