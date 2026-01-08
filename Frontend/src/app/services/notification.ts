import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
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
  public unreadCount$ = new BehaviorSubject<number>(0);
    constructor(private http: HttpClient) {
    this.loadUnreadCount();
  }
    private loadUnreadCount(): void {
    const user_id = localStorage.getItem('employee_id');
    if (user_id) {
      this.getNotifications().subscribe(notifications => {
        const unreadCount = notifications.filter(n => !n.seen).length;
        this.unreadCount$.next(unreadCount);
      });
    }
  }
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
    ).pipe(
      tap(() => {
        const current = this.unreadCount$.getValue();
        if (current > 0) {
          this.unreadCount$.next(current - 1);
        }
      })
    );
  }

  markAllNotificationsAsSeen(): Observable<any> {
    return this.http.patch(
      `${this.apiBase}/notifications/mark-all-seen`, 
      {}
    ).pipe(
      tap(() => {
        this.unreadCount$.next(0);
      })
    );
  }

    refreshUnreadCount(): void {
    this.loadUnreadCount();
  }
}
