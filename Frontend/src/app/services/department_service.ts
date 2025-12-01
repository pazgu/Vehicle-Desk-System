import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class DepartmentService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createDepartment(name: string, supervisor_id: string): Observable<any[]> {
    const url = `${this.apiUrl}/departments`;
    const payload = { name, supervisor_id };
    return this.http.post<any[]>(url, payload);
  }

  updateDepartment(
    departmentId: string,
    name: string,
    supervisor_id: string
  ): Observable<any> {
    const url = `${this.apiUrl}/departments/${departmentId}`;
    const updateData = { name, supervisor_id };
    return this.http.patch<any>(url, updateData);
  }

  deleteDepartment(departmentId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/departments/${departmentId}`);
  }

  getDepartments(): Observable<any> {
    return this.http.get(`${this.apiUrl}/departments`);
  }
  getDepartmentsWithSupervisors(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/departments`);
  }

  getSupervisors(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }
}
