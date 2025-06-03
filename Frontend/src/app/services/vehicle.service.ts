import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { VehicleInItem } from '../models/vehicle-dashboard-item/vehicle-in-use-item.module';

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  private apiUrl = environment.apiUrl; 
  

  constructor(private http: HttpClient) { }

  getAllVehicles(): Observable<VehicleInItem[]>{
    const url = `${this.apiUrl}/all-vehicles`;
    console.log('📡 GET Request to:', url);
    return this.http.get<VehicleInItem[]>(url);  
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
 getPendingCars(): Observable<string[]> {
  return this.http.get<string[]>(`${environment.apiUrl}/orders/pending-cars`);
}

}
