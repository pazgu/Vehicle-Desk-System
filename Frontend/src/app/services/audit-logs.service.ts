import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditLogs } from '../models/audit-logs/audit-logs.module';

@Injectable({
  providedIn: 'root'
})
export class AuditLogsService {
  private apiUrl = 'http://localhost:8000/api/all-audit-logs';

  constructor(private http: HttpClient) {}

  getAuditLogs(): Observable<AuditLogs[]> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
    return this.http.get<AuditLogs[]>(this.apiUrl, { headers });
  }
}