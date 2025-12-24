import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PlaceResult {
  placeName: string;
  placeAddress: string;
  showPlaceName: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlaceSearchService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Get place suggestions using Google Places Autocomplete
   * This will use Google Places API through the backend if available,
   * or use Google Places Autocomplete service directly in the frontend
   */
  async getSuggestions(query: string): Promise<{ ResponseCode: number; ResponseData?: { suggestedLocations: PlaceResult[] } }> {
    try {
      // Try using backend endpoint first (if available)
      // For now, we'll implement client-side Google Places Autocomplete
      // You can create a backend endpoint later to proxy Google Places API calls
      
      // This method will be called from the component which has access to Google Maps API
      // The actual Google Places Autocomplete will be handled in the component
      return {
        ResponseCode: 200,
        ResponseData: {
          suggestedLocations: []
        }
      };
    } catch (error) {
      console.error('Error fetching place suggestions:', error);
      return {
        ResponseCode: 500,
        ResponseData: {
          suggestedLocations: []
        }
      };
    }
  }

  /**
   * Get place details by place ID (for Google Places API)
   */
  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      // This will be handled via Google Places Service in the component
      return null;
    } catch (error) {
      console.error('Error fetching place details:', error);
      return null;
    }
  }
}




