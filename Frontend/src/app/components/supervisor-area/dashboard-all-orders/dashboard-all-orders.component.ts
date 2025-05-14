import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { TableModule } from 'primeng/table';
import { Router } from '@angular/router';
import { OrderService } from '../../../services/order.service';
import { RideDashboardItem } from '../../../models/ride-dashboard-item/ride-dashboard-item.module';

@Component({
  selector: 'app-dashboard-all-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DropdownModule,
    PaginatorModule
  ],
  templateUrl: './dashboard-all-orders.component.html',
  styleUrl: './dashboard-all-orders.component.css',
  standalone: true // Make sure this is included if using standalone components
})
export class DashboardAllOrdersComponent implements OnInit {

  constructor(private router: Router, private orderService: OrderService) { }

  orders: RideDashboardItem[] = [];
  rows: number = 5;
  styleUrls: ['./dashboard-all-orders.component.css']
})
export class DashboardAllOrdersComponent {
  constructor(private router: Router) {}

  originalTrips: {
    id: number;
    dateTime: string;
    status: string;
    [key: string]: any;
  }[] = [
    // example data structure:
    // { id: 1, dateTime: '2025-05-01 15:30', status: 'מאושר', ... }
  ];

  currentPage = 1;
  ordersPerPage = 5;
  filterBy = 'date_and_time';
  statusFilter = '';
  startDate = '';
  endDate = '';
  showFilters = false;
  showOldOrders = false;
  sortBy = 'date_and_time';

  ngOnInit(): void {
    const departmentId = "912a25b9-08e7-4461-b1a3-80e66e79d29e";
    // console.log('Department ID:', departmentId);
    this.loadOrders(departmentId);
  }

  loadOrders(departmentId: string | null): void {
    if (departmentId) {
      this.orderService.getDepartmentOrders(departmentId).subscribe(
        (data) => {  
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
        switch (this.statusFilter) {
        case 'בהמתנה':
          filtered = filtered.filter(order => order.status === 'pending');
          break;
        case 'מאושר':
          filtered = filtered.filter(order => order.status === 'approved');
          break;
        case 'נדחה':
          filtered = filtered.filter(order => order.status === 'rejected');
          break;
        default:
          break;
      }
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
  first = 0;
  rows = 5;
  sortBy = 'dateTime';
selectedStatusFilter: string = '';

setStatusFilter(status: string): void {
  this.selectedStatusFilter = status;
  this.statusFilter = status; // this will also update the filtering logic
  this.currentPage = 1; // optional: reset to first page on new filter
}

  get trips() {
    return this.paginatedOrders;
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
      filtered = filtered.filter(order =>
        this.parseDate(order.dateTime) >= new Date(this.startDate)
      );
    }

    if (this.endDate) {
      const endDateAtEndOfDay = new Date(this.endDate + 'T23:59:59');
      filtered = filtered.filter(order =>
        this.parseDate(order.dateTime) <= endDateAtEndOfDay
      );
    }

    switch (this.sortBy) {
      case 'status':
        return [...filtered].sort((a, b) => a.status.localeCompare(b.status));
      case 'dateTime':
      default:
        return [...filtered].sort((a, b) =>
          this.parseDate(a.dateTime).getTime() -
          this.parseDate(b.dateTime).getTime()
        );
    }
  }

  get paginatedOrders() {
    const filtered = this.filteredOrders;
    const startIndex = (this.currentPage - 1) * this.ordersPerPage;
    const endIndex = this.currentPage * this.ordersPerPage;

    if (this.showFilters) {
      const firstPageCount = 2;
      const adjustedStartIndex =
        this.currentPage === 1
          ? 0
          : firstPageCount + (this.currentPage - 2) * this.ordersPerPage;
      const adjustedEndIndex =
        this.currentPage === 1
          ? firstPageCount
          : adjustedStartIndex + this.ordersPerPage;
      return filtered.slice(adjustedStartIndex, adjustedEndIndex);
    }

    return filtered.slice(startIndex, endIndex);
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

  getTotalRecords(): number {
    return this.filteredOrders.length;
  }

  translateStatus(status: string | null | undefined): string {
    if (!status) return '';
    
    switch (status.toLowerCase()) {
      case 'approved':
        return 'מאושר';
      case 'pending':
        return 'ממתין לאישור';
      case 'rejected':
        return 'נדחה';
      default:
        return status;
    }
  parseDate(dateTime: string): Date {
    const [datePart, timePart] = dateTime.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }

  onRowSelect(trip: any) {
    this.router.navigate(['/order-card', trip.id]);
  }

  resetFilters() {
    this.statusFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.showOldOrders = false;
    this.sortBy = 'dateTime';
    this.currentPage = 1;
  }

  onPageChange(event: any) {
    this.currentPage = event.page + 1;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

get totalPages() {
  return this.filteredOrders.length > 0 ? Math.ceil(this.filteredOrders.length / this.ordersPerPage) : 1;
}

}
