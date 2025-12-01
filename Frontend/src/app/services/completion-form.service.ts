import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { RideLocationItem } from '../models/ride.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class RideReportService {
  private CompletionFormUrl = environment.CompletionFormUrl;

  constructor(private http: HttpClient) {}

  submitCompletionForm(formData: any, token: string) {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });

    return this.http.post(this.CompletionFormUrl, formData, { headers });
  }
  getRidesWithLocations(): Observable<RideLocationItem[]> {
    const url = `${environment.rideLocationsUrl}`;
    return this.http.get<RideLocationItem[]>(url);
  }
}
