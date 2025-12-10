import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { NoShowStatsResponse } from '../models/no-show-stats.model';
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';
import { RideStartTimeStatsResponse } from '../models/ride-start-time-stats.model';
import { PurposeOfTravelStatsResponse } from '../models/purpose-of-travel-stats.model';

@Injectable({
  providedIn: 'root',
})
export class StatisticsService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTopNoShowUsers(
    fromDate?: string,
    toDate?: string
  ): Observable<NoShowStatsResponse> {
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

    return this.http
      .get<NoShowStatsResponse>(environment.noShowStatsUrl, { headers, params })
      .pipe(
        catchError((err) => {
          console.error('Failed to fetch no-show stats', err);
          return throwError(() => err);
        })
      );
  }

  getRideStartTimeStats(
    fromDate?: string,
    toDate?: string
  ): Observable<RideStartTimeStatsResponse> {
    let params = new HttpParams();

    if (fromDate) {
      params = params.set('from_date', fromDate);
    }

    if (toDate) {
      params = params.set('to_date', toDate);
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

  getPurposeOfTravelStats(
    fromYear?: number,
    fromMonth?: number,
    toYear?: number,
    toMonth?: number
  ): Observable<PurposeOfTravelStatsResponse> {
    let params = new HttpParams();

    if (
      fromYear !== undefined &&
      fromMonth !== undefined &&
      toYear !== undefined &&
      toMonth !== undefined
    ) {
      params = params
        .set('from_year', fromYear.toString())
        .set('from_month', fromMonth.toString())
        .set('to_year', toYear.toString())
        .set('to_month', toMonth.toString());
    }

    const headers = new HttpHeaders().set(
      'Authorization',
      `Bearer ${localStorage.getItem('token')}`
    );

    const url = `${this.apiUrl}/statistics/purpose-of-travel`;

    console.log('Calling purpose-of-travel API:', url);
    console.log('Params:', params.toString());
    console.log('Token exists:', !!localStorage.getItem('token'));

    return this.http
      .get<PurposeOfTravelStatsResponse>(url, { headers, params })
      .pipe(
        map((response) => {
          console.log('Purpose stats received:', response);
          return response;
        }),
        catchError((err) => {
          console.error('Failed to fetch purpose-of-travel stats', err);
          console.error('Error details:', {
            status: err.status,
            statusText: err.statusText,
            url: err.url,
            message: err.message,
          });
          return throwError(() => err);
        })
      );
  }
}
