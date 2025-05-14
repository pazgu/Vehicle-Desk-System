import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RideDashboardItem } from '../models/ride-dashboard-item/ride-dashboard-item.module';
import { OrderCardItem } from '../models/order-card-item/order-card-item.module';
@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = `${environment.apiUrl}`; // You'll need to define apiUrl in your environment

  constructor(private http: HttpClient) { }

  getDepartmentOrders(departmentId: string): Observable<RideDashboardItem[]> {
    const url = `${this.apiUrl}/orders/${departmentId}`;
    return this.http.get<RideDashboardItem[]>(url);
  }

  getDepartmentSpecificOrder(departmentId: string, orderId: string): Observable<OrderCardItem> {
    const url = `${this.apiUrl}/orders/${departmentId}/${orderId}`;
    return this.http.get<OrderCardItem>(url);
  }
}