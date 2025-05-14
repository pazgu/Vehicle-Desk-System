import { Component, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MyRidesService } from '../../../services/myrides.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  constructor(private router: Router, private rideService: MyRidesService) {}

  currentPage = 1;

  get ordersPerPage(): number {
    return this.showFilters ? 3 : 5;
  }

  filterBy = 'date';
  statusFilter = '';
  startDate: string = '';
  endDate: string = '';
  showFilters = false;
  showOldOrders = false;
  minDate = '2025-01-01';
  maxDate = new Date(new Date().setMonth(new Date().getMonth() + 2))
    .toISOString()
    .split('T')[0];

  sortBy = 'date';
  orders: any[] = [];
  rideViewMode: 'all' | 'future' | 'past' = 'all';

  ngOnInit(): void {
    const storedOrders = localStorage.getItem('user_orders');
    if (storedOrders) {
      this.orders = JSON.parse(storedOrders);
    } else {
      this.orders = [];
    }
    this.fetchRides();
  }

  get pagedOrders() {
    const start = (this.currentPage - 1) * this.ordersPerPage;
    return this.filteredOrders.slice(start, start + this.ordersPerPage);
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


  getStatusTooltip(status: string): string {
    switch (status) {
      case 'Approved': return 'אושר';
      case 'Pending': return 'בהמתנה';
      case 'Rejected': return 'נדחה';
      default: return 'סטטוס לא ידוע';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'approved': return 'status-green';
      case 'pending': return 'status-yellow';
      case 'rejected': return 'status-red';
      default: return '';
    }
  }

  get filteredOrders() {
    const today = new Date();
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(today.getMonth() - 1);

    let filtered = this.orders;

    if (!this.showOldOrders) {
      filtered = filtered.filter(order => {
        const orderDate = this.parseDate(order.date);
        return orderDate >= oneMonthAgo;
      });
    }

    if (this.statusFilter) {
      filtered = filtered.filter(order => order.status === this.statusFilter);
    }

    if (this.startDate) {
      filtered = filtered.filter(order => this.parseDate(order.date) >= new Date(this.startDate));
    }

    if (this.endDate) {
      filtered = filtered.filter(order => this.parseDate(order.date) <= new Date(this.endDate));
    }

    switch (this.rideViewMode) {
      case 'future':
        filtered = filtered.filter(order => this.parseDate(order.date) >= today);
        break;
      case 'past':
        filtered = filtered.filter(order => this.parseDate(order.date) < today);
        break;
      case 'all':
      default:
        break;
    }

    switch (this.sortBy) {
      case 'status':
        return [...filtered].sort((a, b) => a.status.localeCompare(b.status));
      case 'date':
      default:
        return [...filtered].sort((a, b) => this.parseDate(a.date).getTime() - this.parseDate(b.date).getTime());
    }
  }

  parseDate(d: string): Date {
    const [day, month, year] = d.split('.').map(Number);
    return new Date(year, month - 1, day);
  }

  isPastOrder(order: any): boolean {
    const today = new Date();
    const orderDate = this.parseDate(order.date);
    return orderDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  validateDate(type: 'start' | 'end') {
    const value = type === 'start' ? this.startDate : this.endDate;
    if (!this.isDateValid(value)) {
      if (type === 'start') this.startDate = '';
      else this.endDate = '';
      alert('אנא הזן תאריך תקין בין 01.01.2025 ועד היום');
    }
  }

  isDateValid(dateStr: string): boolean {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;

    const min = new Date(this.minDate);
    const max = new Date(this.maxDate);
    return date >= min && date <= max;
  }

  goToNewRide(): void {
    this.router.navigate(['/new-ride']);
  }

  fetchRides() {
    const userId = localStorage.getItem('employee_id');
    if (!userId) return;

    const filters: any = {};
    if (this.statusFilter) filters.status = this.statusFilter;
    if (this.startDate) filters.from_date = this.startDate;
    if (this.endDate) filters.to_date = this.endDate;

    let fetchFn;

    switch (this.rideViewMode) {
      case 'future':
        fetchFn = this.rideService.getFutureOrders(userId, filters);
        break;
      case 'past':
        fetchFn = this.rideService.getPastOrders(userId, filters);
        break;
      case 'all':
      default:
        fetchFn = this.rideService.getAllOrders(userId, filters);
    }

    fetchFn.subscribe({
      next: (res) => {
        console.log('🧾 Raw response from backend:', res); // <- Add this line
        console.log('✅ fetchRides called');
        console.log('🚦 View Mode:', this.rideViewMode);
        console.log('📤 Filters:', filters);
        console.log('🧾 Raw response from backend:', res);


        if (Array.isArray(res)) {
          this.orders = res.map(order => ({
            ...order,
            date: formatDate(order.start_datetime, 'dd.MM.yyyy', 'en-US'),
            time: formatDate(order.start_datetime, 'HH:mm', 'en-US'),
            type: order.vehicle,
            distance: order.estimated_distance,
            status: this.capitalize(order.status)
          }));
          localStorage.setItem('user_orders', JSON.stringify(this.orders));
          console.log('Orders from backend:', this.orders);
        } else {
          this.orders = [];
        }
      },
      error: (err) => {
        console.error('Error fetching orders:', err);
      }
    });
  }

  capitalize(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }
}
