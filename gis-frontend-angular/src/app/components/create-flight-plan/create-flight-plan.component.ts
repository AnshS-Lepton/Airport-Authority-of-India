import { Component, OnInit, AfterViewInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';
import { ZoneService } from '../../services/zone.service';
import { FlightPlanService } from '../../services/flight-plan.service';
import { BehaviorSubject } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { DATA_LAYERS } from '../../config/app-constants';

declare var google: any;

interface FlightPlanForm {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  minAltitude: number;
  maxAltitude: number;
  geometry: any;
}

interface DrawnOverlay {
  overlay: any;
  geoJSON: any;
  layerFeature: any;
}

@Component({
  selector: 'app-create-flight-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="view-container create-flight-plan-container">
      <div class="flight-plan-form-compact">
        <div class="form-section-compact flight-details-top">
          <div class="form-row-compact">
            <div class="form-group-compact">
              <label>Starts at:</label>
              <div class="datetime-input-wrapper">
                <input 
                  type="datetime-local" 
                  [(ngModel)]="startDateTimeLocal" 
                  (change)="onStartDateTimeChange()"
                  required 
                  class="datetime-input" />
              </div>
            </div>
            
            <div class="form-group-compact">
              <label>Ends at:</label>
              <div class="datetime-input-wrapper">
                <input 
                  type="datetime-local" 
                  [(ngModel)]="endDateTimeLocal" 
                  (change)="onEndDateTimeChange()"
                  required 
                  class="datetime-input" />
              </div>
            </div>
            
            <div class="form-group-compact min-height-group">
              <label>Min. Height (ft):</label>
              <input type="number" [(ngModel)]="flightPlanForm.minAltitude" min="0" step="1" required class="input-small" />
            </div>
            
            <div class="form-group-compact max-height-group">
              <label>Max. Height (ft):</label>
              <input type="number" [(ngModel)]="flightPlanForm.maxAltitude" min="0" step="1" required class="input-small" />
            </div>
            
            <div class="search-container-in-header">
              <label class="search-label">Search location by:</label>
              <div class="search-controls">
                <select class="search-type-dropdown" [(ngModel)]="searchType">
                  <option value="keyword">Keyword</option>
                  <option value="coordinates">Coordinates</option>
                </select>
                <div class="flight-plan-search-box">
                  <input 
                    type="text" 
                    [(ngModel)]="searchPlace" 
                    [placeholder]="searchType === 'keyword' ? 'Enter Keyword or place' : 'Enter coordinates...'"
                    autocomplete="off" 
                    class="flight-plan-search-input"
                    (keyup)="onSearchKey($event)"
                    (focus)="showSearchResults = true">
                  <span class="search-icon">🔍</span>
                  <button *ngIf="showCloseButton" (click)="clearSearch()" class="flight-plan-search-clear">×</button>
                  
                  <div class="flight-plan-search-results" *ngIf="showSearchResults && ((searchSuggestions$ | async)?.length || 0) > 0" id="flight-plan-search-results">
                    <ul>
                      <li 
                        *ngFor="let suggestion of (searchSuggestions$ | async); let i = index"
                        (click)="navigateToSearchPlace(suggestion)"
                        class="flight-plan-search-item">
                        {{ suggestion.showPlaceName }}
                      </li>
                    </ul>
                  </div>
                  
                  <div class="flight-plan-search-results" *ngIf="showSearchResults && (searchNoContent$ | async)">
                    <ul>
                      <li class="flight-plan-search-item">No results found</li>
                    </ul>
                  </div>
                </div>
                <button class="btn-submit-small" (click)="submitFlightPlan()" [disabled]="!canDraw() || !geometryDrawn">
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="form-section-compact map-section">
          <div id="flight-plan-map" class="map-container-full"></div>
          
          <!-- Visualization Menu -->
          <div class="visualization-panel" [ngClass]="(toggleVisualization | async) === false ? 'visualization-hidden' : 'visualization-visible'">
            <div class="visualization-header">
              <h3>Visualization</h3>
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
        </div>
      </div>
    </div>

    <div *ngIf="showProhibitedModal" class="modal-overlay" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h3>Flight Plan Prohibited</h3>
        <p>You are prohibited from flying in this area. The flight plan intersects with RED (prohibited) zones.</p>
        <button (click)="closeModal()" class="btn-primary">OK</button>
      </div>
    </div>

    <div *ngIf="showRequestRaisedModal" class="modal-overlay" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h3>Request Raised</h3>
        <p>Your request has been raised. The flight plan intersects with YELLOW (restricted) zones and requires approval.</p>
        <button (click)="closeModal()" class="btn-primary">OK</button>
      </div>
    </div>

    <div *ngIf="showNoPermissionModal" class="modal-overlay" (click)="closeModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <h3>No Permission Required</h3>
        <p>You require no permission for this flight plan. The area is in GREEN (permitted) zones or has no restrictions.</p>
        <button (click)="closeModal()" class="btn-primary">OK</button>
      </div>
    </div>
  `,
  styles: []
})
export class CreateFlightPlanComponent implements OnInit, AfterViewInit, OnDestroy {
  flightPlanForm: FlightPlanForm = {
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    minAltitude: 0,
    maxAltitude: 0,
    geometry: null
  };

  geometryDrawn = false;
  drawingMode: string | null = null;
  showProhibitedModal = false;
  showRequestRaisedModal = false;
  showNoPermissionModal = false;

  flightPlanMap: any = null;
  private flightPlanLayer: any = null;
  private drawingManager: any = null;
  private zoneLayers: { [key: string]: any } = {};
  private layerObjects: { [key: string]: any } = {};
  private mapInitialized = false;
  private drawnOverlays: DrawnOverlay[] = [];
  
  // Visualization functionality
  toggleVisualization: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
  dataLayers: any[] = [];

  // Search functionality
  searchPlace: string = '';
  searchType: string = 'keyword';
  searchSuggestions$: BehaviorSubject<Array<any>> = new BehaviorSubject<Array<any>>([]);
  searchNoContent$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  showCloseButton: boolean = false;
  showSearchResults: boolean = false;
  private autocompleteService: any;
  private placesService: any;
  private searchMarker: any = null;
  private searchClickOutsideHandler: ((e: Event) => void) | null = null;
  
  // DateTime local strings for combined date/time inputs
  startDateTimeLocal: string = '';
  endDateTimeLocal: string = '';
  flightPlansCount: number = 0;

  constructor(
    private configService: ConfigService,
    private zoneService: ZoneService,
    private flightPlanService: FlightPlanService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Initialize data layers with all checkboxes checked by default
    this.dataLayers = DATA_LAYERS.map(layer => ({ ...layer, checked: true }));
    // Pre-warm cache by loading state boundaries immediately
    this.zoneService.getStateBoundaries().subscribe(() => {
      console.log('[CreateFlightPlanComponent] State boundaries pre-loaded into cache');
    });
    this.initializeGoogleMaps();
    this.updateDateTimeLocal();
    this.loadFlightPlansCount();
  }
  
  updateDateTimeLocal() {
    // Initialize datetime-local strings from form values
    if (this.flightPlanForm.startDate && this.flightPlanForm.startTime) {
      this.startDateTimeLocal = `${this.flightPlanForm.startDate}T${this.flightPlanForm.startTime}`;
    }
    if (this.flightPlanForm.endDate && this.flightPlanForm.endTime) {
      this.endDateTimeLocal = `${this.flightPlanForm.endDate}T${this.flightPlanForm.endTime}`;
    }
  }
  
  onStartDateTimeChange() {
    if (this.startDateTimeLocal) {
      const dt = new Date(this.startDateTimeLocal);
      this.flightPlanForm.startDate = dt.toISOString().split('T')[0];
      this.flightPlanForm.startTime = dt.toTimeString().split(' ')[0].substring(0, 5);
    }
  }
  
  onEndDateTimeChange() {
    if (this.endDateTimeLocal) {
      const dt = new Date(this.endDateTimeLocal);
      this.flightPlanForm.endDate = dt.toISOString().split('T')[0];
      this.flightPlanForm.endTime = dt.toTimeString().split(' ')[0].substring(0, 5);
    }
  }
  
  loadFlightPlansCount() {
    this.flightPlanService.getFlightPlans().subscribe({
      next: (plans) => {
        this.flightPlansCount = plans ? plans.length : 0;
      },
      error: () => {
        this.flightPlansCount = 0;
      }
    });
  }
  

  ngAfterViewInit() {
    setTimeout(() => this.initializeMap(), 300);
  }

  async initializeGoogleMaps() {
    try {
      await this.configService.initializeGoogleMaps();
    } catch (error: any) {
      console.error('[CreateFlightPlanComponent] Failed to initialize Google Maps:', error);
    }
  }

  initializeMap() {
    if (!this.configService.isGoogleMapsReady()) {
      setTimeout(() => this.initializeMap(), 200);
      return;
    }

    const google = (window as any).google;
    if (!google || !google.maps) {
      setTimeout(() => this.initializeMap(), 200);
      return;
    }

    const mapElement = document.getElementById('flight-plan-map');
    if (!mapElement) {
      setTimeout(() => this.initializeMap(), 200);
      return;
    }

    if (this.mapInitialized && this.flightPlanMap) {
      if (!this.zoneLayers['all'] || !this.zoneLayers['all'].getMap()) {
        this.loadZonesOnMap();
      }
      return;
    }

    const rect = mapElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setTimeout(() => this.initializeMap(), 200);
      return;
    }
    
    this.flightPlanMap = new google.maps.Map(mapElement, {
      center: { lat: 20.5937, lng: 78.9629 },
      zoom: 5,
      mapTypeId: 'roadmap',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });

    google.maps.event.addListenerOnce(this.flightPlanMap, 'idle', () => {
      google.maps.event.trigger(this.flightPlanMap, 'resize');
      setTimeout(() => {
        this.loadZonesOnMap();
        this.initializeSearchServices();
        this.setupSearchClickOutsideHandler();
        this.cdr.detectChanges();
      }, 500);
    });

    this.flightPlanLayer = new google.maps.Data();
    this.flightPlanLayer.setMap(this.flightPlanMap);

    this.drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: true,
      drawingControlOptions: {
        position: google.maps.ControlPosition.TOP_CENTER,
        drawingModes: [
          google.maps.drawing.OverlayType.POLYGON,
          google.maps.drawing.OverlayType.CIRCLE
        ]
      },
      polygonOptions: {
        fillColor: '#3498db',
        fillOpacity: 0.3,
        strokeColor: '#3498db',
        strokeWeight: 3,
        strokeOpacity: 0.8,
        clickable: false,
        editable: false,
        draggable: false
      },
      circleOptions: {
        fillColor: '#3498db',
        fillOpacity: 0.3,
        strokeColor: '#3498db',
        strokeWeight: 3,
        strokeOpacity: 0.8,
        clickable: false,
        editable: false,
        draggable: false
      }
    });

    this.drawingManager.setMap(this.flightPlanMap);

    google.maps.event.addListener(this.drawingManager, 'overlaycomplete', (event: any) => {
      let geoJSON: any = null;

      if (event.type === google.maps.drawing.OverlayType.POLYGON) {
        const polygon = event.overlay;
        const paths = polygon.getPath();
        const coordinates: number[][] = [];

        paths.forEach((latLng: any) => {
          coordinates.push([latLng.lng(), latLng.lat()]);
        });

        if (coordinates.length > 0) {
          const firstCoord = coordinates[0];
          const lastCoord = coordinates[coordinates.length - 1];
          if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
            coordinates.push([firstCoord[0], firstCoord[1]]);
          }
        }

        geoJSON = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          },
          properties: {}
        };

        const overlayItem: DrawnOverlay = {
          overlay: polygon,
          geoJSON: geoJSON,
          layerFeature: null
        };
        this.drawnOverlays.push(overlayItem);
        polygon.setMap(null);
      } else if (event.type === google.maps.drawing.OverlayType.CIRCLE) {
        const circle = event.overlay;
        const center = circle.getCenter();
        const radius = circle.getRadius();
        const points = 32;
        const coordinates: number[][] = [];

        for (let i = 0; i < points; i++) {
          const angle = (i * 360 / points) * (Math.PI / 180);
          const lat = center.lat() + (radius / 111320) * Math.cos(angle);
          const lng = center.lng() + (radius / (111320 * Math.cos(center.lat() * Math.PI / 180))) * Math.sin(angle);
          coordinates.push([lng, lat]);
        }
        coordinates.push(coordinates[0]);

        geoJSON = {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          },
          properties: {}
        };

        const overlayItem: DrawnOverlay = {
          overlay: circle,
          geoJSON: geoJSON,
          layerFeature: null
        };
        this.drawnOverlays.push(overlayItem);
        circle.setMap(null);
      }

      if (geoJSON) {
        this.flightPlanLayer.forEach((feature: any) => {
          this.flightPlanLayer.remove(feature);
        });

        const features = this.flightPlanLayer.addGeoJson(geoJSON);
        this.flightPlanLayer.setStyle({
          fillColor: '#3498db',
          fillOpacity: 0.3,
          strokeColor: '#3498db',
          strokeWeight: 3,
          strokeOpacity: 0.8
        });

        if (features && features.length > 0 && this.drawnOverlays.length > 0) {
          this.drawnOverlays[this.drawnOverlays.length - 1].layerFeature = features[0];
        }

        this.flightPlanForm.geometry = geoJSON.geometry || geoJSON;
        this.geometryDrawn = true;
        this.drawingMode = null;
        this.drawingManager.setDrawingMode(null);
        this.cdr.detectChanges();
      }
    });

    this.addCustomDrawingControls();
    this.mapInitialized = true;
  }

  addCustomDrawingControls() {
    if (!this.flightPlanMap) return;
    const google = (window as any).google;

    const controlDiv = document.createElement('div');
    controlDiv.style.cssText = 'margin: 10px 5px; display: flex; gap: 2px; align-items: center;';

    const undoButton = document.createElement('div');
    undoButton.innerHTML = '↶';
    undoButton.style.cssText = 'width: 40px; height: 40px; background-color: white; border: 1px solid rgba(0,0,0,0.2); border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 1px 4px rgba(0,0,0,0.3);';
    undoButton.title = 'Undo last drawing';
    undoButton.onclick = () => {
      this.undoLastDrawing();
    };

    const clearButton = document.createElement('div');
    clearButton.innerHTML = '×';
    clearButton.style.cssText = 'width: 40px; height: 40px; background-color: white; border: 1px solid rgba(0,0,0,0.2); border-radius: 2px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold; box-shadow: 0 1px 4px rgba(0,0,0,0.3);';
    clearButton.title = 'Clear all drawings';
    clearButton.onclick = () => {
      this.clearFlightPlan();
    };

    controlDiv.appendChild(undoButton);
    controlDiv.appendChild(clearButton);
    this.flightPlanMap.controls[google.maps.ControlPosition.TOP_CENTER].push(controlDiv);

    undoButton.style.display = this.geometryDrawn ? 'flex' : 'none';
    clearButton.style.display = this.geometryDrawn ? 'flex' : 'none';
  }

  loadZonesOnMap() {
    if (!this.flightPlanMap) {
      setTimeout(() => this.loadZonesOnMap(), 200);
      return;
    }

    Object.keys(this.zoneLayers).forEach(key => {
      if (this.zoneLayers[key] && this.zoneLayers[key].setMap) {
        this.zoneLayers[key].setMap(null);
      }
    });
    this.zoneLayers = {};
    // Don't clear layerObjects - they're needed for toggle functionality
    // this.layerObjects = {};

    const layerPromises: Promise<number>[] = [];

    // Load layers in z-index order to ensure proper visual stacking:
    // Level 0: stateBoundaries, Level 1: redZone, Level 2: airportRed,
    // Level 3: airportYellow5_8, Level 4: airportYellow8_12, Level 5: internationalBoundary
    
    // Level 0: State boundaries FIRST as background layer (green fill)
    layerPromises.push(
      firstValueFrom(this.zoneService.getStateBoundaries())
        .then(zones => this.loadZoneLayer('stateBoundaries', zones || [], '#90EE90', 0.45))
        .catch(() => 0)
    );

    // Level 1: Red zones
    layerPromises.push(
      firstValueFrom(this.zoneService.getGeneralRedZones())
        .then(allRedZones => {
          // Exclude BOUNDARY category zones - they are handled by internationalBoundary layer
          const redZones = (allRedZones || []).filter(zone => {
            return zone.category !== 'BOUNDARY';
          });
          return this.loadZoneLayer('redZone', redZones, '#e74c3c', 0.6); // Increased opacity for darker red
        })
        .catch(() => 0)
    );

    // Level 2: Airport Red zones
    layerPromises.push(
      firstValueFrom(this.zoneService.getZonesByTypeAndCategory('RED', 'AIRPORT'))
        .then(zones => this.loadZoneLayer('airportRed', zones || [], '#e74c3c', 0.6)) // Increased opacity for darker red
        .catch(() => 0)
    );

    // Level 3: Airport Yellow (5-8km)
    layerPromises.push(
      firstValueFrom(this.zoneService.getZonesByTypeAndCategory('YELLOW', 'AIRPORT'))
        .then(zones => {
          const filtered = (zones || []).filter(z => {
            const dist = z.distance ? z.distance.toString() : '';
            return dist === '8' || dist === '8km' || dist === '5-8' || dist === '5-8km' || dist === '5_8' || dist === '5_8km';
          });
          return this.loadZoneLayer('airportYellow5_8', filtered, '#f39c12', 0.35);
        })
        .catch(() => 0)
    );

    // Level 4: Airport Yellow (8-12km)
    layerPromises.push(
      firstValueFrom(this.zoneService.getZonesByTypeAndCategory('YELLOW', 'AIRPORT'))
        .then(zones => {
          const filtered = (zones || []).filter(z => {
            const dist = z.distance ? z.distance.toString() : '';
            return dist === '12' || dist === '12km' || dist === '8-12' || dist === '8-12km' || dist === '8_12' || dist === '8_12km' ||
                   (z.source && (z.source.includes('12km') || z.source.includes('0_12km')));
          });
          return this.loadZoneLayer('airportYellow8_12', filtered, '#f1c40f', 0.3);
        })
        .catch(() => 0)
    );

    // Level 5: International Boundary (loaded last so it appears on top, but airport zones in Data layers will still be visible)
    layerPromises.push(
      firstValueFrom(this.zoneService.getZonesByCategory('BOUNDARY', '25'))
        .then(zones => this.loadZoneLayer('internationalBoundary', zones || [], '#8B0000', 0.4)) // Dark red fill (matching main map)
        .catch(() => 0)
    );

    layerPromises.push(
      firstValueFrom(this.zoneService.getZonesByTypeAndCategory('RED', 'TEMPORARY'))
        .then(zones => this.loadZoneLayer('temporaryRedZone', zones || [], '#c0392b', 0.55)) // Increased opacity for darker red
        .catch(() => 0)
    );

    const google = (window as any).google;
    Promise.all(layerPromises).then(() => {
      google.maps.event.trigger(this.flightPlanMap, 'resize');
    });
  }

  loadZoneLayer(layerType: string, zones: any[], color: string, fillOpacity: number): number {
    if (!zones || zones.length === 0 || !this.flightPlanMap) return 0;
    const google = (window as any).google;

    const layer = new google.maps.Data();
    // Don't set map immediately - let the visibility check at the end handle it
    // This prevents interfering with other layers

    // Set layer on map BEFORE processing zones (if checkbox is checked)
    // This ensures the layer is ready to receive features
    const layerConfig = this.dataLayers.find(l => l.id === layerType);
    const shouldBeVisible = !layerConfig || layerConfig.checked;
    
    if (shouldBeVisible && !layer.getMap()) {
      // Add layer to map - this ensures proper z-index ordering
      // Google Maps Data layers are rendered in the order they're added
      layer.setMap(this.flightPlanMap);
      console.log('[CreateFlightPlanComponent] Layer set on map before processing zones:', layerType);
    } else if (!shouldBeVisible && layer.getMap()) {
      // If checkbox is unchecked, ensure layer is not on map
      layer.setMap(null);
      console.log('[CreateFlightPlanComponent] Layer removed from map (unchecked) before processing zones:', layerType);
    }

    let zonesAdded = 0;
    zones.forEach(zone => {
      if (!zone.geometry) return;

      let geometry = zone.geometry;
      if (typeof geometry === 'string') {
        try {
          geometry = JSON.parse(geometry);
        } catch (e) {
          return;
        }
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

      try {
        // International boundary now uses Data layer like other zones - no special handling needed
        // Layer should already be on map (set before the forEach loop)
        // Just verify it's still on map before adding features
        if (!layer.getMap() && shouldBeVisible) {
          // Safety check: if layer somehow got removed, add it back
          layer.setMap(this.flightPlanMap);
          console.log('[CreateFlightPlanComponent] Layer re-added to map before adding feature:', layerType);
        }
        
        const features = layer.addGeoJson(geoJSON);
        if (features && features.length > 0) {
          features.forEach((feature: any) => {
            // For state boundaries, use no stroke
            const isStateBoundary = layerType === 'stateBoundaries' || zone.category === 'STATE_BOUNDARY';
            
            // Determine final color and opacity based on layer type
            let finalColor = color;
            let finalOpacity = fillOpacity;
            let finalStrokeColor = isStateBoundary ? '#90EE90' : '#000000';
            let finalStrokeWeight = isStateBoundary ? 0 : 2;
            
            // International boundary: dark red fill with dark red outline (25km boundary)
            if (layerType === 'internationalBoundary' && zone.category === 'BOUNDARY') {
              finalColor = '#8B0000'; // Dark red
              finalOpacity = 0.4; // Red fill inside the boundary (matching main map)
              finalStrokeColor = '#8B0000'; // Dark red outline
              finalStrokeWeight = 2;
            }
            
            // Apply styling with z-index consideration
            // For airport zones, ensure thicker borders so they're visible on top of international boundary
            const styleOptions: any = {
              fillColor: finalColor,
              fillOpacity: finalOpacity,
              strokeColor: finalStrokeColor,
              strokeWeight: finalStrokeWeight,
              strokeOpacity: isStateBoundary ? 0 : 1.0, // Full opacity for outlines
              clickable: true,
              cursor: 'pointer'
            };
            
            // For airport zones, ensure thicker borders so they're visible on top of international boundary
            if (layerType === 'airportRed' || layerType === 'airportYellow5_8' || layerType === 'airportYellow8_12') {
              styleOptions.strokeWeight = 3; // Thicker border for airport zones
              styleOptions.strokeOpacity = 1.0; // Full opacity for visibility
            }
            
            layer.overrideStyle(feature, styleOptions);
          });
          zonesAdded++;
        }
      } catch (error) {
        console.error('[CreateFlightPlanComponent] Error adding zone to map:', error);
      }
    });

    this.zoneLayers[layerType] = layer;
    this.layerObjects[layerType] = layer;
    
    // Final visibility check - ensure layer state matches checkbox
    // (should already be set correctly above, but this is a safety check)
    const finalLayerConfig = this.dataLayers.find(l => l.id === layerType);
    if (finalLayerConfig && !finalLayerConfig.checked && layer.getMap()) {
      // If the layer is unchecked, ensure it's hidden
      layer.setMap(null);
    } else if (finalLayerConfig && finalLayerConfig.checked && !layer.getMap()) {
      // If the layer is checked, ensure it's shown
      layer.setMap(this.flightPlanMap);
    }
    
    return zonesAdded;
  }

  clearFlightPlan() {
    if (this.flightPlanLayer && this.flightPlanMap) {
      this.flightPlanLayer.forEach((feature: any) => {
        this.flightPlanLayer.remove(feature);
      });
    }
    this.drawnOverlays.forEach(item => {
      if (item.overlay) {
        item.overlay.setMap(null);
      }
    });
    this.drawnOverlays = [];
    if (this.drawingManager) {
      this.drawingManager.setDrawingMode(null);
    }
    this.flightPlanForm.geometry = null;
    this.geometryDrawn = false;
    this.drawingMode = null;
  }

  undoLastDrawing() {
    if (this.drawnOverlays.length === 0) return;

    const lastItem = this.drawnOverlays.pop();
    if (lastItem?.overlay) {
      lastItem.overlay.setMap(null);
    }
    if (lastItem?.layerFeature && this.flightPlanLayer) {
      this.flightPlanLayer.remove(lastItem.layerFeature);
    }

    if (this.drawnOverlays.length > 0) {
      const prevItem = this.drawnOverlays[this.drawnOverlays.length - 1];
      this.flightPlanForm.geometry = prevItem.geoJSON.geometry || prevItem.geoJSON;
      this.geometryDrawn = true;

      this.flightPlanLayer.forEach((feature: any) => {
        this.flightPlanLayer.remove(feature);
      });
      const features = this.flightPlanLayer.addGeoJson(prevItem.geoJSON);
      this.flightPlanLayer.setStyle({
        fillColor: '#3498db',
        fillOpacity: 0.3,
        strokeColor: '#3498db',
        strokeWeight: 3,
        strokeOpacity: 0.8
      });
      if (features && features.length > 0) {
        prevItem.layerFeature = features[0];
      }
    } else {
      this.flightPlanForm.geometry = null;
      this.geometryDrawn = false;
      if (this.flightPlanLayer) {
        this.flightPlanLayer.forEach((feature: any) => {
          this.flightPlanLayer.remove(feature);
        });
      }
    }
    this.cdr.detectChanges();
  }

  canDraw(): boolean {
    return !!(
      this.flightPlanForm.startDate &&
      this.flightPlanForm.startTime &&
      this.flightPlanForm.endDate &&
      this.flightPlanForm.endTime &&
      this.flightPlanForm.minAltitude > 0 &&
      this.flightPlanForm.maxAltitude > 0 &&
      this.flightPlanForm.maxAltitude >= this.flightPlanForm.minAltitude
    );
  }

  closeModal() {
    const wasRequestRaised = this.showRequestRaisedModal;
    const wasNoPermission = this.showNoPermissionModal;

    this.showProhibitedModal = false;
    this.showRequestRaisedModal = false;
    this.showNoPermissionModal = false;

    if (wasRequestRaised || wasNoPermission) {
      setTimeout(() => {
        this.clearFlightPlan();
        this.flightPlanForm = {
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          minAltitude: 0,
          maxAltitude: 0,
          geometry: null
        };
        this.router.navigate(['/']);
      }, 500);
    }
  }

  submitFlightPlan() {
    if (!this.geometryDrawn || !this.flightPlanForm.geometry) {
      alert('Please draw a flight area on the map before submitting.');
      return;
    }

    if (!this.flightPlanForm.startDate || !this.flightPlanForm.startTime ||
        !this.flightPlanForm.endDate || !this.flightPlanForm.endTime) {
      alert('Please fill all required fields.');
      return;
    }

    if (!this.flightPlanForm.minAltitude || this.flightPlanForm.minAltitude <= 0 ||
        !this.flightPlanForm.maxAltitude || this.flightPlanForm.maxAltitude <= 0 ||
        this.flightPlanForm.maxAltitude <= this.flightPlanForm.minAltitude) {
      alert('Please enter valid altitude values.');
      return;
    }

    const startDateTimeString = `${this.flightPlanForm.startDate}T${this.flightPlanForm.startTime}`;
    const endDateTimeString = `${this.flightPlanForm.endDate}T${this.flightPlanForm.endTime}`;
    const startDateTime = new Date(startDateTimeString);
    const endDateTime = new Date(endDateTimeString);

    if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime()) || endDateTime <= startDateTime) {
      alert('Please enter valid date/time values.');
      return;
    }

    const minAltitudeMeters = Math.round(this.flightPlanForm.minAltitude * 0.3048);
    const maxAltitudeMeters = Math.round(this.flightPlanForm.maxAltitude * 0.3048);

    const validationData = {
      geometry: this.flightPlanForm.geometry,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      min_altitude: minAltitudeMeters,
      max_altitude: maxAltitudeMeters
    };

    this.flightPlanService.validateFlightPlan(validationData).subscribe(
      validationResult => {
        if (!validationResult.valid || (validationResult.blockingZones && validationResult.blockingZones.length > 0)) {
          this.showProhibitedModal = true;
          return;
        }

        if (validationResult.warnings && validationResult.warnings.length > 0) {
          this.saveFlightPlan(startDateTime, endDateTime, minAltitudeMeters, maxAltitudeMeters, 'PENDING');
          this.showRequestRaisedModal = true;
          return;
        }

        this.saveFlightPlan(startDateTime, endDateTime, minAltitudeMeters, maxAltitudeMeters, 'SUBMITTED');
        this.showNoPermissionModal = true;
      },
      error => {
        console.error('[CreateFlightPlanComponent] Validation error:', error);
        alert('Error validating flight plan. Please check your inputs and try again.');
      }
    );
  }

  saveFlightPlan(startDateTime: Date, endDateTime: Date, minAltitudeMeters: number, maxAltitudeMeters: number, status: string) {
    const flightPlanData = {
      geometry: this.flightPlanForm.geometry,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      min_altitude: minAltitudeMeters,
      max_altitude: maxAltitudeMeters,
      drone_type: 'UAV',
      operation_type: 'Flight Operation',
      status: status
    };

    this.flightPlanService.createFlightPlan(flightPlanData).subscribe(
      response => {
        console.log('[CreateFlightPlanComponent] Flight plan saved:', response);
      },
      error => {
        console.error('[CreateFlightPlanComponent] Save error:', error);
        if (error.status !== 401) {
          alert('Error saving flight plan: ' + (error.error?.message || 'Unknown error'));
        }
      }
    );
  }

  // Search functionality methods
  initializeSearchServices() {
    const initPlacesService = () => {
      if (typeof google !== 'undefined' && google.maps && google.maps.places && this.flightPlanMap) {
        try {
          this.autocompleteService = new google.maps.places.AutocompleteService();
          this.placesService = new google.maps.places.PlacesService(this.flightPlanMap);
          console.log('[CreateFlightPlan] Google Places services initialized');
        } catch (error) {
          console.error('[CreateFlightPlan] Error initializing Places services:', error);
        }
      } else {
        setTimeout(initPlacesService, 200);
      }
    };
    initPlacesService();
  }

  setupSearchClickOutsideHandler() {
    setTimeout(() => {
      this.searchClickOutsideHandler = (e: Event) => {
        const target = e.target as HTMLElement;
        const searchBox = target?.closest('.flight-plan-search-box');
        if (!searchBox) {
          this.showSearchResults = false;
        }
      };
      document.addEventListener('click', this.searchClickOutsideHandler);
    }, 100);
  }

  onSearchKey(event: any) {
    const value = event.target.value;
    this.searchPlace = value;

    if (value.length === 0) {
      this.showCloseButton = false;
      this.searchSuggestions$.next([]);
      this.searchNoContent$.next(false);
      this.showSearchResults = false;
      
      // Remove marker and reset map to India view
      if (this.searchMarker) {
        this.searchMarker.setMap(null);
        this.searchMarker = null;
      }
      if (this.flightPlanMap) {
        this.flightPlanMap.setCenter({ lat: 20.5937, lng: 78.9629 });
        this.flightPlanMap.setZoom(5);
      }
      return;
    } else {
      this.showCloseButton = true;
    }

    if (value.length > 2 && this.autocompleteService) {
      this.searchPlaces(value);
    } else {
      this.searchSuggestions$.next([]);
      this.searchNoContent$.next(false);
    }
  }

  searchPlaces(query: string) {
    if (!this.autocompleteService) return;

    const request = {
      input: query,
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'in' }
    };

    this.autocompleteService.getPlacePredictions(request, (predictions: any, status: any) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
        const suggestions = predictions.map((pred: any) => ({
          placeId: pred.place_id,
          placeName: pred.description,
          showPlaceName: pred.description,
        }));
        this.searchSuggestions$.next(suggestions);
        this.searchNoContent$.next(false);
        this.showSearchResults = true;
      } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
        this.searchSuggestions$.next([]);
        this.searchNoContent$.next(true);
        this.showSearchResults = true;
      } else {
        this.searchSuggestions$.next([]);
        this.searchNoContent$.next(false);
      }
    });
  }

  navigateToSearchPlace(obj: any) {
    if (!obj || !this.placesService || !obj.placeId || !this.flightPlanMap) {
      return;
    }

    const request = {
      placeId: obj.placeId,
      fields: ['geometry', 'name', 'formatted_address'],
    };

    this.placesService.getDetails(request, (place: any, status: any) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        this.searchPlace = place.name || obj.placeName;

        // Remove existing marker
        if (this.searchMarker) {
          this.searchMarker.setMap(null);
          this.searchMarker = null;
        }

        // Create new marker
        this.searchMarker = new google.maps.Marker({
          position: { lat, lng },
          map: this.flightPlanMap,
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(32, 32),
          },
        });

        // Center and zoom map to the location
        this.flightPlanMap.setCenter({ lat, lng });
        this.flightPlanMap.setZoom(15);

        this.searchSuggestions$.next([]);
        this.searchNoContent$.next(false);
        this.showSearchResults = false;
        this.cdr.detectChanges();
      }
    });
  }

  clearSearch() {
    this.searchPlace = '';
    this.showCloseButton = false;
    this.searchSuggestions$.next([]);
    this.searchNoContent$.next(false);
    this.showSearchResults = false;

    // Remove marker
    if (this.searchMarker) {
      this.searchMarker.setMap(null);
      this.searchMarker = null;
    }

    // Reset map to India default view
    if (this.flightPlanMap) {
      this.flightPlanMap.setCenter({ lat: 20.5937, lng: 78.9629 });
      this.flightPlanMap.setZoom(5);
    }
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
    if (!this.flightPlanMap) return;

    const layerId = layer.id;
    let layerObject = this.layerObjects[layerId];
    
    // Ensure layer object exists - initialize if it doesn't (safety check)
    if (!layerObject) {
      console.warn(`[CreateFlightPlanComponent] Layer object not found for: ${layerId}, initializing...`);
      const google = (window as any).google;
      if (!google || !google.maps) {
        console.error(`[CreateFlightPlanComponent] Google Maps not available for layer: ${layerId}`);
        return;
      }
      this.layerObjects[layerId] = new google.maps.Data();
      layerObject = this.layerObjects[layerId];
    }
    
    // Check if layer is already in the desired state to prevent infinite loops
    const isCurrentlyVisible = layerObject && layerObject.getMap() !== null;
    const shouldBeVisible = layer.checked;
    
    // If already in correct state, don't do anything
    if (isCurrentlyVisible === shouldBeVisible) {
      return;
    }
    
    // International boundary now uses Data layer like other zones - no special handling needed
    
    // Only toggle if state actually needs to change
    if (layer.checked && !layerObject.getMap()) {
      // Show the layer
      layerObject.setMap(this.flightPlanMap);
      console.log(`[CreateFlightPlanComponent] ✓ Layer ${layerId} shown`);
    } else if (!layer.checked && layerObject.getMap()) {
      // Hide the layer
      layerObject.setMap(null);
      console.log(`[CreateFlightPlanComponent] ✓ Layer ${layerId} hidden`);
    }
  }

  ngOnDestroy() {
    // Cleanup search click outside handler
    if (this.searchClickOutsideHandler) {
      document.removeEventListener('click', this.searchClickOutsideHandler);
      this.searchClickOutsideHandler = null;
    }

    // Remove search marker
    if (this.searchMarker) {
      this.searchMarker.setMap(null);
      this.searchMarker = null;
    }
  }
}

