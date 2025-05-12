import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private loginUrl = `${environment.loginUrl}`;
  private registerUrl = `${environment.registerUrl}`;
  private fullName: string | null = null;

  constructor(private http: HttpClient) {}

  // Login
  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(this.loginUrl, { username, password });
  }

  // Register
  register(registerData: { 
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    password: string;
    department_id: string;
    role: string;
    employee_id?: string;
  }): Observable<any> {
    return this.http.post<any>(this.registerUrl, registerData);
  }

  // Set Full Name
  setFullName(first_name: string, last_name: string) {
    this.fullName = `${first_name} ${last_name}`;
    localStorage.setItem('full_name', this.fullName);
    console.log(localStorage.getItem('full_name'));

    console.log(this.fullName)
  }

  // Get Full Name
  getUserFullName(): string {
    return this.fullName || localStorage.getItem('full_name') || 'משתמש';
  }

  // Optionally, clear the stored user info
  clearUserInfo() {
    this.fullName = null;
    localStorage.removeItem('full_name');
  }
}
