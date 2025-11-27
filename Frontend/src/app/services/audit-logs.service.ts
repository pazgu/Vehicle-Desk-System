import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditLogs } from '../models/audit-logs/audit-logs.module';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuditLogsService {
  private apiUrl = 'http://localhost:8000/api/all-audit-logs';
  private departmentsUrl = 'http://localhost:8000/api/departments';
  private usersUrl = 'http://localhost:8000/api/users';

  constructor(private http: HttpClient) { }

  getAuditLogs(fromDate?: string, toDate?: string, problematicOnly: boolean = false): Observable<AuditLogs[]> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    let params = new HttpParams();
    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);

    params = params.set('problematicOnly', problematicOnly.toString());
    return this.http.get<AuditLogs[]>(this.apiUrl, { headers, params });
  }

  getDepartments(): Observable<any[]> {
    return this.http.get<any[]>(this.departmentsUrl);
  }

  getUsers(): Observable<any> {
    return this.http.get<any>(this.usersUrl);
  }
}