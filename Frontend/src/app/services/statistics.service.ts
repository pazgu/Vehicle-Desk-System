import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { NoShowStatsResponse } from '../models/no-show-stats.model'; // adjust path if needed
import { environment } from '../../environments/environment';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StatisticsService {
  private apiUrl = environment.apiUrl; // <-- make sure this is defined in your env

  constructor(private http: HttpClient) {}

  getTopNoShowUsers(fromDate?: string, toDate?: string): Observable<NoShowStatsResponse> {
  let params = new HttpParams();

  if (fromDate) {
    const isoFrom = new Date(fromDate).toISOString(); // 👈 convert to datetime
    params = params.set('from_date', isoFrom);
  }

  if (toDate) {
    const isoTo = new Date(toDate).toISOString(); // 👈 convert to datetime
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

// getCompletedRidesCount(fromDate?: string, toDate?: string): Observable<number> {
//   let params = new HttpParams();

//   if (fromDate) {
//     params = params.set('from_date', new Date(fromDate).toISOString());
//   }
//   if (toDate) {
//     params = params.set('to_date', new Date(toDate).toISOString());
//   }

//   const headers = new HttpHeaders().set('Authorization', `Bearer ${localStorage.getItem('token')}`);
//   const url = `${environment.apiUrl}/statistics/completed-count`;

//   return this.http.get<{ completed_rides_count: number }>(url, { headers, params }).pipe(
//     map((response) => response.completed_rides_count),
//     catchError((err) => {
//       console.error('❌ Failed to fetch completed rides count:', err);
//       return throwError(() => err);
//     })
//   );
// }

}

