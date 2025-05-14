import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RideDashboardItem } from '../models/ride-dashboard-item/ride-dashboard-item.module';
import { OrderCardItem } from '../models/order-card-item/order-card-item.module';
@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private apiUrl = environment.apiUrl; 

  constructor(private http: HttpClient) { }
  getDepartmentOrders(departmentId: string): Observable<RideDashboardItem[]> {
    const url = `${this.apiUrl}/orders/${departmentId}`;
    return this.http.get<RideDashboardItem[]>(url);
  }

  getDepartmentSpecificOrder(departmentId: string, orderId: string): Observable<OrderCardItem> {
    const url = `${this.apiUrl}/orders/${departmentId}/${orderId}`;
    return this.http.get<OrderCardItem>(url);
  }

  updateOrderStatus(departmentId: string, orderId: string, status: string): Observable<any> {
    const url = `${this.apiUrl}/orders/${departmentId}/${orderId}/update/${status}`;
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.patch(url, null, { headers });
  }
  

}