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
    return this.http.get<VehicleInItem[]>(url);  
  }

  getAvailableVehicles(): Observable<VehicleInItem[]>{
    const url = `${this.apiUrl}/all-vehicles/available`;
    return this.http.get<VehicleInItem[]>(url);  
  }

  getVehicleById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/vehicle/${id}`);
  }
}
