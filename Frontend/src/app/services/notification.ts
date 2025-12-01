import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { MyNotification } from '../models/notification';
import { environment } from '../../environments/environment';

export interface AdminNotificationResponse {
  detail: string;
  count: number;
  plate_number: string;
  vehicle_id: string;
  mileage: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private apiBase = environment.apiUrl;
  constructor(private http: HttpClient) {}
  public unreadCount$ = new BehaviorSubject<number>(0);
  getNotifications(): Observable<MyNotification[]> {
    const user_id = localStorage.getItem('employee_id') || '';
    return this.http.get<MyNotification[]>(
      `${this.apiBase}/notifications/${user_id}`
    );
  }
  getAdminNotifications(): Observable<AdminNotificationResponse> {
    return this.http.post<AdminNotificationResponse>(
      `${this.apiBase}/notifications/admin`,
      {}
    );
  }

  markNotificationAsSeen(notificationId: string): Observable<any> {
    return this.http.patch(
      `${this.apiBase}/notifications/${notificationId}/mark-seen`,
      {}
    );
  }

  markAllNotificationsAsSeen(): Observable<any> {
    return this.http.patch(`${this.apiBase}/notifications/mark-all-seen`, {});
  }
}
