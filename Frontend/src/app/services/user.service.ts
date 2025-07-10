import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_URL = 'https://your-backend-url.com/api'; // 🔁 Replace this when you get the real one

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
  constructor(private http: HttpClient) {}

  addNewUser(userData: NewUserPayload): Observable<any> {
    return this.http.post(`${API_URL}/add-user`, userData);
  }
}
