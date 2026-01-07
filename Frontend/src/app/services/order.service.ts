import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RideDashboardItem } from '../models/ride-dashboard-item/ride-dashboard-item.module';
import { OrderCardItem } from '../models/order-card-item.module';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    });
  }

  getDepartmentOrders(departmentId: string): Observable<RideDashboardItem[]> {
    const url = `${this.apiUrl}/orders/${departmentId}`;
    return this.http.get<RideDashboardItem[]>(url, {
      headers: this.getAuthHeaders(),
    });
  }

  getDepartmentSpecificOrder(
    departmentId: string,
    orderId: string
  ): Observable<OrderCardItem> {
    const url = `${this.apiUrl}/orders/${departmentId}/${orderId}`;
    return this.http.get<OrderCardItem>(url, {
      headers: this.getAuthHeaders(),
    });
  }

  updateOrderStatus(
    departmentId: string,
    orderId: string,
    status: string
  ): Observable<any> {
    const url = `${this.apiUrl}/orders/${departmentId}/${orderId}/update/${status}`;
    return this.http.patch(url, null, { headers: this.getAuthHeaders() });
  }
}
