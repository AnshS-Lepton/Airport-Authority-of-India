import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface MapState {
  center: { lat: number; lng: number };
  zoom: number;
}

@Injectable({
  providedIn: 'root'
})
export class MapStateService {
  private defaultState: MapState = {
    center: { lat: 20.5937, lng: 78.9629 },
    zoom: 6
  };

  private currentState: MapState = { ...this.defaultState };
  private stateSubject: BehaviorSubject<MapState> = new BehaviorSubject<MapState>(this.currentState);

  constructor() {}

  /**
   * Get current map state
   */
  getState(): MapState {
    return { ...this.currentState };
  }

  /**
   * Get state as observable
   */
  getStateObservable() {
    return this.stateSubject.asObservable();
  }

  /**
   * Update map state (center and zoom)
   */
  updateState(center: { lat: number; lng: number }, zoom: number): void {
    this.currentState = {
      center: { ...center },
      zoom: zoom
    };
    this.stateSubject.next(this.currentState);
    console.log('[MapStateService] Map state updated:', this.currentState);
  }

  /**
   * Update only center
   */
  updateCenter(center: { lat: number; lng: number }): void {
    this.currentState.center = { ...center };
    this.stateSubject.next(this.currentState);
  }

  /**
   * Update only zoom
   */
  updateZoom(zoom: number): void {
    this.currentState.zoom = zoom;
    this.stateSubject.next(this.currentState);
  }

  /**
   * Reset to default state
   */
  reset(): void {
    this.currentState = { ...this.defaultState };
    this.stateSubject.next(this.currentState);
  }
}




