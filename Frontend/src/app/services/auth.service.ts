// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  private loginUrl = `${environment.loginUrl}`;
  private registerUrl = `${environment.registerUrl}`;

  private fullNameSubject = new BehaviorSubject<string>(
    `${localStorage.getItem('first_name') || ''} ${localStorage.getItem('last_name') || ''}`.trim() || 'משתמש'
  );
  fullName$ = this.fullNameSubject.asObservable();

  private loggedInSubject = new BehaviorSubject<boolean>(!!localStorage.getItem('access_token'));
  isLoggedIn$ = this.loggedInSubject.asObservable();

  private roleSubject = new BehaviorSubject<string>(
    localStorage.getItem('role') || ''
  );
  role$ = this.roleSubject.asObservable();

  constructor(private http: HttpClient) {}

  // 🔐 Login
  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(this.loginUrl, { username, password });
  }

  // 👤 Register
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
    // Add the custom header here
    const headers = new HttpHeaders().set('X-Email-Operation', 'true');
    return this.http.post<any>(this.registerUrl, registerData, { headers });
  }

  // 🔄 Update full name across the app
  setFullName(firstName: string, lastName: string): void {
    localStorage.setItem('first_name', firstName);
    localStorage.setItem('last_name', lastName);
    const fullName = `${firstName} ${lastName}`;
    this.fullNameSubject.next(fullName);
  }

  getUserFullName(): string {
    return this.fullNameSubject.value;
  }

  // 🔄 Update login state
  setLoginState(isLoggedIn: boolean): void {
    this.loggedInSubject.next(isLoggedIn);
  }

  // 🚪 Logout
  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('username');
    localStorage.removeItem('first_name');
    localStorage.removeItem('last_name');
    localStorage.removeItem('employee_id');
    localStorage.removeItem('role');
    localStorage.removeItem('pending_feedback_ride');
    this.fullNameSubject.next('משתמש');
    this.roleSubject.next('');
    this.setLoginState(false);
  }

  getRole(): string {
    return this.roleSubject.value;
  }
  
  setRole(role: string): void {
    localStorage.setItem('role', role);
    this.roleSubject.next(role);
  }

  // 📧 Send password reset email
  requestPasswordReset(email: string): Observable<any> {
    // Add the custom header here
    const headers = new HttpHeaders().set('X-Email-Operation', 'true');
    return this.http.post(environment.forgotPassUrl, { email }, { headers });
  }

  // 📧 Retry email sending
  retryEmail(identifier: string, emailAction: string) {
    const body = { identifier_id: identifier, email_type: emailAction };
    const headers = new HttpHeaders().set('X-Email-Operation', 'true');
    return this.http.post(`${this.apiUrl}/emails/retry`, body, { headers });
  }


  resetPassword(token: string, newPassword: string) {
    return this.http.post(environment.resetPassUrl, {
      token,
      new_password: newPassword
    });
  }
}