import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification';
import { formatDistanceToNow } from 'date-fns';
import { MyNotification } from '../../../models/notification';

@Component({
  selector: 'app-notifications',
  standalone: true,  
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent {
  notifications: (MyNotification & { timeAgo: string })[] = [];

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.notificationService.getNotifications().subscribe({
      next: (data) => {
        this.notifications = data.map(note => ({
          ...note,
          timeAgo: formatDistanceToNow(new Date(note.sent_at), { addSuffix: true }),
        }));
      },
      error: (err) => {
        console.error('Failed to fetch notifications:', err);
      }
    });
  }
  currentPage = 1;
  notificationsPerPage = 5;

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

  // getStatusIcon(status: string): string {
  //   return status === 'Approved' ? 'pi pi-check-circle' : 'pi pi-times-circle';
  // }

  // getStatusClass(status: string): string {
  //   return status === 'Approved' ? 'approved' : 'rejected';
  // }
}
