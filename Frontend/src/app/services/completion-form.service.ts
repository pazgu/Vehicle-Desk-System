import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RideReportService {
  private CompletionFormUrl = environment.CompletionFormUrl;

  constructor(private http: HttpClient) {}

  submitCompletionForm(formData: any, token: string) {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.post(this.CompletionFormUrl, formData, { headers });
  }
}
