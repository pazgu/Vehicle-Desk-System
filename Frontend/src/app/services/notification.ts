import { Injectable } from '@angular/core';
import { HttpClient,HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { MyNotification } from '../models/notification';

export interface AdminNotificationResponse {
  detail: string;
  count: number;
  plate_number: string;
  vehicle_id: string;
  mileage: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiBase = 'http://127.0.0.1:8000/api';
  constructor(private http: HttpClient) {}
  public unreadCount$ = new BehaviorSubject<number>(0);
  getNotifications(): Observable<MyNotification[]> {
    const user_id = localStorage.getItem('employee_id') || ''; // Ensure user_id is defined
    return this.http.get<MyNotification[]>(`${this.apiBase}/notifications/${user_id}`);
  }
  getAdminNotifications(): Observable<AdminNotificationResponse> {
    return this.http.post<AdminNotificationResponse>(`${this.apiBase}/notifications/admin`, {});
  }
}
