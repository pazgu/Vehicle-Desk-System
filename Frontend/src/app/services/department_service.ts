import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DepartmentService {
  private apiUrl = environment.apiUrl; // Replace with actual base API URL

  constructor(private http: HttpClient) {}

  createDepartment( name: string, supervisor_id: string): Observable<any[]> {
    const url = `${this.apiUrl}/departments`;
    const payload = {  name, supervisor_id };
    return this.http.post<any[]>(url, payload);
  }

  editDepartment(departmentId: string, name: string, supervisor_id: string): Observable<any> {
    const url = `${this.apiUrl}/departments/${departmentId}`;
    const updateData = { name, supervisor_id };
    return this.http.patch<any>(url, updateData);
  }
}
