import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})

export class HeaderService {

  constructor(private http: HttpClient) {}

  checkFeedbackNeeded(userId: string): Observable<{ ride_id: string; showPage: boolean }> {
    return this.http.get<{ ride_id: string; showPage: boolean }>(
      `${environment.apiUrl}/rides/feedback/check/${userId}`
    );
  }
}