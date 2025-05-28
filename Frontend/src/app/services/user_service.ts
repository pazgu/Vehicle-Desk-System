// user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '../models/user.model';
import { Observable } from 'rxjs';

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

}
