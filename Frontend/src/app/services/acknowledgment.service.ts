import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface RideAcknowledgmentPayload {
  ride_id: string;
  user_id: string;
  confirmed: boolean;
  acknowledged_at?: string;
  signature_data_url?: string | null;
}

export interface RideAcknowledgmentResponse {
  success: boolean;
  id?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AcknowledgmentService {
  private baseUrl = environment.apiUrl || '/api';
  private useMock = true;

  constructor(private http: HttpClient) {}

  saveAcknowledgment(
    payload: RideAcknowledgmentPayload
  ): Observable<RideAcknowledgmentResponse> {
    if (this.useMock) {
      return of({ success: true, id: crypto.randomUUID() }).pipe(delay(600));
    }
    return this.http.post<RideAcknowledgmentResponse>(
      `${this.baseUrl}/ride-acknowledgments`,
      payload
    );
  }
}
