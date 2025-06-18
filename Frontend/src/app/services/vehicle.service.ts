import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { VehicleInItem } from '../models/vehicle-dashboard-item/vehicle-in-use-item.module';
import { VehicleOutItem } from '../models/vehicle-dashboard-item/vehicle-out-item.module';

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  private apiUrl = environment.apiUrl; 
  

  constructor(private http: HttpClient) { }

 getAllVehicles(status?: string, type?: string): Observable<VehicleInItem[]> {
  const url = `${this.apiUrl}/all-vehicles`;
  let params = new HttpParams();

  if (status) {
    switch (status) {
      case 'זמין':
        params = params.set('status', 'available');
        break;
      case 'בשימוש':
        params = params.set('status', 'in_use');
        break;
      case 'מוקפא':
        params = params.set('status', 'frozen');
        break;
    }
  }

  if (type) {
    params = params.set('type', type);
  }

  return this.http.get<VehicleInItem[]>(url, { params });
}

  getAvailableVehicles(): Observable<VehicleInItem[]>{
    const url = `${this.apiUrl}/all-vehicles/available`;
    return this.http.get<VehicleInItem[]>(url);  
  } 

  getVehicleById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/vehicle/${id}`);
  }

  updateVehicleStatus(id: string, new_status: string, freeze_reason?: string): Observable<any> {
  const url = `${this.apiUrl}/${id}/status`;
  const body = { new_status, freeze_reason }; // Adjust field names to match backend expectations
  console.log('Sending payload to backend:', body); // Log the payload
  return this.http.patch<any>(url, body);
}

getTodayInspections(): Observable<any[]> {
  return this.http.get<any[]>(`${environment.apiUrl}/inspections/today`);
}
 getPendingCars(): Observable<{ vehicle_id: string; date: string; period: string }[]> {
  return this.http.get<{ vehicle_id: string; date: string; period: string }[]>(`${environment.apiUrl}/orders/pending-cars`);
}

getAllVehiclesByStatus(status?: string): Observable<VehicleOutItem[]> {
  let params = new HttpParams();

  if (status) {
    params = params.set('status', status);
  }

  return this.http.get<VehicleOutItem[]>(environment.frozenVehiclesUrl, { params });
}



}
