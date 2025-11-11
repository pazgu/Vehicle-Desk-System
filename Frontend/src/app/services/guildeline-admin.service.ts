import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


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
    return this.http.get<AdminGuidelinesDoc>('http://localhost:8000/api/get-requirements');
  }

  update(payload: { title: string; items: string[] }): Observable<AdminGuidelinesDoc> {
    return this.http.put<AdminGuidelinesDoc>('http://localhost:8000/api/update-requirements', payload);
  }
}
