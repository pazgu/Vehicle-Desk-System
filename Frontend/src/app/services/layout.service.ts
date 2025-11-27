import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FeedbackCheckResponse {
  showPage: boolean;
  ride_id: string;
}

@Injectable({
  providedIn: 'root'
})
export class LayoutService {

  constructor(private http: HttpClient) { }

  checkPendingFeedback(userId: string): Observable<FeedbackCheckResponse> {
    return this.http.get<FeedbackCheckResponse>(`${environment.apiUrl}/rides/feedback/check/${userId}`);
  }

  getUserIdFromToken(): string | null {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return null;
    }
    try {
      const payloadJson = atob(token.split('.')[1]);
      const payload = JSON.parse(payloadJson);
      return payload.sub || null;
    } catch (err) {
      console.error('[GET USER ID] Error parsing token payload in LayoutService:', err);
      return null;
    }
  }
}