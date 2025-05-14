import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { TableModule } from 'primeng/table';
import { Router } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { RideDashboardItem } from '../../../models/ride-dashboard-item/ride-dashboard-item.module';

@Component({
  selector: 'app-dashboard-all-orders',
  imports: [TableModule, DropdownModule, CommonModule,
    ButtonModule, PaginatorModule, FormsModule],
  templateUrl: './dashboard-all-orders.component.html',
  styleUrl: './dashboard-all-orders.component.css',
  standalone: true // Make sure this is included if using standalone components
})
export class DashboardAllOrdersComponent implements OnInit {

  constructor(private router: Router, private orderService: OrderService) { }

  orders: RideDashboardItem[] = [];
  rows: number = 5;
  currentPage = 1;
  ordersPerPage = 5;
  filterBy = 'date_and_time';
  statusFilter = '';
  startDate: string = '';
  endDate: string = '';
  showFilters = false;
  showOldOrders = false;
  sortBy = 'date_and_time';

  ngOnInit(): void {
    const departmentId = "912a25b9-08e7-4461-b1a3-80e66e79d29e";
    console.log('Department ID:', departmentId);
    this.loadOrders(departmentId);
  }

  loadOrders(departmentId: string | null): void {
    if (departmentId) {
      this.orderService.getDepartmentOrders(departmentId).subscribe(
        (data) => {
          // Log the raw backend response for debugging
          console.log('Raw Backend Response:', data);
  
          // Assign the data directly to the orders array
          this.orders = Array.isArray(data) ? data : [];
          console.log('Processed Orders:', this.orders); // Debugging
        },
        (error) => {
          console.error('Error loading orders:', error);
        }
      );
    } else {
      console.error('Department ID not found in local storage.');
    }
  }

  get filteredOrders() {
    if (!this.orders || this.orders.length === 0) {
      console.log('No orders available for filtering.');
      return [];
    }
  
    let filtered = [...this.orders];
  
    if (this.statusFilter) {
      filtered = filtered.filter(order => order.status === this.statusFilter);
    }
  
    if (this.startDate) {
      filtered = filtered.filter(order => new Date(order.date_and_time) >= new Date(this.startDate));
    }
  
    if (this.endDate) {
      const endDateAtEndOfDay = this.endDate ? new Date(this.endDate + 'T23:59:59') : null;
      if (endDateAtEndOfDay) {
        filtered = filtered.filter(order => new Date(order.date_and_time) <= endDateAtEndOfDay);
      }
    }
  
    switch (this.sortBy) {
      case 'status':
        return [...filtered].sort((a, b) => a.status.localeCompare(b.status));
      case 'date_and_time':
      default:
        return [...filtered].sort((a, b) => new Date(a.date_and_time).getTime() - new Date(b.date_and_time).getTime());
    }
  }

  // Make sure this returns the filtered orders
  get trips(): RideDashboardItem[] {
    console.log('Filtered Orders:', this.filteredOrders); // Debugging
    return this.filteredOrders;
  }

  onRowSelect(trip: RideDashboardItem) {
    console.log('Selected trip:', trip.ride_id); // Debugging
    this.router.navigate(['/order-card', trip.ride_id]);
  }

  resetFilters(table: any) {
    table.clear();
    this.statusFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.showOldOrders = false;
    this.sortBy = 'date_and_time';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'approved':
        return 'status-approved';
      case 'pending':
        return 'status-pending';
      case 'rejected':
        return 'status-rejected';
      default:
        return '';
    }
  }

  getRowClass(status: string): string {
    switch (status) {
      case 'approved':
        return 'row-approved';
      case 'pending':
        return 'row-pending';
      case 'rejected':
        return 'row-rejected';
      default:
        return '';
    }
  }

  onRowClick(trip: RideDashboardItem) {
    this.router.navigate(['/order-card', trip.ride_id]);
  }
}