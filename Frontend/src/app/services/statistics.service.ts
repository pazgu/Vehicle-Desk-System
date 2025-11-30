import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { NoShowStatsResponse } from '../models/no-show-stats.model';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { RideStartTimeStatsResponse } from '../models/ride-start-time-stats.model';


@Injectable({
  providedIn: 'root'
})
export class StatisticsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTopNoShowUsers(fromDate?: string, toDate?: string): Observable<NoShowStatsResponse> {
  let params = new HttpParams();

  if (fromDate) {
    const isoFrom = new Date(fromDate).toISOString();
    params = params.set('from_date', isoFrom);
  }

  if (toDate) {
    const isoTo = new Date(toDate).toISOString(); 
    params = params.set('to_date', isoTo);
  }

  const headers = new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token')}`);

  return this.http.get<NoShowStatsResponse>(environment.noShowStatsUrl, { headers, params }).pipe(
    catchError(err => {
      console.error('Failed to fetch no-show stats', err);
      return throwError(() => err);
    })
  );
}

  getRideStartTimeStats(fromDate?: string, toDate?: string): Observable<RideStartTimeStatsResponse> {
    let params = new HttpParams();

    if (fromDate) {
      const isoFrom = new Date(fromDate).toISOString();
      params = params.set('from_date', isoFrom);
    }

    if (toDate) {
      const isoTo = new Date(toDate).toISOString();
      params = params.set('to_date', isoTo);
    }

    const headers = new HttpHeaders().set(
      'Authorization',
      `Bearer ${localStorage.getItem('token')}`
    );

    const url = `${this.apiUrl}/statistics/ride-start-time`;

    return this.http
      .get<RideStartTimeStatsResponse>(url, { headers, params })
      .pipe(
        catchError((err) => {
          console.error('Failed to fetch ride start time stats', err);
          return throwError(() => err);
        })
      );
  }
}




