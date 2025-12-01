import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class RideService {
  private baseUrl = environment.ordersBaseUrl;
  private distanceUrl = environment.distanceUrl;
  private supervisorUrl = environment.supervisorOrdersUrl;

  constructor(private http: HttpClient) {}

  createRide(data: any, user_id: string): Observable<any> {
    const token = localStorage.getItem('access_token');

    if (!token) {
      throw new Error('Access token not found in localStorage.');
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.post(`${this.baseUrl}/${user_id}`, data, { headers });
  }

  createSupervisorRide(data: any, user_id: string): Observable<any> {
    const token = localStorage.getItem('access_token');

    if (!token) {
      throw new Error('Access token not found in localStorage.');
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.post(`${this.supervisorUrl}/${user_id}`, data, {
      headers,
    });
  }

  getRideById(rideId: string): Observable<any> {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    let url = environment.ridesBaseUrl;
    return this.http.get(`${url}/${rideId}`, { headers });
  }

  updateRide(rideId: string, data: any): Observable<any> {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
    let url = environment.ordersBaseUrl;
    return this.http.patch(`${url}/${rideId}`, data, { headers });
  }

  startRide(rideId: string): Observable<any> {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.post(
      `${environment.apiUrl}/rides/${rideId}/start`,
      {},
      { headers }
    );
  }

  getRouteDistance(
    to: string,
    extraStops: string[] = []
  ): Observable<{ distance_km: number }> {
    const token = localStorage.getItem('access_token');
    if (!token) throw new Error('Access token not found in localStorage.');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

    const encodedTo = encodeURIComponent(to);
    const stopsQuery = extraStops
      .map((stop) => `extra_stops=${encodeURIComponent(stop)}`)
      .join('&');

    const url = `${this.distanceUrl}?to_city=${encodedTo}${
      stopsQuery ? '&' + stopsQuery : ''
    }`;

    return this.http.get<{ distance_km: number }>(url, { headers });
  }

  getDepartmentEmployees(
    user_id: string
  ): Observable<{ id: string; full_name: string }[]> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      throw new Error('Access token not found in localStorage.');
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    return this.http.get<{ id: string; full_name: string }[]>(
      `${environment.employeesByDepartmentUrl}${user_id}`,
      { headers }
    );
  }

  getRideStatusSummary(
    status?: string
  ): Observable<{ status: string; count: number }[]> {
    let url = `${environment.apiUrl}/analytics/ride-status-summary`;
    if (status && status.trim() !== '') {
      url += `?status=${encodeURIComponent(status)}`;
    }
    return this.http.get<{ status: string; count: number }[]>(url);
  }
}
