import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ConfigService } from '../../services/config.service';
import { ZoneService, Zone } from '../../services/zone.service';
import { FlightPlanService } from '../../services/flight-plan.service';
import { MapStateService } from '../../services/map-state.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, BehaviorSubject } from 'rxjs';
import { Constants, DATA_LAYERS } from '../../config/app-constants';
import { AutoSuggestSearchComponent } from '../auto-suggest-search/auto-suggest-search.component';

declare const google: any;

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AutoSuggestSearchComponent],
  template: `
    <div class="view-container">
      <app-auto-suggest-search [map]="map"></app-auto-suggest-search>
      <div id="map" class="map-container"></div>
      
      <!-- Coordinate Display -->
      <div id="coordinate-display" class="coordinate-display"></div>
      
      <!-- Visualization Menu -->
      <div class="visualization-panel" [ngClass]="(toggleVisualization | async) === false ? 'visualization-hidden' : 'visualization-visible'">
        <div class="visualization-header">
          <button class="visualization-toggle-btn" (click)="toggleVisualizationMenu()">
            <span class="arrw-ion" [ngClass]="(toggleVisualization | async) === false ? '' : 'rt'"></span>
          </button>
        </div>
        <div class="visualization-content" *ngIf="(toggleVisualization | async)">
          <div class="visualization-list">
            <div *ngFor="let layer of dataLayers" class="visualization-item">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  [(ngModel)]="layer.checked"
                  (change)="toggleLayerVisibility(layer)"
                  class="visualization-checkbox"
                />
                <span class="checkmark"></span>
                {{ layer.name }}
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Legend Section -->
      <div class="lgds-section" tabindex="1">
        <div class="lgds-bar" [ngClass]="(toggleLegends | async) === false ? '' : 'block'">
          <div class="lgds-heading">
            <div class="tooltipdatabody">
              <p class="tooltipdata">
                <strong> Note:</strong> The colors's opacity would change depending on the map'background
              </p>
            </div>
          </div>
          
          <ul class="zones">
            <li><span></span> Red</li>
            <li><span></span> Yellow</li>
          </ul>
        </div>

        <div class="lgds-btn">
          <button (click)="openLegends()">
            <span class="arrw-ion" [ngClass]="(toggleLegends | async) === false ? '' : 'rt'"></span> 
            Legends
          </button>
        </div>
      </div>
    </div>

    <div *ngIf="showZoneDetailsModal" class="modal-overlay" (click)="closeZoneDetailsModal()">
      <div class="modal-content zone-details-modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Zone Details</h3>
          <button type="button" class="modal-close-btn" (click)="closeZoneDetailsModal()" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body" *ngIf="selectedZone">
          <!-- Zone Name / DSR Number Header -->
          <div class="zone-header-section">
            <div class="zone-name-display">{{ selectedZone.name || 'N/A' }}</div>
            <div class="dsr-number-display">{{ formatDSRNumber(selectedZone.dsr_number || selectedZone.id) }}</div>
          </div>

          <!-- Zone Detail -->
          <div class="detail-row">
            <span class="detail-label">Zone Detail</span>
            <span class="detail-value">{{ getZoneDetail(selectedZone) }}</span>
          </div>

          <!-- Zone Type -->
          <div class="detail-row">
            <span class="detail-label">Zone Type</span>
            <span class="detail-value">{{ getZoneType(selectedZone) }}</span>
          </div>

          <!-- Start Date, Start Time -->
          <div class="detail-row" *ngIf="selectedZone.start_date">
            <span class="detail-label">Start Date, Start Time</span>
            <span class="detail-value">{{ formatDateTime(selectedZone.start_date) }}</span>
          </div>

          <!-- End Date, End Time -->
          <div class="detail-row" *ngIf="selectedZone.end_date">
            <span class="detail-label">End Date, End Time</span>
            <span class="detail-value">{{ formatDateTime(selectedZone.end_date) }}</span>
          </div>

          <!-- Height -->
          <div class="detail-row" *ngIf="selectedZone.min_altitude !== undefined || selectedZone.max_altitude !== undefined">
            <span class="detail-label">Height</span>
            <span class="detail-value">{{ formatHeight(selectedZone.min_altitude, selectedZone.max_altitude) }}</span>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-primary" (click)="closeZoneDetailsModal()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class MapComponent implements OnInit, AfterViewInit, OnDestroy {
  map: any = null;
  mapInitialized = false;
  layerObjects: { [key: string]: any } = {};
  layerDataCache: { [key: string]: Zone[] } = {};
  flightPlanDataLayer: any = null;
  showZoneDetailsModal = false;
  selectedZone: Zone | null = null;
  baseGreenLayer: any = null;
  toggleLegends: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  toggleVisualization: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
  dataLayers: any[] = [];

  constructor(
    private configService: ConfigService,
    private zoneService: ZoneService,
    private flightPlanService: FlightPlanService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private mapStateService: MapStateService
  ) {}

  ngOnInit() {
    // Initialize data layers with all checkboxes checked by default
    this.dataLayers = DATA_LAYERS.map(layer => ({ ...layer, checked: true }));
    // Pre-warm cache by loading state boundaries immediately
    this.zoneService.getStateBoundaries().subscribe(() => {
      console.log('[MapComponent] State boundaries pre-loaded into cache');
    });
    this.initializeGoogleMaps();
  }

  ngAfterViewInit() {
    setTimeout(() => this.tryInitializeMap(), 100);
  }

  ngOnDestroy() {
    // Remove keyboard event listener
    if (this.escapeKeyHandler) {
      document.removeEventListener('keydown', this.escapeKeyHandler);
    }
  }

  private escapeKeyHandler: ((event: KeyboardEvent) => void) | null = null;

  async initializeGoogleMaps() {
    try {
      await this.configService.initializeGoogleMaps();
      setTimeout(() => this.tryInitializeMap(), 200);
    } catch (error: any) {
      console.error('[MapComponent] Failed to initialize Google Maps:', error);
      let errorMsg = 'Failed to load Google Maps.\n\n';
      if (error.message && error.message.includes('RefererNotAllowed')) {
        errorMsg += 'API Key Restriction Error:\n';
        errorMsg += 'Your Google Maps API key is restricted and does not allow requests from localhost.\n\n';
        errorMsg += 'To fix this:\n';
        errorMsg += '1. Go to Google Cloud Console\n';
        errorMsg += '2. Navigate to APIs & Services > Credentials\n';
        errorMsg += '3. Edit your API key\n';
        errorMsg += '4. Under "Application restrictions", add:\n';
        errorMsg += '   - http://localhost:4200/*\n';
        errorMsg += '   - http://localhost:3000/*\n';
        errorMsg += '5. Save and wait 5 minutes for changes to propagate\n\n';
      } else {
        errorMsg += 'Please check:\n';
        errorMsg += '1. Backend is running\n';
        errorMsg += '2. GOOGLE_MAPS_API_KEY is set in backend .env\n';
        errorMsg += '3. API key is valid\n\n';
      }
      errorMsg += 'Check console for details.';
      alert(errorMsg);
    }
  }

  tryInitializeMap() {
    if (this.mapInitialized || this.map) return;

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      setTimeout(() => this.tryInitializeMap(), 100);
      return;
    }

    const google = (window as any).google;
    if (!this.configService.isGoogleMapsReady() || !google || !google.maps) {
      setTimeout(() => this.tryInitializeMap(), 200);
      return;
    }

    this.initializeGoogleMap();
  }

  initializeGoogleMap() {
    const mapElement = document.getElementById('map');
    if (!mapElement || (mapElement as any)._googleMapId) return;

    const google = (window as any).google;
    if (!google || !google.maps) return;

    const rect = mapElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setTimeout(() => this.initializeGoogleMap(), 100);
      return;
    }

    try {
      this.map = new google.maps.Map(mapElement, {
        center: { lat: 20.5937, lng: 78.9629 },
        zoom: 6,
        mapTypeId: 'roadmap',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: false,
        gestureHandling: 'greedy',
        disableDefaultUI: true,
        scrollwheel: true,
        draggable: true
      });

      (mapElement as any)._googleMapId = true;

      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        // Restore saved map state if available (from previous search)
        const savedState = this.mapStateService.getState();
        if (savedState && savedState.center && savedState.zoom) {
          this.map.setCenter(savedState.center);
          this.map.setZoom(savedState.zoom);
        }
        
        this.createBaseGreenLayer();
        this.initializeLayers();
        this.loadFlightPlans();
        this.initializeCoordinateDisplay();
        this.mapInitialized = true;
      });
      
      // Also save map state when user manually pans/zooms (optional)
      this.map.addListener('center_changed', () => {
        const center = this.map.getCenter();
        if (center) {
          this.mapStateService.updateCenter({ lat: center.lat(), lng: center.lng() });
        }
      });
      
      this.map.addListener('zoom_changed', () => {
        this.mapStateService.updateZoom(this.map.getZoom());
      });
    } catch (error) {
      console.error('[MapComponent] Error initializing Google Map:', error);
    }
  }

  createBaseGreenLayer() {
    // Base green layer is now handled by STATE zones
    // STATE zones will fill all areas with light green
    console.log('[MapComponent] Base green layer will be handled by STATE zones');
  }

  initializeLayers() {
    const google = (window as any).google;
    
    // Define z-index mapping for proper layer ordering
    // Level 0: stateBoundaries (background), Level 1: redZone, Level 2: airportRed, 
    // Level 3: airportYellow5_8, Level 4: airportYellow8_12, Level 5: internationalBoundary
    const zIndexMap: { [key: string]: number } = {
      'stateBoundaries': 0,
      'redZone': 1,
      'airportRed': 2,
      'airportYellow5_8': 3,
      'airportYellow8_12': 4,
      'internationalBoundary': 5
    };
    
    // Initialize layer objects (but don't add to map yet - we'll add them in z-index order)
    const layerTypes = ['stateBoundaries', 'redZone', 'airportRed', 'airportYellow5_8', 'airportYellow8_12', 'internationalBoundary'];
    
    layerTypes.forEach(layerType => {
      this.layerObjects[layerType] = new google.maps.Data();
      this.layerDataCache[layerType] = [];
      // Store z-index for later use
      (this.layerObjects[layerType] as any)._zIndex = zIndexMap[layerType] || 0;
    });

    console.log('[MapComponent] All layers initialized, loading data in z-index order...');

    // Load layers in z-index order to ensure proper visual stacking
    // Data layers are rendered in the order they're added to the map,
    // so we load them sequentially to ensure correct stacking
    const loadLayersSequentially = async () => {
      // Level 0: State boundaries FIRST as background layer (green fill)
      if (this.dataLayers.find(l => l.id === 'stateBoundaries')?.checked !== false) {
        await firstValueFrom(this.zoneService.getStateBoundaries())
          .then(() => {
            this.loadLayerData('stateBoundaries');
          })
          .catch(() => {});
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));
      }
      
      // Level 1: Red zones
      const redZoneLayer = this.dataLayers.find(l => l.id === 'redZone');
      if (redZoneLayer && redZoneLayer.checked) {
        await firstValueFrom(this.zoneService.getZones())
          .then(() => {
            this.loadLayerData('redZone');
          })
          .catch(() => {});
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));
      }
      
      // Level 2: Airport Red zones
      const airportRedLayer = this.dataLayers.find(l => l.id === 'airportRed');
      if (airportRedLayer && airportRedLayer.checked) {
        await firstValueFrom(this.zoneService.getZonesByTypeAndCategory('RED', 'AIRPORT'))
          .then(() => {
            this.loadLayerData('airportRed');
          })
          .catch(() => {});
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));
      }
      
      // Level 3: Airport Yellow (5-8km)
      const airportYellow5_8Layer = this.dataLayers.find(l => l.id === 'airportYellow5_8');
      if (airportYellow5_8Layer && airportYellow5_8Layer.checked) {
        await firstValueFrom(this.zoneService.getZones())
          .then(() => {
            this.loadLayerData('airportYellow5_8');
          })
          .catch(() => {});
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));
      }
      
      // Level 4: Airport Yellow (8-12km)
      const airportYellow8_12Layer = this.dataLayers.find(l => l.id === 'airportYellow8_12');
      if (airportYellow8_12Layer && airportYellow8_12Layer.checked) {
        await firstValueFrom(this.zoneService.getZonesByTypeAndCategory('YELLOW', 'AIRPORT'))
          .then(() => {
            this.loadLayerData('airportYellow8_12');
          })
          .catch(() => {});
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));
      }
      
      // Level 5: International Boundary (loaded last so it appears on top, but airport zones in Data layers will still be visible)
      const internationalBoundaryLayer = this.dataLayers.find(l => l.id === 'internationalBoundary');
      if (internationalBoundaryLayer && internationalBoundaryLayer.checked) {
        await firstValueFrom(this.zoneService.getZonesByCategory('BOUNDARY', '25'))
          .then(() => {
            this.loadLayerData('internationalBoundary');
          })
          .catch(() => {});
      }
    };
    
    loadLayersSequentially();
  }

  loadLayerData(layerType: string) {
    if (!this.map) return;

    const google = (window as any).google;
    if (!google || !google.maps) {
      console.error('[MapComponent] Google Maps not available for loading layer data');
      return;
    }

    // Store layerType in a const to prevent type narrowing issues
    // Use a helper function to check layer type without type narrowing
    const isYellowLayer = (lt: string): lt is 'airportYellow5_8' | 'airportYellow8_12' => {
      return lt === 'airportYellow5_8' || lt === 'airportYellow8_12';
    };
    const currentLayerType = layerType;

    if (!this.layerObjects[layerType]) {
      this.layerObjects[layerType] = new google.maps.Data();
      // Don't set map immediately - let the visibility check at the end handle it
      // This prevents interfering with other layers
    }

    const layer = this.layerObjects[layerType];
    let zonesPromise: Promise<Zone[]>;

    switch(layerType) {
      case 'stateBoundaries':
        zonesPromise = firstValueFrom(this.zoneService.getStateBoundaries()).catch(() => []);
        break;
      case 'airportRed':
        zonesPromise = firstValueFrom(this.zoneService.getZonesByTypeAndCategory('RED', 'AIRPORT')).catch(() => []);
        break;
      case 'airportYellow5_8':
        // Explicitly use geometries coming from airport_region_radius_0_to_8_km table (source: airport_0_8km)
        // Get all zones and filter by source to ensure we get the right ones
        zonesPromise = firstValueFrom(this.zoneService.getZones())
          .then(allZones => {
            console.log('[MapComponent] Total zones loaded:', allZones.length);
            const filtered = allZones.filter(z => {
              const dist = z.distance ? String(z.distance) : '';
              const matches = z.source === 'airport_0_8km' || 
                            (z.type === 'YELLOW' && z.category === 'AIRPORT' && 
                             (dist === '8' || dist === '5-8' || dist === '5-8km' || dist === '5_8' || dist === '5_8km'));
              if (matches) {
                console.log('[MapComponent] Found 5-8km zone:', z.name, 'source:', z.source, 'distance:', z.distance);
              }
              return matches;
            });
            console.log('[MapComponent] Filtered 5-8km zones:', filtered.length);
            return filtered;
          })
          .catch(() => []);
        break;
      case 'airportYellow8_12':
        // Use the same approach as create-flight-plan component (which works)
        // Get YELLOW AIRPORT zones and filter by distance
        console.log('[MapComponent] Loading airportYellow8_12 layer...');
        zonesPromise = firstValueFrom(this.zoneService.getZonesByTypeAndCategory('YELLOW', 'AIRPORT'))
          .then(zones => {
            console.log('[MapComponent] Total YELLOW AIRPORT zones loaded:', zones?.length || 0);
            const filtered = (zones || []).filter(z => {
              const dist = z.distance ? z.distance.toString() : '';
              const matches = dist === '12' || dist === '12km' || dist === '8-12' || dist === '8-12km' || dist === '8_12' || dist === '8_12km' ||
                             z.source === 'airport_0_12km' ||
                             (z.source && (z.source.includes('12km') || z.source.includes('0_12km')));
              
              if (matches) {
                console.log('[MapComponent] ✓ Found 8-12km zone:', z.name || z.id, 'source:', z.source, 'distance:', z.distance);
              }
              return matches;
            });
            console.log(`[MapComponent] ✓ Filtered ${filtered.length} zones for airportYellow8_12 layer`);
            if (filtered.length === 0) {
              console.warn('[MapComponent] ⚠️ No 8-12km zones found! Check source and distance fields in database.');
            }
            return filtered;
          })
          .catch((error) => {
            console.error('[MapComponent] Error loading airportYellow8_12 zones:', error);
            return [];
          });
        break;
      case 'internationalBoundary':
        zonesPromise = firstValueFrom(this.zoneService.getZonesByCategory('BOUNDARY', '25')).catch(() => []);
        break;
      case 'redZone':
        // Load ALL zones from backend (end_date >= NOW() AND status_code = 2)
        // Filter for red zones on the frontend based on Visualization menu
        zonesPromise = firstValueFrom(this.zoneService.getZones())
          .then(allZones => {
            // Filter for red zones on the frontend (backend returns standardized type='RED')
            // Exclude BOUNDARY category zones - they are handled by internationalBoundary layer
            const redZones = allZones.filter(zone => {
              return zone.type === 'RED' && zone.category !== 'BOUNDARY';
            });
            console.log('[MapComponent] Red zones filtered from all zones:', redZones.length, '(from total:', allZones.length, ')');
            if (redZones.length > 0) {
              console.log('[MapComponent] Sample red zone:', {
                id: redZones[0].id,
                name: redZones[0].name,
                type: redZones[0].type,
                category: redZones[0].category,
                source: redZones[0].source,
                hasGeometry: !!redZones[0].geometry
              });
            } else {
              console.warn('[MapComponent] No red zones found in the data.');
            }
            return redZones;
          })
          .catch(error => {
            console.error('[MapComponent] Error loading zones:', error);
            if (error.status === 401) {
              console.warn('[MapComponent] 401 Unauthorized - this is expected if authentication is not configured');
            }
            return [];
          });
        break;
      default:
        return;
    }

    zonesPromise.then(zones => {
      if (!zones || zones.length === 0) {
        console.log(`[MapComponent] ⚠️ No zones found for layer: ${currentLayerType}`);
        if (currentLayerType === 'stateBoundaries') {
          console.warn('[MapComponent] ⚠️ No state boundaries found - base green fill may not appear');
        }
        this.layerDataCache[layerType] = [];
        return;
      }

      console.log(`[MapComponent] 📍 Loading ${zones.length} zones for layer: ${currentLayerType}`);
      if (currentLayerType === 'stateBoundaries') {
        console.log(`[MapComponent] ✓ State boundaries found: ${zones.length} - will fill with light green as background`);
      }
      
      // Log summary of zones being loaded
      const zoneSummary = zones.map(z => ({
        id: z.id,
        name: z.name || 'Unnamed',
        type: z.type,
        category: z.category,
        source: z.source,
        distance: z.distance,
        start_date: z.start_date,
        end_date: z.end_date,
        hasGeometry: !!z.geometry
      }));
      console.log(`[MapComponent] Zone summary for ${currentLayerType}:`, zoneSummary);

      // Set layer on map BEFORE processing zones (if checkbox is checked)
      // This ensures the layer is ready to receive features
      const dataLayer = this.dataLayers.find(l => l.id === currentLayerType);
      const shouldBeVisible = !dataLayer || dataLayer.checked;
      
      if (shouldBeVisible && !layer.getMap()) {
        // Get z-index for this layer
        const layerZIndex = (layer as any)._zIndex || 0;
        // Add layer to map - this ensures proper z-index ordering
        // Google Maps Data layers are rendered in the order they're added
        layer.setMap(this.map);
        console.log('[MapComponent] Layer set on map before processing zones:', currentLayerType, 'z-index:', layerZIndex);
      } else if (!shouldBeVisible && layer.getMap()) {
        // If checkbox is unchecked, ensure layer is not on map
        layer.setMap(null);
        console.log('[MapComponent] Layer removed from map (unchecked) before processing zones:', currentLayerType);
      }

      zones.forEach(zone => {
        try {
          if (!zone.geometry) {
            console.warn('[MapComponent] Zone missing geometry:', zone.id || zone.name, 'layerType:', currentLayerType);
            return;
          }

          let geometry = zone.geometry;
          if (typeof geometry === 'string') {
            try {
              geometry = JSON.parse(geometry);
            } catch (parseError) {
              console.error('[MapComponent] Error parsing zone geometry:', parseError, zone.id || zone.name);
              return;
            }
          }

          // Validate geometry structure
          if (!geometry || !geometry.type) {
            console.warn('[MapComponent] Invalid geometry structure:', zone.id || zone.name);
            return;
          }

          let color = '#e74c3c';
          let fillOpacity = 0.6; // Increased opacity for darker red zones
          let strokeWeight = 2;
          let colorSetByLayerType = false;

          // Determine color based on layer type first (for pre-filtered layers)
          // This MUST take precedence over all other checks
          // Use currentLayerType to avoid TypeScript type narrowing issues
          if (currentLayerType === 'internationalBoundary' && zone.category === 'BOUNDARY') {
            // International boundary: dark red fill with dark red outline (25km boundary)
            color = '#8B0000'; // Dark red
            fillOpacity = 0.4; // Red fill inside the boundary (matching create-flight-plan)
            strokeWeight = 2;
            colorSetByLayerType = true;
          } else if (currentLayerType === 'airportYellow5_8') {
            color = '#f39c12'; // Orange-yellow for 5-8km
            fillOpacity = 0.35;
            strokeWeight = 2;
            colorSetByLayerType = true;
            console.log('[MapComponent] ✓ Setting yellow color for 5-8km zone:', zone.name || zone.id, 'source:', zone.source, 'color:', color);
          } else if (currentLayerType === 'airportYellow8_12') {
            color = '#f1c40f'; // Lighter yellow for 8-12km
            fillOpacity = 0.3;
            strokeWeight = 2;
            colorSetByLayerType = true;
            console.log('[MapComponent] ✓ Setting yellow color for 8-12km zone:', zone.name || zone.id, 'source:', zone.source, 'color:', color);
          } else if (zone.source === 'airport_0_8km' || zone.source === 'airport_0_12km') {
            // Also check source directly as fallback
            if (zone.source === 'airport_0_8km') {
              color = '#f39c12';
              fillOpacity = 0.35;
              strokeWeight = 2;
              colorSetByLayerType = true;
              console.log('[MapComponent] ✓ Setting yellow by source (8km):', zone.name || zone.id, 'color:', color);
            } else if (zone.source === 'airport_0_12km') {
              color = '#f1c40f';
              fillOpacity = 0.3;
              strokeWeight = 2;
              colorSetByLayerType = true;
              console.log('[MapComponent] ✓ Setting yellow by source (12km):', zone.name || zone.id, 'color:', color);
            }
          } else if (zone.type === 'RED') {
            if (zone.category === 'AIRPORT') {
              color = '#e74c3c';
              fillOpacity = 0.6; // Increased opacity for darker red
              strokeWeight = 3;
            } else if (zone.category === 'TEMPORARY') {
              color = '#c0392b';
              fillOpacity = 0.55; // Increased opacity for darker red
              strokeWeight = 2;
            } else {
              color = '#e74c3c';
              fillOpacity = 0.6; // Increased opacity for darker red
              strokeWeight = 2;
            }
          } else if (zone.type === 'YELLOW') {
            // Only apply this logic if not already set by layer type
            if (!isYellowLayer(currentLayerType)) {
              if (zone.category === 'AIRPORT') {
                const dist = zone.distance ? String(zone.distance) : '';
                if (dist === '8' || dist === '8km' || dist === '5-8' || dist === '5-8km' || dist === '5_8' || dist === '5_8km') {
                  color = '#f39c12'; // Orange-yellow for 5-8km
                  fillOpacity = 0.35;
                  strokeWeight = 2;
                } else if (dist === '12' || dist === '12km' || dist === '8-12' || dist === '8-12km' || dist === '8_12' || dist === '8_12km' ||
                           (zone.source && (zone.source.includes('12km') || zone.source.includes('0_12km')))) {
                  color = '#f1c40f'; // Lighter yellow for 8-12km
                  fillOpacity = 0.3;
                  strokeWeight = 2;
                } else {
                  // Default yellow for airport zones
                  color = '#f39c12';
                  fillOpacity = 0.35;
                  strokeWeight = 2;
                }
              } else {
                // General yellow zones
                color = '#f39c12';
                fillOpacity = 0.35;
                strokeWeight = 2;
              }
            }
          } else if (zone.type === 'GREEN') {
            color = '#27ae60';
            fillOpacity = 0.3;
            strokeWeight = 1;
          }

          // International boundary now uses Data layer like other zones
          // No special handling needed - it will go through normal Data layer flow

          // State boundaries should always be light green (background layer)
          if (currentLayerType === 'stateBoundaries' || zone.category === 'STATE_BOUNDARY') {
            color = '#90EE90'; // Light green
            fillOpacity = 0.45; // Increased opacity for darker green
            strokeWeight = 0; // No border for base fill
            colorSetByLayerType = true;
          }
          
          // If zone is not RED or YELLOW, make it light green as well
          if (!colorSetByLayerType && zone.type !== 'RED' && zone.type !== 'YELLOW' && zone.category !== 'BOUNDARY' && zone.category !== 'STATE_BOUNDARY') {
            color = '#90EE90'; // Light green for all other zones
            fillOpacity = 0.25;
            strokeWeight = 0;
          }

          const geoJSON = {
            type: 'Feature',
            geometry: geometry,
            properties: {
              name: zone.name,
              type: zone.type,
              category: zone.category,
              distance: zone.distance,
              id: zone.id,
              min_altitude: zone.min_altitude,
              max_altitude: zone.max_altitude,
              start_date: zone.start_date,
              end_date: zone.end_date,
              status: zone.status,
              source: zone.source
            }
          };

          // Layer should already be on map (set before the forEach loop)
          // Just verify it's still on map before adding features
          if (!layer.getMap() && shouldBeVisible) {
            // Safety check: if layer somehow got removed, add it back
            layer.setMap(this.map);
            console.log('[MapComponent] Layer re-added to map before adding feature:', currentLayerType);
          }

          try {
            const features = layer.addGeoJson(geoJSON);
            if (features && features.length > 0) {
              features.forEach((feature: any) => {
                // Force apply the color - ensure it's not red for yellow zones
                // For STATE_BOUNDARY and STATE layers, always use light green
                let finalColor = color;
                let finalOpacity = fillOpacity;
                
                if (currentLayerType === 'internationalBoundary' && feature.getProperty('properties')?.category === 'BOUNDARY') {
                  // International boundary: dark red fill with dark red outline (25km boundary)
                  finalColor = '#9B9000'; // Dark red
                  finalOpacity = 0.4; // Red fill inside the boundary
                  strokeWeight = 2;
                } else if (currentLayerType === 'stateBoundaries' || (feature.getProperty('properties')?.category === 'STATE_BOUNDARY')) {
                  finalColor = '#90EE90'; // Light green for state boundaries
                  finalOpacity = 0.45; // Increased opacity for darker green
                  strokeWeight = 0;
                } else if (currentLayerType === 'airportYellow5_8' || currentLayerType === 'airportYellow8_12') {
                  finalColor = (currentLayerType === 'airportYellow5_8' ? '#f39c12' : '#f1c40f');
                  finalOpacity = (currentLayerType === 'airportYellow5_8' ? 0.35 : 0.3);
                } else if (currentLayerType === 'airportRed' || currentLayerType === 'redZone' || 
                          (feature.getProperty('properties')?.type === 'RED')) {
                  // Ensure red zones are darker
                  if (finalOpacity < 0.55) {
                    finalOpacity = 0.6; // Darker red for all red zones
                  }
                }
                
                // Apply styling with z-index consideration
                // For airport zones (z-index 2, 3, 4), ensure borders are visible even inside international boundary
                const styleOptions: any = {
                  fillColor: finalColor,
                  fillOpacity: finalOpacity,
                  strokeColor: currentLayerType === 'internationalBoundary' ? '#8B0000' : // Dark red for international boundary
                               (currentLayerType === 'stateBoundaries' ? '#90EE90' : '#000000'), // Black outline for all other zones except state boundaries
                  strokeWeight: strokeWeight,
                  strokeOpacity: (currentLayerType === 'internationalBoundary' || currentLayerType === 'stateBoundaries') ? 
                                (currentLayerType === 'internationalBoundary' ? 1.0 : 0) : 1.0, // Full opacity for international boundary, none for state boundaries
                  clickable: true,
                  cursor: 'pointer'
                };
                
                // For airport zones, ensure thicker borders so they're visible on top of international boundary
                if (currentLayerType === 'airportRed' || currentLayerType === 'airportYellow5_8' || currentLayerType === 'airportYellow8_12') {
                  styleOptions.strokeWeight = 3; // Thicker border for airport zones
                  styleOptions.strokeOpacity = 1.0; // Full opacity for visibility
                }
                
                layer.overrideStyle(feature, styleOptions);
                
                if (currentLayerType === 'internationalBoundary') {
                  console.log('[MapComponent] ✓ Applied style to international boundary:', zone.name || zone.id, 'strokeColor:', styleOptions.strokeColor, 'strokeWeight:', styleOptions.strokeWeight);
                } else if (currentLayerType === 'stateBoundaries') {
                  console.log('[MapComponent] ✓ Applied light green to state boundary:', zone.name || zone.id, 'fillColor:', finalColor, 'opacity:', finalOpacity);
                } else if (currentLayerType === 'airportYellow5_8' || currentLayerType === 'airportYellow8_12') {
                  console.log('[MapComponent] ✓ Applied style to yellow zone:', zone.name || zone.id, 'fillColor:', finalColor, 'layerType:', currentLayerType);
                } else if (currentLayerType === 'redZone') {
                  console.log('[MapComponent] ✓ Applied style to red zone:', zone.name || zone.id, 'fillColor:', finalColor, 'opacity:', finalOpacity);
                }
              });
            } else {
              console.warn('[MapComponent] ⚠ No features returned from addGeoJson for zone:', zone.name || zone.id, 'layerType:', currentLayerType, 'geometry type:', geometry.type);
            }
          } catch (addError) {
            console.error('[MapComponent] Error adding zone to map layer:', addError, zone.name || zone.id, 'layerType:', currentLayerType);
          }

          if (!(layer as any)._clickListenerAdded) {
            layer.addListener('click', (event: any) => {
              if (event.feature) {
                const props = event.feature.getProperty('properties') || {};
                const fullZone = this.layerDataCache[layerType]?.find(z => 
                  (z.id && props.id && (z.id == props.id || z.id.toString() === props.id.toString())) ||
                  (z.name && props.name && z.name === props.name)
                );

                const zoneData = fullZone || {
                  id: props.id,
                  name: props.name || 'Zone',
                  type: props.type,
                  category: props.category,
                  distance: props.distance,
                  min_altitude: props.min_altitude,
                  max_altitude: props.max_altitude,
                  start_date: props.start_date,
                  end_date: props.end_date,
                  status: props.status,
                  source: props.source
                };

                this.openZoneDetailsModal(zoneData);
              }
            });
            (layer as any)._clickListenerAdded = true;
          }
        } catch (error) {
          console.error('[MapComponent] Error processing zone:', error);
        }
      });

      this.layerDataCache[layerType] = zones;
      
      // Ensure layer object is stored in layerObjects (safety check)
      if (!this.layerObjects[layerType] && layer) {
        console.warn(`[MapComponent] Layer object not in layerObjects for: ${currentLayerType}, storing it now`);
        this.layerObjects[layerType] = layer;
      }
      
      if (layer && layer.setMap) {
        // Ensure layer is on map - check if layer is checked in visualization menu
        // IMPORTANT: Only check visibility for the CURRENT layer being processed
        // This prevents affecting other layers when one layer is toggled/reloaded
        const dataLayer = this.dataLayers.find(l => l.id === currentLayerType);
        if (!dataLayer) {
          console.warn(`[MapComponent] Data layer config not found for: ${currentLayerType}`);
        }
        const shouldBeVisible = !dataLayer || dataLayer.checked;
        
        // Only modify THIS layer's visibility, not any other layers
        const currentLayerOnMap = layer.getMap() !== null;
        if (shouldBeVisible && !currentLayerOnMap) {
          layer.setMap(this.map);
          console.log('[MapComponent] Layer set on map:', currentLayerType);
        } else if (!shouldBeVisible && currentLayerOnMap) {
          layer.setMap(null);
          console.log('[MapComponent] Layer hidden (unchecked):', currentLayerType);
        }
        
        // Verify features are on the layer
        let featureCount = 0;
        if (layer.forEach) {
          layer.forEach((feature: any) => {
            featureCount++;
          });
        }
        console.log('[MapComponent] ✓ Layer', currentLayerType, 'completed:', featureCount, 'features on map', `(${zones.length} zones processed)`, shouldBeVisible ? '(visible)' : '(hidden)');
        
        // Special check for airportYellow8_12
        if (currentLayerType === 'airportYellow8_12') {
          console.log('[MapComponent] ✓✓✓ airportYellow8_12 layer loaded with', featureCount, 'features');
          if (featureCount === 0 && zones.length > 0) {
            console.warn('[MapComponent] ⚠️ airportYellow8_12: Zones loaded but no features on map! Check geometry format.');
          }
        }
        
        // International boundary now uses Data layer like other zones
        if (currentLayerType === 'internationalBoundary') {
          console.log('[MapComponent] ✓ International Boundary loaded with', featureCount, 'features (dark red outline only)');
          // Ensure it's stored in layerObjects for toggle access
          if (this.layerObjects[currentLayerType] !== layer) {
            this.layerObjects[currentLayerType] = layer;
            console.log('[MapComponent] ✓ International Boundary layer object stored in layerObjects');
          }
        }
      }
    }).catch(error => {
      console.error('[MapComponent] Error loading layer data:', layerType, error);
    });
  }


  loadFlightPlans() {
    if (!this.map) {
      console.warn('[MapComponent] Cannot load flight plans: map not initialized');
      return;
    }

    const google = (window as any).google;
    if (!google || !google.maps) {
      console.warn('[MapComponent] Cannot load flight plans: Google Maps not available');
      return;
    }

    // Create or reuse flight plan data layer
    if (!this.flightPlanDataLayer) {
      this.flightPlanDataLayer = new google.maps.Data();
      this.flightPlanDataLayer.setMap(this.map);
      console.log('[MapComponent] Flight plan data layer created and set on map');
    }

    this.flightPlanService.getFlightPlans().subscribe({
      next: (flightPlans) => {
        if (!flightPlans || flightPlans.length === 0) {
          console.log('[MapComponent] No flight plans to display');
          return;
        }

        console.log('[MapComponent] Loading', flightPlans.length, 'flight plans');

        flightPlans.forEach((fp: any) => {
          if (!fp.geometry) {
            console.warn('[MapComponent] Flight plan missing geometry:', fp.reference_id || fp.id);
            return;
          }

          let geometry = fp.geometry;
          if (typeof geometry === 'string') {
            try {
              geometry = JSON.parse(geometry);
            } catch (e) {
              console.error('[MapComponent] Error parsing flight plan geometry:', e, fp.reference_id || fp.id);
              return;
            }
          }

          let geoJsonToAdd: any;
          if (geometry.type === 'Feature') {
            geoJsonToAdd = geometry;
            // Ensure properties are set
            if (!geoJsonToAdd.properties) {
              geoJsonToAdd.properties = {};
            }
            geoJsonToAdd.properties.referenceId = fp.reference_id || '';
            geoJsonToAdd.properties.status = fp.status || '';
            geoJsonToAdd.properties.id = fp.id || null;
            geoJsonToAdd.properties.droneType = fp.drone_type || '';
            geoJsonToAdd.properties.pilotName = fp.pilot_name || '';
          } else if (geometry.type === 'FeatureCollection') {
            geoJsonToAdd = geometry;
          } else {
            // Wrap raw geometry in a Feature object
            geoJsonToAdd = {
              type: 'Feature',
              geometry: geometry,
              properties: {
                referenceId: fp.reference_id || '',
                status: fp.status || '',
                id: fp.id || null,
                droneType: fp.drone_type || '',
                pilotName: fp.pilot_name || ''
              }
            };
          }

          const color = fp.status === 'APPROVED' ? '#27ae60' : 
                       fp.status === 'REJECTED' ? '#e74c3c' : '#f39c12';

          try {
            const features = this.flightPlanDataLayer.addGeoJson(geoJsonToAdd);
            if (features && features.length > 0) {
              features.forEach((feature: any) => {
                this.flightPlanDataLayer.overrideStyle(feature, {
                  strokeColor: '#000000', // Black outline
                  strokeWeight: 3,
                  strokeOpacity: 1.0, // Full opacity for black outlines
                  clickable: true,
                  cursor: 'pointer'
                });
              });
              console.log('[MapComponent] Added flight plan to map:', fp.reference_id || fp.id, 'status:', fp.status);
            } else {
              console.warn('[MapComponent] No features returned for flight plan:', fp.reference_id || fp.id);
            }
          } catch (error) {
            console.error('[MapComponent] Error adding flight plan to map:', fp.reference_id || fp.id, error);
          }
        });

        // Add click listener for flight plans (only once)
        if (!(this.flightPlanDataLayer as any)._clickListenerAdded) {
          const googleMaps = google; // Capture google in closure
          const mapInstance = this.map; // Capture map in closure
          this.flightPlanDataLayer.addListener('click', (event: any) => {
            if (event.feature && googleMaps && googleMaps.maps) {
              const props = event.feature.getProperty('properties') || {};
              const infoWindow = new googleMaps.maps.InfoWindow({
                content: `
                  <div style="padding: 8px;">
                    <b>${props.referenceId || 'Flight Plan'}</b><br>
                    Status: ${props.status || 'N/A'}<br>
                    ${props.droneType ? `Drone: ${props.droneType}<br>` : ''}
                    ${props.pilotName ? `Pilot: ${props.pilotName}` : ''}
                  </div>
                `
              });
              if (event.latLng) {
                infoWindow.setPosition(event.latLng);
                infoWindow.open(mapInstance);
              }
            }
          });
          (this.flightPlanDataLayer as any)._clickListenerAdded = true;
          console.log('[MapComponent] Flight plan click listener added');
        }
      },
      error: (error) => {
        console.error('[MapComponent] Error loading flight plans:', error);
        // Don't show error if it's just a 401 (unauthorized) - that's expected without auth
        if (error.status !== 401) {
          console.warn('[MapComponent] Failed to load flight plans. This may be expected if authentication is not configured.');
        }
      }
    });
  }

  openZoneDetailsModal(zone: Zone) {
    console.log('[MapComponent] Opening zone details modal for zone:', zone);
    this.selectedZone = zone;
    this.showZoneDetailsModal = true;
    this.cdr.detectChanges();

    // Add ESC key listener to close modal
    this.escapeKeyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.showZoneDetailsModal) {
        this.closeZoneDetailsModal();
      }
    };
    document.addEventListener('keydown', this.escapeKeyHandler);

    // Fetch detailed zone data from backend if id and source are available
    if (zone.id && zone.source) {
      this.zoneService.getZoneById(zone.id, zone.source).subscribe({
        next: (zoneDetails) => {
          if (zoneDetails) {
            console.log('[MapComponent] Zone details loaded:', zoneDetails);
            this.selectedZone = zoneDetails;
            this.cdr.detectChanges();
          }
        },
        error: (error) => {
          console.error('[MapComponent] Error loading zone details:', error);
          // Keep the original zone data if API call fails
        }
      });
    }
  }

  closeZoneDetailsModal() {
    console.log('[MapComponent] Closing zone details modal');
    this.showZoneDetailsModal = false;
    this.selectedZone = null;
    
    // Remove ESC key listener
    if (this.escapeKeyHandler) {
      document.removeEventListener('keydown', this.escapeKeyHandler);
      this.escapeKeyHandler = null;
    }
    
    this.cdr.detectChanges();
  }

  formatDSRNumber(id: any): string {
    if (!id && id !== 0) return 'N/A';
    // Extract numeric part if it's already formatted (e.g., "DSRZONE00012710" -> "12710")
    let idStr = String(id);
    if (idStr.startsWith('DSRZONE')) {
      idStr = idStr.replace('DSRZONE', '');
    }
    // Remove leading zeros to get the actual number, then pad to 8 digits
    const numValue = parseInt(idStr, 10);
    if (isNaN(numValue)) return String(id);
    // Format as DSRZONE00012710 (pad with zeros to 8 digits)
    return `DSRZONE${String(numValue).padStart(8, '0')}`;
  }

  getZoneDetail(zone: Zone): string {
    if (!zone) return 'N/A';
    
    const type = zone.type || '';
    const category = zone.category || '';
    
    // Format: "Airspace - Red Zone"
    if (type === 'RED') {
      if (category === 'AIRPORT') {
        return 'Airspace - Airport Red Zone';
      } else if (category === 'TEMPORARY') {
        return 'Airspace - Temporary Red Zone';
      } else if (category === 'BOUNDARY') {
        return 'Airspace - International Boundary';
      } else {
        return 'Airspace - Red Zone';
      }
    } else if (type === 'YELLOW') {
      if (category === 'AIRPORT') {
        return 'Airspace - Airport Yellow Zone';
      } else {
        return 'Airspace - Yellow Zone';
      }
    } else if (type === 'GREEN') {
      return 'Airspace - Green Zone';
    }
    
    return `Airspace - ${type} Zone`;
  }

  getZoneType(zone: Zone): string {
    if (!zone) return 'N/A';
    
    // Use original_type if available, otherwise use geozone_type or type
    const originalType = (zone as any).original_type || zone.type || '';
    
    // Map common types to display names
    const typeMap: { [key: string]: string } = {
      'RESTRICTION': 'Restriction',
      'PROHIBITED': 'Prohibited',
      'RESTRICTED': 'Restricted',
      'PERMITTED': 'Permitted',
      'RED': 'Restriction',
      'YELLOW': 'Restricted',
      'GREEN': 'Permitted'
    };
    
    // Check if original_type contains any of these keywords
    const upperType = originalType.toUpperCase();
    for (const [key, value] of Object.entries(typeMap)) {
      if (upperType.includes(key)) {
        return value;
      }
    }
    
    // Default: return original type or formatted type
    return originalType || zone.type || 'N/A';
  }

  formatDateTime(dateTime: string | null | undefined): string {
    if (!dateTime) return 'N/A';
    
    try {
      // Handle both ISO string and date-only formats
      let date: Date;
      if (dateTime.includes('T')) {
        // Full ISO timestamp
        date = new Date(dateTime);
      } else if (dateTime.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Date-only format (YYYY-MM-DD), set time to 00:00:00
        date = new Date(dateTime + 'T00:00:00');
      } else {
        date = new Date(dateTime);
      }
      
      if (isNaN(date.getTime())) return 'N/A';
      
      // Format: "04 Dec, 2024 07:30 AM"
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const minutesStr = minutes < 10 ? '0' + minutes : minutes;
      
      return `${day} ${month}, ${year} ${hours}:${minutesStr} ${ampm}`;
    } catch (error) {
      console.error('[MapComponent] Error formatting date:', error);
      return String(dateTime);
    }
  }

  formatHeight(minAltitude: number | undefined, maxAltitude: number | undefined): string {
    const min = minAltitude !== undefined ? minAltitude : 0;
    const max = maxAltitude !== undefined ? maxAltitude : 0;
    
    if (min === 0 && max === 0) return 'N/A';
    if (min === max) return `${min}ft AGL`;
    
    return `${min}-${max}ft AGL`;
  }

  /**
   * Initialize coordinate display on mouse move
   * Similar to Airspace Map coordinate display functionality
   */
  initializeCoordinateDisplay() {
    if (!this.map) return;

    const google = (window as any).google;
    if (!google || !google.maps) return;

    const coordinateDisplayElement = document.getElementById('coordinate-display');
    if (!coordinateDisplayElement) return;

    // Add mousemove listener to map
    this.map.addListener('mousemove', (event: any) => {
      if (event.latLng) {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        
        // Display coordinates in decimal format
        const coordinateText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        coordinateDisplayElement.textContent = coordinateText;
      }
    });

    // Show initial coordinates at map center
    const center = this.map.getCenter();
    if (center) {
      const lat = center.lat();
      const lng = center.lng();
      coordinateDisplayElement.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  }

  /**
   * Convert decimal coordinates to degrees, minutes, seconds format
   * Similar to Airspace Map coordinate conversion
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
   * Toggle legend panel visibility
   * Similar to Airspace Map legend toggle functionality
   */
  openLegends() {
    this.toggleLegends.next(!this.toggleLegends.getValue());
  }

  /**
   * Toggle visualization menu visibility
   */
  toggleVisualizationMenu() {
    this.toggleVisualization.next(!this.toggleVisualization.getValue());
  }

  /**
   * Toggle layer visibility when checkbox is clicked
   */
  toggleLayerVisibility(layer: any) {
    if (!this.map) return;

    const layerId = layer.id;
    let layerObject = this.layerObjects[layerId];
    
    // Ensure layer object exists - initialize if it doesn't (safety check)
    if (!layerObject) {
      console.warn(`[MapComponent] Layer object not found for: ${layerId}, initializing...`);
      const google = (window as any).google;
      if (!google || !google.maps) {
        console.error(`[MapComponent] Google Maps not available for layer: ${layerId}`);
        return;
      }
      this.layerObjects[layerId] = new google.maps.Data();
      if (!this.layerDataCache[layerId]) {
        this.layerDataCache[layerId] = [];
      }
      layerObject = this.layerObjects[layerId];
      
      // Set z-index if it's a known layer type
      const zIndexMap: { [key: string]: number } = {
        'stateBoundaries': 0,
        'redZone': 1,
        'airportRed': 2,
        'airportYellow5_8': 3,
        'airportYellow8_12': 4,
        'internationalBoundary': 5
      };
      if (zIndexMap[layerId] !== undefined) {
        (layerObject as any)._zIndex = zIndexMap[layerId];
      }
    }
    
    // Check if layer is already in the desired state to prevent infinite loops
    const isCurrentlyVisible = layerObject && layerObject.getMap() !== null;
    const shouldBeVisible = layer.checked;
    
    // If already in correct state, don't do anything
    if (isCurrentlyVisible === shouldBeVisible) {
      return;
    }
    
    // Lazy load: If layer data hasn't been loaded yet, load it now
    if (layer.checked && (!this.layerDataCache[layerId] || this.layerDataCache[layerId]?.length === 0)) {
      console.log(`[MapComponent] Lazy loading layer: ${layerId}`);
      
      // Load the layer data
      this.loadLayerData(layerId);
      
      // Wait a bit for layer to initialize and load data
      setTimeout(() => {
        layerObject = this.layerObjects[layerId];
        if (!layerObject) {
          console.error(`[MapComponent] Layer object lost after loading: ${layerId}`);
          return;
        }
        // Check checkbox state again after loading (user might have unchecked it)
        const dataLayer = this.dataLayers.find(l => l.id === layerId);
        const shouldShow = !dataLayer || dataLayer.checked;
        if (shouldShow && !layerObject.getMap()) {
          layerObject.setMap(this.map);
          console.log(`[MapComponent] ✓ Layer ${layerId} loaded and shown`);
        } else if (!shouldShow && layerObject.getMap()) {
          layerObject.setMap(null);
          console.log(`[MapComponent] ✓ Layer ${layerId} loaded but hidden (unchecked)`);
        }
      }, 500);
      return;
    }
    
    // Only toggle if state actually needs to change
    if (layer.checked && !layerObject.getMap()) {
      // Show the layer
      layerObject.setMap(this.map);
      console.log(`[MapComponent] ✓ Layer ${layerId} shown`);
    } else if (!layer.checked && layerObject.getMap()) {
      // Hide the layer
      layerObject.setMap(null);
      console.log(`[MapComponent] ✓ Layer ${layerId} hidden`);
    }
  }
}

