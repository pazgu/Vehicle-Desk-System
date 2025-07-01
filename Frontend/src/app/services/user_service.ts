// user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '../models/user.model';
import { Observable } from 'rxjs';


export interface NewUserPayload {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  employee_id?: string;
  role: 'admin' | 'employee' | 'supervisor' | 'inspector';
  department_id: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})

export class UserService {
private apiUrl = 'http://localhost:8000/api'; // or your actual backend base URL

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<User[]> {
  return this.http.get<User[]>(`${this.apiUrl}/user-data`);
  }
  getUserById(id: string): Observable<User> {
  return this.http.get<User>(`${this.apiUrl}/user-data/${id}`);
}
getRoles() {
  // This should return Observable<string[]> or your role type
  return this.http.get<string[]>('http://localhost:8000/api/roles');
}
  updateUser(userId: string, updateData: any) {
    return this.http.patch(`${this.apiUrl}/user-data-edit/${userId}`, updateData);
  }

addNewUser(userData: NewUserPayload) {
  const token = localStorage.getItem('token'); // assuming you save it on login

  const headers = {
    Authorization: `Bearer ${token}`,
  };

  return this.http.post(`${this.apiUrl}/add-user`, userData, { headers });
}

deleteUser(userId: string){
  const token = localStorage.getItem('token'); // assuming you save it on login

  const headers = {
    Authorization: `Bearer ${token}`,
  }
  return this.http.delete(`${this.apiUrl}/user-data/${userId}`, { headers });
}
getDepartments() {
  return this.http.get<{ id: string, name: string }[]>(`${this.apiUrl}/departments`);
}


}
