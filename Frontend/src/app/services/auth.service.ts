// auth.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loginUrl = `${environment.loginUrl}`;

  constructor(private http: HttpClient) {}

  login(username: string, password: string) {
    return this.http.post(this.loginUrl, { username, password });
  }
}
