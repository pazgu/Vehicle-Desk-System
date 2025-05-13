import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-dashboard-all-orders',
  imports: [CommonModule, HttpClientModule, FormsModule, TableModule],
  templateUrl: './dashboard-all-orders.component.html',
  styleUrls: ['./dashboard-all-orders.component.css']
})
export class DashboardAllOrdersComponent implements OnInit {
  rows: number = 5;
  originalTrips: any[] = []; // Holds data fetched from the backend
  currentPage = 1;
  ordersPerPage = 5;
  filterBy = 'dateTime';
  statusFilter = '';
  startDate: string = '';
  endDate: string = '';
  showFilters = false;
  showOldOrders = false;
  sortBy = 'date';
  departmentId: string = '912a25b9-08e7-4461-b1a3-80e66e79d29e';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.fetchData();
  }

  fetchData(): void {
    this.http.get<any[]>(`http://localhost:8000/api/orders/${this.departmentId}`).subscribe(
      (data) => {
        this.originalTrips = data.map(order => ({
          id: order.ride_id,
          employeeName: order.employee_name,
          vehicle: order.requested_vehicle_plate,
          dateTime: order.date_and_time,
          destination: order.destination, // Make sure backend provides this
          distance: order.distance,
          status: order.status
        }));
      },
      (error) => {
        console.error('Error fetching data from the backend:', error);
      }
    );
  }

  get trips() {
    return this.filteredOrders;
  }

  onRowClick(trip: any) {
    this.router.navigate(['/order-card', trip.id]);
  }

  parseDate(d: string | null | undefined): Date {
    if (!d || typeof d !== 'string') {
      console.warn('Invalid date string:', d);
      return new Date(NaN);
    }
  
    const parsedDate = new Date(d);
  
    return parsedDate;
  }
  
  

  get filteredOrders() {
    const today = new Date();
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(today.getMonth() - 1);

    let filtered = [...this.originalTrips];

    if (!this.showOldOrders) {
      filtered = filtered.filter(order => {
        const orderDate = this.parseDate(order.dateTime);
        return orderDate >= oneMonthAgo;
      });
    }

    if (this.statusFilter) {
      filtered = filtered.filter(order => order.status === this.statusFilter);
    }

    if (this.startDate) {
      filtered = filtered.filter(order => this.parseDate(order.dateTime) >= new Date(this.startDate));
    }

    if (this.endDate) {
      const endDateAtEndOfDay = this.endDate ? new Date(this.endDate + 'T23:59:59') : null;
      if (endDateAtEndOfDay) {
        filtered = filtered.filter(order => this.parseDate(order.dateTime) <= endDateAtEndOfDay);
      }
    }

    switch (this.sortBy) {
      case 'status':
        return [...filtered].sort((a, b) => a.status.localeCompare(b.status));
      case 'date':
      default:
        return [...filtered].sort((a, b) => this.parseDate(a.dateTime).getTime() - this.parseDate(b.dateTime).getTime());
    }
  }

  getRowClass(status: string): string {
    switch (status) {
      case 'מאושר':
        return 'approved-row';
      case 'בהמתנה':
        return 'pending-row';
      case 'נדחה':
        return 'rejected-row';
      default:
        return '';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'מאושר':
        return 'status-approved';
      case 'בהמתנה':
        return 'status-pending';
      case 'נדחה':
        return 'status-rejected';
      default:
        return '';
    }
  }
}