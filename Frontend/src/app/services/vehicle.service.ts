import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { VehicleInItem } from '../models/vehicle-dashboard-item/vehicle-in-use-item.module';
import { FuelType, FuelTypeResponse, VehicleOutItem } from '../models/vehicle-dashboard-item/vehicle-out-item.module';
import { Vehicle } from '../models/vehicle.model';
import { map } from 'rxjs/operators';
 import { of } from 'rxjs';

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
getAllVehiclesForNewRide(distance: number, rideDate: string, vehicleType: string): Observable<Vehicle[]> {
  const params: any = {
    distance_km: distance,
    ride_date: rideDate,
    type: vehicleType
  };

  return this.http.get<Vehicle[]>(`${environment.apiUrl}/all-vehicles-new-ride`, { params });
}


  getAvailableVehicles(): Observable<VehicleInItem[]> {
    const url = `${this.apiUrl}/all-vehicles/available`;
    return this.http.get<VehicleInItem[]>(url);
  }


  getVehicleById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/vehicle/${id}`);
  }

  updateVehicleStatus(id: string, new_status: string, freeze_reason?: string): Observable<any> {
    const url = `${this.apiUrl}/vehicles-status/${id}`;
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


getMostUsedVehiclesThisMonth(year: number, month: number): Observable<{ stats: VehicleInItem[] }> {
  const url = `${this.apiUrl}/vehicles/usage-stats`;
  return this.http.get<{ stats: VehicleInItem[] }>(url, {
    params: {
      range: 'month',
      year,
      month
    }
  });
}

getFuelTypeByVehicleId(vehicleId: string): Observable<FuelTypeResponse> {
  if (vehicleId) {
    return this.http.get<FuelTypeResponse>(`${this.apiUrl}/vehicles/${vehicleId}/fuel-type`);
  }
  const res: FuelTypeResponse = { vehicle_id: vehicleId, fuel_type: 'hybrid' as FuelType };
  return of(res);
}

  getVehicles(params: any): Observable<Vehicle[]> {
    return this.http.get<Vehicle[]>(`${this.apiUrl}/vehicles`, { params });
  }

  getVehicleTypes(): Observable<string[]> {
  return this.http.get<{ vehicle_types: string[] }>(`${this.apiUrl}/vehicles/types`).pipe(
    map(res => res.vehicle_types)
  );
}
deleteVehicle(vehicleId: string): Observable<void> {
  return this.http.delete<void>(`${environment.apiUrl}/vehicles/${vehicleId}`);
}

archiveVehicle(vehicleId: string) {
  return this.http.post(`${environment.apiUrl}/vehicles/${vehicleId}/archive`, {});
}

getArchivedVehicles(): Observable<VehicleInItem[]> {
  return this.http.get<VehicleInItem[]>(`${this.apiUrl}/archived-vehicles`);
}

deleteArchivedVehicle(vehicleId: string) {
  return this.http.delete(`${this.apiUrl}/archived-vehicles/${vehicleId}`);
}


restoreVehicle(vehicleId: string): Observable<any> {
  return this.http.put(`${this.apiUrl}/vehicles/${vehicleId}/restore`, {});
}

/**
 * Permanently delete a vehicle (only for archived vehicles)
 */
permanentlyDeleteVehicle(vehicleId: string): Observable<any> {
  return this.http.delete(`${this.apiUrl}/vehicles/${vehicleId}/permanent`);
}

uploadMileageReport(file: File): Observable<any> {
  const formData = new FormData();
  formData.append('file', file);

  return this.http.post(`${this.apiUrl}/admin/vehicles/mileage/upload`, formData);
}

updatemileage(vehicleId: string, mileage: number): Observable<any> {
  const body = { new_mileage: mileage };
  return this.http.patch(`${this.apiUrl}/vehicles/${vehicleId}/mileage`, body); 
}


}