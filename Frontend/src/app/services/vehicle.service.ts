import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VehicleOutItem } from '../models/vehicle-dashboard-item/vehicle-out-item.module';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VehicleService {
  private apiUrl = environment.apiUrl; 
  

  constructor(private http: HttpClient) { }

  getAllVehicles(): Observable<VehicleOutItem[]>{
    const url = `${this.apiUrl}/all-vehicles`;
    return this.http.get<VehicleOutItem[]>(url);  
  }
}
