import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { VehicleInspection } from '../models/vehicle-inspections.model';
import { OrderCardItem } from '../models/order-card-item.module';

@Injectable({
  providedIn: 'root',
})
export class InspectionService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTodayInspections(): Observable<any[]> {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.get<any[]>(`${this.apiUrl}/inspections/today`, {
      headers,
    });
  }

  postInspection(inspectionData: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/vehicle-inspections`,
      inspectionData
    );
  }

  getCriticalIssues(): Observable<{
    inspections: VehicleInspection[];
    rides: OrderCardItem[];
  }> {
    return this.http.get<{
      inspections: VehicleInspection[];
      rides: OrderCardItem[];
    }>(`${this.apiUrl}/critical-issues`);
  }

  getUsers(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users`);
  }
}
