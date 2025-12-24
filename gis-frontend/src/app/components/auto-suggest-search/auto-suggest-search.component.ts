import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  ChangeDetectorRef,
  AfterViewInit,
} from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MapStateService } from '../../services/map-state.service';

declare var google: any;

@Component({
  selector: 'app-auto-suggest-search',
  templateUrl: './auto-suggest-search.component.html',
  styleUrls: ['./auto-suggest-search.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class AutoSuggestSearchComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() map: any; // Google Maps map instance
  @Input() hideDropdown: boolean = false; // Hide dropdown and show only keyword search

  selectedPlace: string = '';
  closeButton: BehaviorSubject<number> = new BehaviorSubject<number>(0);
  suggestion: BehaviorSubject<Array<any>> = new BehaviorSubject<Array<any>>([]);
  nocontentFlag: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  closeLatLongButton: number = 0;

  // Search type dropdown options
  options = [
    { id: 1, name: 'Keyword' },
    { id: 2, name: 'Coordinates' }
  ];
  
  selectDropdown = 1;
  obj = { 'lat': '', 'long': '', latlong: '' };

  // Google Places Autocomplete service
  autocompleteService: any;
  placesService: any;
  selectedMarker: any = null;
  private clickOutsideHandler: ((e: Event) => void) | null = null;

  constructor(
    private changeRef: ChangeDetectorRef,
    private mapStateService: MapStateService
  ) {}

  ngOnInit() {
    if (this.changeRef) {
      this.changeRef.reattach();
    }
    // Only setup click handler if we're on a page with a map
    if (this.map) {
      this.setupClickOutsideHandler();
    }
  }

  ngAfterViewInit() {
    // Initialize Google Places services after view is initialized
    // Wait for map to be available
    const initPlacesService = () => {
      if (typeof google !== 'undefined' && google.maps && google.maps.places && this.map) {
        try {
          this.autocompleteService = new google.maps.places.AutocompleteService();
          this.placesService = new google.maps.places.PlacesService(this.map);
          this.jsToBeLoaded();
          console.log('[AutoSuggestSearch] Google Places services initialized');
        } catch (error) {
          console.error('[AutoSuggestSearch] Error initializing Places services:', error);
        }
      } else {
        // Retry after a short delay
        setTimeout(initPlacesService, 200);
      }
    };
    
    initPlacesService();
  }

  ngOnDestroy() {
    // Remove click outside handler
    if (this.clickOutsideHandler) {
      document.removeEventListener('click', this.clickOutsideHandler);
      this.clickOutsideHandler = null;
    }
    
    if (this.changeRef) {
      this.changeRef.detach();
    }
    
    // Only cleanup if map exists
    if (this.map) {
      this.closeMarker(0);
    }
  }

  setupClickOutsideHandler() {
    // Hide suggestions when clicking outside
    setTimeout(() => {
      this.clickOutsideHandler = (e: Event) => {
        const resultsElement = document.getElementById('as-results-auto');
        const target = e.target as HTMLElement;
        const searchBox = target?.closest('.GeosearchBox');
        if (!searchBox && resultsElement) {
          resultsElement.style.display = 'none';
        }
      };
      document.addEventListener('click', this.clickOutsideHandler);
    }, 100);
  }

  detectChange() {
    if (this.changeRef) {
      this.changeRef.detectChanges();
    }
  }

  async onKey(event: any) {
    const value = event.target.value;

    const resultsElement = document.getElementById('as-results-auto');
    
    if (value.length === 0) {
      this.closeButton.next(0);
      if (resultsElement) {
        resultsElement.style.display = 'none';
      }
      return;
    } else {
      this.closeButton.next(1);
    }

    if (value.length > 2) {
      if (
        value.length < 40 &&
        event.keyCode !== 38 &&
        event.keyCode !== 40 &&
        event.keyCode !== 13 &&
        event.keyCode !== 27
      ) {
        await this.searchPlaces(value);
      }
    } else {
      this.suggestion.next([]);
      this.nocontentFlag.next(false);
      if (resultsElement) {
        resultsElement.style.display = 'none';
      }
      this.detectChange();
    }
  }

  async searchPlaces(query: string) {
    if (!this.autocompleteService) {
      console.warn('Google Places Autocomplete service not available');
      return;
    }

    try {
      this.autocompleteService.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'in' }, // Restrict to India
        },
        (predictions: any[], status: any) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            this.suggestion.next([]);
            this.detectChange();
            this.nocontentFlag.next(false);

            const arr = predictions.map((prediction) => ({
              placeName: prediction.structured_formatting.main_text,
              placeAddress: prediction.structured_formatting.secondary_text || '',
              showPlaceName: prediction.description,
              latitude: 0, // Will be fetched when selected
              longitude: 0, // Will be fetched when selected
              placeId: prediction.place_id,
            }));

            this.suggestion.next(arr);
            this.closeButton.next(1);
            this.detectChange();
            const resultsElement = document.getElementById('as-results-auto');
            if (resultsElement) {
              resultsElement.style.display = 'block';
            }
          } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            this.suggestion.next([]);
            this.detectChange();
            const resultsElement = document.getElementById('as-results-auto');
            if (resultsElement) {
              resultsElement.style.display = 'block';
            }
            this.nocontentFlag.next(true);
          } else {
            this.suggestion.next([]);
            this.nocontentFlag.next(false);
            const resultsElement = document.getElementById('as-results-auto');
            if (resultsElement) {
              resultsElement.style.display = 'none';
            }
          }
        }
      );
    } catch (error) {
      console.error('Error searching places:', error);
      this.suggestion.next([]);
      this.nocontentFlag.next(false);
    }
  }

  navigateToPlace(obj: any, i?: number) {
    if (!obj && this.suggestion.getValue().length > 0) {
      obj = this.suggestion.getValue()[i || 0];
    }

    if (!obj || !this.placesService || !obj.placeId) {
      return;
    }

    // Get place details using place_id
    const request = {
      placeId: obj.placeId,
      fields: ['geometry', 'name', 'formatted_address'],
    };

    this.placesService.getDetails(request, (place: any, status: any) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();

        this.selectedPlace = place.name || obj.placeName;
        this.validateLatLong(lat, lng);
        this.suggestion.next([]);
        this.nocontentFlag.next(false);
        const resultsElement = document.getElementById('as-results-auto');
        if (resultsElement) {
          resultsElement.style.display = 'none';
        }
        this.detectChange();
      }
    });
  }

  validateLatLong(lat: number, lng: number) {
    if (!this.map) return;

    // Remove existing marker
    if (this.selectedMarker) {
      this.selectedMarker.setMap(null);
      this.selectedMarker = null;
    }

    // Create new marker
    this.selectedMarker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      icon: {
        url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
        scaledSize: new google.maps.Size(32, 32),
      },
    });

    // Center and zoom map to the location
    this.map.setCenter({ lat, lng });
    this.map.setZoom(15);
    
    // Save map state for navigation to create-flight-plan
    this.mapStateService.updateState({ lat, lng }, 15);
  }

  closeMarker(key: number) {
    this.closeButton.next(0);
    this.closeLatLongButton = 0;

    if (key === 0) {
      if (this.selectedMarker) {
        this.selectedMarker.setMap(null);
        this.selectedMarker = null;
      }
      this.selectedPlace = '';
      const resultsElement = document.getElementById('as-results-auto');
      if (resultsElement) {
        resultsElement.style.display = 'none';
      }
      this.refreshLatLonEntry();
      this.detectChange();
    } else {
      this.closeButton.next(0);
      this.selectedPlace = '';
      this.detectChange();
    }
  }

  refreshLatLonEntry() {
    if (this.obj.latlong) {
      this.obj.latlong = '';
    }
    this.obj.lat = '';
    this.obj.long = '';
  }

  flyToLatlong() {
    if (!this.map || !this.obj.latlong) {
      return;
    }

    if (this.obj.latlong.includes(',')) {
      this.closeLatLongButton = 1;
      const parts = this.obj.latlong.split(',');
      this.obj.lat = parts[0].trim();
      this.obj.long = parts[1].trim();
    } else {
      alert('Invalid format. Please use: latitude,longitude');
      return;
    }

    // Handle DMS format (degrees, minutes, seconds)
    let lat = parseFloat(this.obj.lat);
    let lng = parseFloat(this.obj.long);

    if (this.obj.long.includes("'") && this.obj.lat.includes("'")) {
      // Parse DMS format: 28° 38' 35" N
      const parseDMS = (dms: string) => {
        dms = dms.replace(/[NSEW]/gi, '');
        const parts = dms.split(/[°'"]/);
        const degrees = parseFloat(parts[0]) || 0;
        const minutes = parseFloat(parts[1]) || 0;
        const seconds = parseFloat(parts[2]) || 0;
        return degrees + minutes / 60 + seconds / 3600;
      };

      lng = parseDMS(this.obj.long);
      lat = parseDMS(this.obj.lat);
    }

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      this.validateLatLong(lat, lng);
      this.suggestion.next([]);
      this.detectChange();
    } else {
      alert('Invalid coordinates. Please check your input.');
    }
  }

  onDropdownChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      const id = parseInt(target.value, 10);
      this.selectedDropdown(id);
    }
  }

  selectedDropdown(id: number) {
    this.selectDropdown = id;
    this.closeMarker(0);
    this.detectChange();
  }

  // Handle keyboard navigation
  jsToBeLoaded() {
    const that = this;
    let auto_value = '';
    let isSelected = -1;

    const inputElement = document.getElementById('auto');
    if (!inputElement) return;

    inputElement.addEventListener('input', (event: any) => {
      if (event.target.value.trim() === '') {
        auto_value = '';
        isSelected = -1;
      }
    });

    inputElement.addEventListener('keydown', (e: any) => {
      const suggestions = that.suggestion.getValue();

      if (e.keyCode === 38) {
        // Up arrow
        e.preventDefault();
        if (suggestions.length > 0) {
          isSelected = isSelected <= 0 ? suggestions.length - 1 : isSelected - 1;
          that.highlightSuggestion(isSelected);
        }
      } else if (e.keyCode === 40) {
        // Down arrow
        e.preventDefault();
        if (suggestions.length > 0) {
          isSelected = isSelected >= suggestions.length - 1 ? 0 : isSelected + 1;
          that.highlightSuggestion(isSelected);
        }
      } else if (e.keyCode === 13) {
        // Enter
        e.preventDefault();
        if (isSelected >= 0 && suggestions[isSelected]) {
          that.navigateToPlace(suggestions[isSelected], isSelected);
        }
      } else if (e.keyCode === 27) {
        // Escape
        const resultsElement = document.getElementById('as-results-auto');
        if (resultsElement) {
          resultsElement.style.display = 'none';
        }
        that.suggestion.next([]);
        that.detectChange();
      }
    });
  }

  highlightSuggestion(index: number) {
    const resultsElement = document.getElementById('as-results-auto');
    if (resultsElement) {
      const listItems = resultsElement.querySelectorAll('.as-result-item');
      listItems.forEach((li) => li.classList.remove('active'));
      if (listItems[index]) {
        listItems[index].classList.add('active');
      }
    }
    this.detectChange();
  }
}

