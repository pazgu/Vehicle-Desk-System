import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { of } from 'rxjs';
import { StartedRidesResponse } from '../models/ride.model';

export interface RebookData {
  ride_id: string;           
  start_datetime: string;
  end_datetime: string;
  start_location: string;
  destination: string;
  passengers_count: number;
  reason?: string;
  [key: string]: any;
}

export interface RebookRequest {
  original_ride_id: string;   
  new_vehicle_id: string;    
  start_datetime: string;
  end_datetime: string;
  start_location: string;
  destination: string;
  passengers_count: number;
  reason?: string;
  [key: string]: any;
}
@Injectable({
  providedIn: 'root'
})


export class MyRidesService {
  private allOrdersUrl = environment.allOrdersUrl;
  private pastOrdersUrl = environment.pastOrdersUrl;
  private futureOrdersUrl = environment.futureOrdersUrl;

  private apiBase = 'http://127.0.0.1:8000/api';


  constructor(private http: HttpClient) { }

  // Helper method to create consistent headers
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

  rebookReservation(payload: RebookRequest): Observable<any> {
    const headers = this.getAuthHeaders().set('Content-Type', 'application/json');
    return this.http.post(
      `${this.apiBase}/reservations/rebook`,
      payload,
      { headers }
    );
  }


}
