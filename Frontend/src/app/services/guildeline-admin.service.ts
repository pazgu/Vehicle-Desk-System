import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AdminGuidelinesDoc {
  id: string;
  title: string;
  items: string[];
  updated_at: string;
  updated_by?: string;
}

@Injectable({ providedIn: 'root' })
export class GuidelinesServiceAdmin {
  constructor(private http: HttpClient) {}

  getLatest(): Observable<AdminGuidelinesDoc> {
    let url = environment.latestRequirementURL;
    return this.http.get<AdminGuidelinesDoc>(url);
  }

  update(payload: {
    title: string;
    items: string[];
  }): Observable<AdminGuidelinesDoc> {
    let url = environment.updateRequirementsUrl;
    return this.http.put<AdminGuidelinesDoc>(url, payload);
  }
}
