// auth.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { LoginResponse, RegisterRequest } from '../models/user.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loginUrl = `${environment.loginUrl}`;
  private registerUrl = `${environment.registerUrl}`;


  constructor(private http: HttpClient) {}

  login(username: string, password: string) {
    return this.http.post(this.loginUrl, { username, password });
  }
  register(registerData: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.registerUrl}`, registerData);
  }
}
