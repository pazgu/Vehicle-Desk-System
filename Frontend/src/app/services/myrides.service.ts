import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { of } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export class MyRidesService {
  private allOrdersUrl = environment.allOrdersUrl;
  private pastOrdersUrl = environment.pastOrdersUrl;
  private futureOrdersUrl = environment.futureOrdersUrl;


  constructor(private http: HttpClient) {}

  getFutureOrders(userId: string, filters?: any): Observable<any> {
    const token = localStorage.getItem('access_token');
    const headerss = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });
    const orders=this.http.get(`${this.futureOrdersUrl}/${userId}`, {
      params: this.buildParams(filters),
      headers: headerss
    });
    console.log(orders)
    return orders
  }

  getPastOrders(userId: string, filters?: any): Observable<any> {
    const token = localStorage.getItem('access_token');
    const headerss = new HttpHeaders()
  .set('Authorization', `Bearer ${token}`)
  .set('Accept', 'application/json');

    const orders=this.http.get(`${this.pastOrdersUrl}/${userId}`, {
      params: this.buildParams(filters),
      headers: headerss
    });
    console.log(orders)
    return orders
  }

  getAllOrders(userId: string, filters?: any): Observable<any> {
  const token = localStorage.getItem('access_token');

  if (!token) {
    console.error('No token found');
    return of([]); // <-- import { of } from 'rxjs';
  }

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    Accept: 'application/json' // <--- Optional but helpful
  });

  return this.http.get(`${this.allOrdersUrl}/${userId}`, {
    params: this.buildParams(filters),
    headers
  });
}

  private buildParams(filters: any): HttpParams {
    let params = new HttpParams();
    if (!filters) return params;

    if (filters.status) params = params.set('status', filters.status);
    if (filters.from_date) params = params.set('from_date', filters.from_date);
    if (filters.to_date) params = params.set('to_date', filters.to_date);

    return params;
  }


}


