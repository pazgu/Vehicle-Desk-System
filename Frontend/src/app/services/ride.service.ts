import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RideService {
  private baseUrl = 'http://localhost:8000/api/orders';

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
}
