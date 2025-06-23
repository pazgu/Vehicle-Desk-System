import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditLogs } from '../models/audit-logs/audit-logs.module';

@Injectable({
  providedIn: 'root'
})
export class AuditLogsService {
  private apiUrl = 'http://localhost:8000/api/all-audit-logs';

  constructor(private http: HttpClient) {}

  getAuditLogs(fromDate?: string, toDate?: string, problematicOnly: boolean = false): Observable<AuditLogs[]> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    let params = new HttpParams();
    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);
    if (problematicOnly) params = params.set('problematic_only', 'true');

    return this.http.get<AuditLogs[]>(this.apiUrl, { headers, params });
  }
}