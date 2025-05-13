import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { TableModule } from 'primeng/table';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard-all-orders',
  imports: [TableModule, DropdownModule, CommonModule,
    ButtonModule, PaginatorModule, FormsModule],
  templateUrl: './dashboard-all-orders.component.html',
  styleUrl: './dashboard-all-orders.component.css'
})
export class DashboardAllOrdersComponent {

  constructor(private router: Router) { }

  rows: number = 5;
  originalTrips = [
    { id: 1, employeeName: 'ישראל ישראלי', vehicle: 1, dateTime: '2025-05-07 10:00', destination: 'תל אביב', distance: 10, status: 'מאושר' },
    { id: 2, employeeName: 'יוסי כהן', vehicle: 2, dateTime: '2025-05-07 12:00', destination: 'ירושלים', distance: 70, status: 'בהמתנה' },
    { id: 3, employeeName: 'דנה לוי', vehicle: 3, dateTime: '2025-05-08 09:00', destination: 'חיפה', distance: 90, status: 'נדחה' },
    { id: 4, employeeName: 'אבי מזרחי', vehicle: 4, dateTime: '2025-05-08 14:30', destination: 'באר שבע', distance: 110, status: 'מאושר' },
    { id: 5, employeeName: 'שרה כהן', vehicle: 5, dateTime: '2025-05-09 08:15', destination: 'נתניה', distance: 30, status: 'בהמתנה' },
    { id: 6, employeeName: 'מיכאל רון', vehicle: 6, dateTime: '2025-05-09 11:45', destination: 'אשדוד', distance: 55, status: 'נדחה' },
    { id: 7, employeeName: 'תמר אלון', vehicle: 7, dateTime: '2025-05-10 13:00', destination: 'אילת', distance: 300, status: 'בהמתנה' },
    { id: 8, employeeName: 'נועם חן', vehicle: 8, dateTime: '2025-05-10 15:30', destination: 'רחובות', distance: 20, status: 'מאושר' },
    { id: 9, employeeName: 'רוני ברק', vehicle: 9, dateTime: '2025-05-11 07:30', destination: 'מודיעין', distance: 45, status: 'נדחה' },
    { id: 10, employeeName: 'גיא כהן', vehicle: 10, dateTime: '2025-05-11 17:00', destination: 'כפר סבא', distance: 25, status: 'בהמתנה' },
    { id: 11, employeeName: 'ליהי לוי', vehicle: 11, dateTime: '2025-05-12 10:30', destination: 'חולון', distance: 35, status: 'מאושר' },
    { id: 12, employeeName: 'אורן מזרחי', vehicle: 12, dateTime: '2025-05-12 13:00', destination: 'ראשון לציון', distance: 15, status: 'בהמתנה' },
    { id: 13, employeeName: 'נועה ברק', vehicle: 13, dateTime: '2025-05-13 08:45', destination: 'רמת גן', distance: 25, status: 'נדחה' },
    { id: 14, employeeName: 'שלומי יוסף', vehicle: 14, dateTime: '2025-05-13 11:30', destination: 'נתניה', distance: 40, status: 'מאושר' },
    { id: 15, employeeName: 'מירה כהן', vehicle: 15, dateTime: '2025-05-14 09:00', destination: 'תל אביב', distance: 10, status: 'נדחה' },
    { id: 16, employeeName: 'צוריאל בר', vehicle: 16, dateTime: '2025-05-14 14:00', destination: 'עכו', distance: 120, status: 'בהמתנה' },
    { id: 17, employeeName: 'מיכל חן', vehicle: 17, dateTime: '2025-05-15 12:15', destination: 'חיפה', distance: 100, status: 'מאושר' },
    { id: 18, employeeName: 'אוראל רוזן', vehicle: 18, dateTime: '2025-05-15 16:30', destination: 'הרצליה', distance: 40, status: 'נדחה' },
    { id: 19, employeeName: 'רז יוספי', vehicle: 19, dateTime: '2025-05-16 09:30', destination: 'תל אביב', distance: 15, status: 'בהמתנה' },
    { id: 20, employeeName: 'עדי פרידמן', vehicle: 20, dateTime: '2025-05-16 18:00', destination: 'חולון', distance: 25, status: 'מאושר' }
  ];

  currentPage = 1;
  ordersPerPage = 5;
  filterBy = 'dateTime';
  statusFilter = '';
  startDate: string = '';
  endDate: string = '';
  showFilters = false;
  showOldOrders = false;

  sortBy = 'date';

  get trips() {
    return this.filteredOrders;
  }

  onRowSelect(trip: any) {
    this.router.navigate(['/order-card', trip.id]);
  }

  resetFilters(table: any) {
    table.clear();
    this.statusFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.showOldOrders = false;
    this.sortBy = 'date';
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
      // Create a Date object for the end of the selected end date
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
        return 'row-approved';
      case 'בהמתנה':
        return 'row-pending';
      case 'נדחה':
        return 'row-rejected';
      default:
        return '';
    }
  }

  onRowClick(trip: any) {
    this.router.navigate(['/order-card', trip.id]);
  }

  parseDate(d: string): Date {
    const [datePart, timePart] = d.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }
}