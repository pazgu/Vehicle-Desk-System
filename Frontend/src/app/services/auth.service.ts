import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private loginUrl = `${environment.loginUrl}`;
  private registerUrl = `${environment.registerUrl}`;

  constructor(private http: HttpClient) {}

  // Login: expects { username, password }
  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(this.loginUrl, { username, password });
  }

  // Register: expects object with first_name, last_name, username, etc.
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
  
logout(): void {
  localStorage.removeItem('token'); // or your token key
}

}
