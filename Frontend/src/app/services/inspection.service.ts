import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InspectionService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTodayInspections(): Observable<any[]> {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<any[]>(`${this.apiUrl}/inspections/today`, { headers });
  }
}
