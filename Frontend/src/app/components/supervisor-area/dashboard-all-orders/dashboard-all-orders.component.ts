import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { TableModule } from 'primeng/table';
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
  styleUrls: ['./dashboard-all-orders.component.css']
})
export class DashboardAllOrdersComponent implements OnInit {

  orders: RideDashboardItem[] = [];
  rows: number = 5;
  currentPage: number = 1;
  statusFilter: string = '';
  startDate: string = '';
  endDate: string = '';
  showFilters: boolean = false;
  showOldOrders: boolean = false;
  sortBy: string = 'date_and_time';

  constructor(
    private route: ActivatedRoute, 
    private router: Router, 
    private orderService: OrderService
  ) {}

ngOnInit(): void {
  this.route.queryParams.subscribe(params => {
    this.statusFilter = params['status'] || '';
    this.startDate = params['startDate'] || '';
    this.endDate = params['endDate'] || '';
    this.sortBy = params['sortBy'] || 'date_and_time';

    const departmentId = localStorage.getItem('department_id');
    if (departmentId) {
      this.loadOrders(departmentId); 
    } else {
      console.error('Department ID not found in localStorage.');
    }
  });
}

  loadOrders(departmentId: string | null): void {
    if (departmentId) {
      this.orderService.getDepartmentOrders(departmentId).subscribe(
        (data) => {
          this.orders = Array.isArray(data) ? data : [];
        },
        (error) => {
          console.error('Error loading orders:', error);
        }
      );
    } else {
      console.error('Department ID not found in local storage.');
    }
  }

updateQueryParams(): void {
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: {
      status: this.statusFilter || null,
      startDate: this.startDate || null,
      endDate: this.endDate || null,
      sortBy: this.sortBy || null
    },
    queryParamsHandling: 'merge'
  });
}


  set statusFilterValue(val: string) {
    this.statusFilter = val;
    this.updateQueryParams();
  }

  set startDateValue(val: string) {
    this.startDate = val;
    this.updateQueryParams();
  }

  set endDateValue(val: string) {
    this.endDate = val;
    this.updateQueryParams();
  }

  set sortByValue(val: string) {
    this.sortBy = val;
    this.updateQueryParams();
  }


  get filteredOrders() {
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


  onRowSelect(trip: RideDashboardItem) {
    this.router.navigate(['/order-card', trip.ride_id]);
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
    console.log('Selected trip:', trip.ride_id); // Debugging
    this.router.navigate(['/order-card', trip.ride_id]);
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

  parseDate(dateTime: string): Date {
    const [datePart, timePart] = dateTime.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }



  resetFilters() {
    this.statusFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.showOldOrders = false;
    this.sortBy = 'date_and_time';
    this.currentPage = 1;
    this.updateQueryParams();
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

  get trips() {
    const startIndex = (this.currentPage - 1) * this.rows;
    return this.filteredOrders.slice(startIndex, startIndex + this.rows);
  }

  get totalPages() {
    return this.filteredOrders.length > 0 ? Math.ceil(this.filteredOrders.length / this.rows) : 1;
  }
}
