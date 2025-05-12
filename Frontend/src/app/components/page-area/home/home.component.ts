import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // ✅ import FormsModule
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule], // ✅ include FormsModule here
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  currentPage = 1;
  ordersPerPage = 3;
  filterBy = 'date'; // ✅ filter option (default: date)
 statusFilter = '';
startDate: string = '';
endDate: string = '';
showFilters = false; // toggle for filter panel


  sortBy = 'date';         // ▶ מיין לפי

  orders = [
    { date: '23.6.2025', time: '10:00–12:00', type: 'היברידי', distance: '26 ק״מ', status: 'Approved' },
    { date: '14.6.2025', time: '10:00–12:00', type: 'חשמלי', distance: '29 ק״מ', status: 'Pending' },
    { date: '23.6.2025', time: '10:00–12:00', type: 'היברידי', distance: '45 ק״מ', status: 'Rejected' },
    { date: '14.6.2025', time: '10:00–12:00', type: 'רגלי', distance: '12 ק״מ', status: 'Approved' },
    { date: '22.5.2025', time: '10:00–12:00', type: 'חשמלי', distance: '56 ק״מ', status: 'Pending' },
    { date: '1.5.2025', time: '10:00–12:00', type: 'חשמלי', distance: '56 ק״מ', status: 'Pending' }
  ];



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
      case 'Approved':
        return 'אושר';
      case 'Pending':
        return 'בהמתנה';
      case 'Rejected':
        return 'נדחה';

      default:
        return 'סטטוס לא ידוע';
    }
  }
  getStatusClass(status: string): string {
    switch (status) {
      
      case 'Approved':
        return 'status-green';
      case 'Pending':
        return 'status-yellow';
      case 'Rejected':
        return 'status-red';
  
      default:
        return '';
    }
  }
  
  
      // ▶ סנן לפי

  // ...orders array here...

  get filteredOrders() {
  let filtered = this.orders;

  // Filter by status
  if (this.statusFilter) {
    filtered = filtered.filter(order => order.status === this.statusFilter);
  }

  // Filter by date range
  if (this.startDate) {
    filtered = filtered.filter(order => this.parseDate(order.date) >= new Date(this.startDate));
  }

  if (this.endDate) {
    filtered = filtered.filter(order => this.parseDate(order.date) <= new Date(this.endDate));
  }

  // Apply sorting
  switch (this.sortBy) {
    case 'status':
      return [...filtered].sort((a, b) => a.status.localeCompare(b.status));
    case 'date':
    default:
      return [...filtered].sort((a, b) => this.parseDate(a.date).getTime() - this.parseDate(b.date).getTime());
  }
}

// Utility function to parse "dd.mm.yyyy"
parseDate(d: string): Date {
  const [day, month, year] = d.split('.').map(Number);
  return new Date(year, month - 1, day);
}

isPastOrder(order: any): boolean {
  const today = new Date();
  const orderDate = this.parseDate(order.date);
  return orderDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
}


}
