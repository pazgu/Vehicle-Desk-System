
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MyNotification } from '../models/notification';



@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationUrl = environment.notificatioUrl;

  constructor(private http: HttpClient) {}

  getNotifications(): Observable<MyNotification[]> {
    const token = localStorage.getItem('access_token');
    const user_id=localStorage.getItem('employee_id');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get<MyNotification[]>(`${this.notificationUrl}/${user_id}`, { headers });
  }
  
}
