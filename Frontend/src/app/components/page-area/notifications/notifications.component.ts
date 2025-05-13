import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent {
  notifications = [
    { timeAgo: 'לפני 30 דק׳', message: 'בקשתך לנסיעה לתאריך 31.07.2025 אושרה', status: 'Approved' },
    { timeAgo: 'לפני שעה', message: 'בקשתך לנסיעה בתאריך 02.6.2025 נדחתה', status: 'Rejected' },
    { timeAgo: 'לפני 3 שע׳', message: 'בקשתך לנסיעה בתאריך 23.7.2025 נדחתה', status: 'Rejected' },
    { timeAgo: 'אתמול, 1:59', message: 'בקשתך לנסיעה בתאריך 5.7.2025 אושרה', status: 'Approved' }
  ];

  currentPage = 1;
  notificationsPerPage = 3;

  get totalPages(): number {
    return Math.ceil(this.notifications.length / this.notificationsPerPage);
  }

  get pagedNotifications() {
    const start = (this.currentPage - 1) * this.notificationsPerPage;
    return this.notifications.slice(start, start + this.notificationsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  getStatusIcon(status: string): string {
    return status === 'Approved' ? 'pi pi-check-circle' : 'pi pi-times-circle';
  }

  getStatusClass(status: string): string {
    return status === 'Approved' ? 'approved' : 'rejected';
  }
}
