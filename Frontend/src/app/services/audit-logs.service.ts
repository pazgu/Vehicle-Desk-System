import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AuditLogs } from '../models/audit-logs/audit-logs.module';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuditLogsService {
  private apiUrl = environment.apiUrl; 
  

  constructor(private http: HttpClient) { }

  getAuditLogs(): Observable<AuditLogs[]>{
    const url = `${this.apiUrl}/audit-logs`;
    return this.http.get<AuditLogs[]>(url);  
  }
}
