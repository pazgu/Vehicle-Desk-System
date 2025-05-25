// user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '../models/user.model';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})

export class UserService {
private apiUrl = 'http://localhost:8000'; // or your actual backend base URL

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<User[]> {
  return this.http.get<User[]>(`${this.apiUrl}/user-data`);
  }
  getUserById(id: string): Observable<User> {
  return this.http.get<User>(`${this.apiUrl}/user-data/${id}`);
}

}
