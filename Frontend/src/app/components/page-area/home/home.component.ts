import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  constructor(private router: Router) {}

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

  // ✅ NEW: ride view mode filter state
  rideViewMode: 'all' | 'future' | 'past' = 'all';

  ngOnInit(): void {
    const storedOrders = localStorage.getItem('user_orders');
    if (storedOrders) {
      this.orders = JSON.parse(storedOrders);
    } else {
      this.orders = [];
    }
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
    return Math.ceil(this.filteredOrders.length / this.ordersPerPage);
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
      case 'Approved': return 'status-green';
      case 'Pending': return 'status-yellow';
      case 'Rejected': return 'status-red';
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

    // ✅ NEW: Apply view mode (future/past)
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
}
