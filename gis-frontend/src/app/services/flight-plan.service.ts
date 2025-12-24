import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FlightPlan {
  id?: number;
  reference_id?: string;
  geometry?: any;
  start_time?: string;
  end_time?: string;
  min_altitude?: number;
  max_altitude?: number;
  drone_type?: string;
  operation_type?: string;
  status?: string;
}

export interface ValidationResult {
  valid: boolean;
  blockingZones?: any[];
  warnings?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class FlightPlanService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createFlightPlan(flightPlanData: any): Observable<FlightPlan> {
    return this.http.post<FlightPlan>(`${this.API_URL}/flight-plans`, flightPlanData);
  }

  getFlightPlans(): Observable<FlightPlan[]> {
    return this.http.get<FlightPlan[]>(`${this.API_URL}/flight-plans`).pipe(
      catchError(error => {
        if (error.status === 401) {
          return of([]);
        }
        console.error('[FlightPlanService] Error fetching flight plans:', error);
        return of([]);
      })
    );
  }

  getMyFlightPlans(): Observable<FlightPlan[]> {
    return this.http.get<FlightPlan[]>(`${this.API_URL}/flight-plans/my`).pipe(
      catchError(error => {
        if (error.status === 401) {
          return of([]);
        }
        console.error('[FlightPlanService] Error fetching my flight plans:', error);
        return of([]);
      })
    );
  }

  getFlightPlanById(id: number): Observable<FlightPlan> {
    return this.http.get<FlightPlan>(`${this.API_URL}/flight-plans/${id}`);
  }

  validateFlightPlan(flightPlanData: any): Observable<ValidationResult> {
    return this.http.post<ValidationResult>(`${this.API_URL}/flight-plans/validate`, flightPlanData);
  }

  getPendingFlightPlans(): Observable<FlightPlan[]> {
    return this.http.get<FlightPlan[]>(`${this.API_URL}/flight-plans/pending`).pipe(
      catchError(error => {
        if (error.status === 401) {
          return of([]);
        }
        console.error('[FlightPlanService] Error fetching pending flight plans:', error);
        return of([]);
      })
    );
  }

  approveFlightPlan(id: number): Observable<FlightPlan> {
    return this.http.put<FlightPlan>(`${this.API_URL}/flight-plans/${id}/approve`, {});
  }

  rejectFlightPlan(id: number, reason: string): Observable<FlightPlan> {
    return this.http.put<FlightPlan>(`${this.API_URL}/flight-plans/${id}/reject`, { reason });
  }
}

