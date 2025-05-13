import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private loginUrl = `${environment.loginUrl}`;
  private registerUrl = `${environment.registerUrl}`;

  private fullNameSubject = new BehaviorSubject<string>(
    `${localStorage.getItem('first_name') || ''} ${localStorage.getItem('last_name') || ''}`.trim() || 'משתמש'
  );
  fullName$ = this.fullNameSubject.asObservable(); // For header display

  private loggedInSubject = new BehaviorSubject<boolean>(!!localStorage.getItem('access_token'));
  isLoggedIn$ = this.loggedInSubject.asObservable(); // For showing/hiding nav items

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
    return this.http.post<any>(this.registerUrl, registerData);
  }

  // 🧠 Update full name across the app
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
    localStorage.removeItem('role');
    this.fullNameSubject.next('משתמש');
    this.setLoginState(false);
  }
}
