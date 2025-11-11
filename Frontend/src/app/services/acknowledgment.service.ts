import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface RideAcknowledgmentPayload {
  ride_id: string;
  user_id: string;
  confirmed: boolean;               // checkbox result
  acknowledged_at?: string;         // ISO timestamp (server can override)
  signature_data_url?: string | null; // optional for future
}

export interface RideAcknowledgmentResponse {
  success: boolean;
  id?: string;                      // db id if you want to return it
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AcknowledgmentService {
  private baseUrl = environment.apiUrl || '/api'; // make sure environment.apiUrl exists
  /**
   * While backend is not ready, set to true to simulate server.
   * Flip to false once your FastAPI endpoint is up.
   */
  private useMock = true;

  constructor(private http: HttpClient) {}

  /**
   * Persist the user's acknowledgment for a ride.
   * Backend suggestion: POST /api/ride-acknowledgments
   */
  saveAcknowledgment(payload: RideAcknowledgmentPayload): Observable<RideAcknowledgmentResponse> {
    if (this.useMock) {
      // --- MOCK: simulate network + success
      return of({ success: true, id: crypto.randomUUID() }).pipe(delay(600));
    }
    return this.http.post<RideAcknowledgmentResponse>(
      `${this.baseUrl}/ride-acknowledgments`,
      payload
    );
  }
}
