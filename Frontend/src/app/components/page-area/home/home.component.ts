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

  orders = [
    { date: '23.6.2025', time: '10:00–12:00', type: 'היברידי', distance: '26 ק״מ', status: 'Available' },
    { date: '14.6.2025', time: '10:00–12:00', type: 'חשמלי', distance: '29 ק״מ', status: 'Pending' },
    { date: '23.6.2025', time: '10:00–12:00', type: 'היברידי', distance: '45 ק״מ', status: 'Problem' },
    { date: '14.6.2025', time: '10:00–12:00', type: 'רגלי', distance: '12 ק״מ', status: 'In Use' },
    { date: '22.5.2025', time: '10:00–12:00', type: 'חשמלי', distance: '56 ק״מ', status: 'Out of Service' }
  ];

  get filteredOrders() {
    switch (this.filterBy) {
      case 'status':
        return [...this.orders].sort((a, b) => a.status.localeCompare(b.status));
      case 'date':
      default:
        return [...this.orders].sort((a, b) => {
          // Convert 'dd.mm.yyyy' to real Date objects
          const parse = (d: string) => {
            const [day, month, year] = d.split('.').map(Number);
            return new Date(year, month - 1, day);
          };
          return parse(a.date).getTime() - parse(b.date).getTime();
        });
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
      case 'Available':
      case 'Synced':
        return 'אושר';
      case 'Pending':
        return 'בהמתנה';
      case 'Problem':
      case 'Not Synced':
        return 'תקלה';
      case 'In Use':
        return 'בשימוש';
      case 'Out of Service':
        return 'לא בשימוש';
      default:
        return 'סטטוס לא ידוע';
    }
  }
  getStatusClass(status: string): string {
    switch (status) {
      case 'Available':
      case 'Synced':
        return 'status-green';
      case 'Pending':
      case 'In Review':
        return 'status-yellow';
      case 'Problem':
      case 'Not Synced':
      case 'Frozen':
        return 'status-red';
      case 'In Use':
        return 'status-blue';
      case 'Out of Service':
      case 'Maintenance':
        return 'status-gray';
      default:
        return '';
    }
  }
  
  
}
