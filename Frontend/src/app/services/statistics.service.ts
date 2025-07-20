import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NoShowStatsResponse } from '../models/no-show-stats.model'; // adjust path if needed
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class StatisticsService {
  private apiUrl = environment.apiUrl; // <-- make sure this is defined in your env

  constructor(private http: HttpClient) {}

  getNoShowStatistics(fromDate?: string, toDate?: string): Observable<NoShowStatsResponse> {
    let params = new HttpParams();

    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);

    const headers = new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token')}`);

    return this.http.get<NoShowStatsResponse>(`${this.apiUrl}/statistics/no-shows`, { headers, params })
      .pipe(
        catchError(err => {
          console.error('Failed to fetch no-show stats', err);
          return throwError(() => err);
        })
      );
  }
}
