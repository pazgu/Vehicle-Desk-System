import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class VehicleTimelineService {

  constructor(private http: HttpClient) {}

  
  getVehicleTimeline(vehicleId: string, from: string, to: string): Observable<any[]> {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to);

    return this.http.get<any[]>(
      `${environment.apiUrl}/vehicles/${vehicleId}/timeline`,
      { params }
    );
  }
}