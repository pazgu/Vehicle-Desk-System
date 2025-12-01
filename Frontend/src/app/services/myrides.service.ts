import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { of } from 'rxjs';
import { StartedRidesResponse } from '../models/ride.model';
export interface RebookData {
  id:string
  user_id: string;
  ride_type: string;
  start_datetime: string;
  end_datetime: string;
  start_location: string;
  stop: string;
  destination: string;
  estimated_distance: number;
  actual_distance_km: number;
  four_by_four_reason?: string | null;
  extended_ride_reason?: string | null;
  target_type?: string;
  extra_stops?: string[];   
  is_extended_request?: boolean;
}


export interface RebookRequest {
  old_ride_id: string;           
  new_ride: {                    
    user_id: string;
    vehicle_id?: string;
    ride_type: string;
    start_datetime: string;
    end_datetime: string;
    start_location: string;
    stop: string;                
    destination: string;
    estimated_distance_km: number;
    actual_distance_km?: number;
    status: string;
    license_check_passed?: boolean;
    submitted_at: string;
    emergency_event?: string;
    extra_stops?: string[];
    rejection_reason?: string;
    extended_ride_reason?: string;
    four_by_four_reason?: string;
  };
  [key: string]: any;
}

export interface HasPendingRebookResponse {
  has_pending: boolean;
}

@Injectable({
  providedIn: 'root'
})


export class MyRidesService {
  private allOrdersUrl = environment.allOrdersUrl;
  private pastOrdersUrl = environment.pastOrdersUrl;
  private futureOrdersUrl = environment.futureOrdersUrl;
private rebookData: RebookData | null = null;

  private apiBase = environment.apiUrl;


  constructor(private http: HttpClient) { }

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    });
  }

  getFutureOrders(userId: string, filters?: any): Observable<any> {
    const headers = this.getAuthHeaders();
    const orders = this.http.get(`${this.futureOrdersUrl}/${userId}`, {
      params: this.buildParams(filters),
      headers
    });
    return orders;
  }

  deleteOrder(orderId: string): Observable<any> {
    const headers = this.getAuthHeaders().set('Content-Type', 'application/json');
    
    return this.http.delete(`${this.allOrdersUrl}/${orderId}`, { headers });
  }

  getPastOrders(userId: string, filters?: any): Observable<any> {
    const headers = this.getAuthHeaders();
    
    const orders = this.http.get(`${this.pastOrdersUrl}/${userId}`, {
      params: this.buildParams(filters),
      headers
    });
    return orders;
  }

  getAllOrders(userId: string, filters?: any): Observable<any> {
    const token = localStorage.getItem('access_token');

    if (!token) {
      console.error('No token found');
      return of([]);
    }

    const headers = this.getAuthHeaders();

    return this.http.get(`${this.allOrdersUrl}/${userId}`, {
      params: this.buildParams(filters),
      headers
    });
  }

  private buildParams(filters: any): HttpParams {
    let params = new HttpParams();
    if (!filters) return params;

    if (filters.status) params = params.set('status', filters.status);
    if (filters.from_date) params = params.set('from_date', filters.from_date);
    if (filters.to_date) params = params.set('to_date', filters.to_date);

    return params;
  }

  checkStartedApprovedRides(): Observable<StartedRidesResponse> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<StartedRidesResponse>(environment.ridesSupposedToStartUrl, { headers });
  }

   getRebookData(reservationId: string): Observable<RebookData> {
    const headers = this.getAuthHeaders();
    return this.http.get<RebookData>(
      `${this.apiBase}/reservations/${reservationId}/rebook-data`,
      { headers }
    );
  }

  
 checkPendingRebook(): Observable<HasPendingRebookResponse> {
    const headers = this.getAuthHeaders();
    return this.http.get<HasPendingRebookResponse>(
      `${this.apiBase}/rides/has-pending-rebook`,
      { headers }
    );
  }

setRebookData(data: RebookData) {
  this.rebookData = data;
}

clearRebookData() {
  this.rebookData = null;
}

getRebookDatafromService() {
  return this.rebookData;
}

rebookReservation(payload: any) {
  return this.http.post(`${this.apiBase}/reservations/rebook`, payload);
}

isVip(): Observable<{ is_vip: boolean }> {
  return this.http.get<{ is_vip: boolean }>(`${this.apiBase}/is-vip`);
}



}
