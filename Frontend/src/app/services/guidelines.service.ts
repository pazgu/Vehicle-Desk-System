import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { GuidelinesDoc, RideRequirementConfirmationIn } from '../models/guidelines.model';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class GuidelinesService {
  private docSubject = new BehaviorSubject<GuidelinesDoc | null>(null);
  doc$ = this.docSubject.asObservable();
  private latestReqURL=environment.latestRequirementURL;
  private addReqConfirmURL=environment.addReqConfirmationURL;
  constructor(private http: HttpClient) {
    this.get(); // initial fetch
  }

  get(): Observable<GuidelinesDoc> {
    return this.http.get<GuidelinesDoc>(`${this.latestReqURL}`)
      .pipe(tap(doc => this.docSubject.next(doc)));
  }
    confirmRide(data: RideRequirementConfirmationIn): Observable<any> {
    return this.http.post(`${this.addReqConfirmURL}`, data);
  }
}
