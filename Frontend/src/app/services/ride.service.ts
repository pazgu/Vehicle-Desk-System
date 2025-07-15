import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RideService {
  private baseUrl = 'http://localhost:8000/api/orders';
  private distanceUrl = 'http://localhost:8000/api/distance'; // ✅ distance API URL


  constructor(private http: HttpClient) {}

  createRide(data: any, user_id: string): Observable<any> {
    const token = localStorage.getItem('access_token'); // ⬅️ get the token from login

    if (!token) {
      throw new Error('Access token not found in localStorage.');
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.post(`${this.baseUrl}/${user_id}`, data, { headers });
  }

getRideById(rideId: string): Observable<any> {
  const token = localStorage.getItem('access_token');
  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });
  

  return this.http.get(`http://localhost:8000/api/rides/${rideId}`, { headers });
}

updateRide(rideId: string, data: any): Observable<any> {
  const token = localStorage.getItem('access_token');
  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  return this.http.patch(`http://localhost:8000/api/orders/${rideId}`, data, { headers });
}

startRide(rideId: string): Observable<any> {
  const token = localStorage.getItem('access_token');
  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  return this.http.post(`${environment.apiUrl}/rides/${rideId}/start`, {}, { headers });
}


getArchivedOrders(userId: string): Observable<any[]> {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new Error('Access token not found in localStorage.');
  }

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  return this.http.get<any[]>(`http://localhost:8000/api/archived-orders/${userId}`, { headers });
}

// ✅ NEW: Fetch estimated distance from backend
// getDistance(from: string, to: string): Observable<{ distance_km: number }> {
//   const token = localStorage.getItem('access_token');
//   if (!token) throw new Error('Access token not found in localStorage.');
//   const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

//   const encodedFrom = encodeURIComponent(from);
//   const encodedTo = encodeURIComponent(to);

//   return this.http.get<{ distance_km: number }>(
//   `${this.distanceUrl}?from_city=${encodedFrom}&to_city=${encodedTo}`,
//   { headers }
// );
// }

getRouteDistance(to: string, extraStops: string[] = []): Observable<{ distance_km: number }> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Access token not found in localStorage.');
  const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

  const encodedTo = encodeURIComponent(to);
  const stopsQuery = extraStops.map(stop => `extra_stops=${encodeURIComponent(stop)}`).join('&');

  const url = `${this.distanceUrl}?to_city=${encodedTo}${stopsQuery ? '&' + stopsQuery : ''}`;

  return this.http.get<{ distance_km: number }>(url, { headers });
}



getDepartmentEmployees(user_id: string): Observable<{ id: string; full_name: string }[]> {
  const token = localStorage.getItem('access_token');
  if (!token) {
    throw new Error('Access token not found in localStorage.');
  }

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  return this.http.get<{ id: string; full_name: string }[]>(
    `http://localhost:8000/api/employees/by-department/${user_id}`,
    { headers }
  );
}




}
