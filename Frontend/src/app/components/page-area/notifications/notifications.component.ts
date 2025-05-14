import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification';
import { formatDistanceToNow } from 'date-fns';
import { MyNotification } from '../../../models/notification';
import { he } from 'date-fns/locale';

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
          timeAgo: formatDistanceToNow(new Date(note.sent_at), { addSuffix: true, locale: he,} ),
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

  getStatusIcon(message: string): string {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('approved')) {
      return '/assets/images/approved.png';
    } else if (lowerMessage.includes('rejected')) {
      return '/assets/images/rejected.png';
    } else {
      return '/assets/images/clock.png'; 
    }
  }
  
  translateMessage(message: string): string {
    const lower = message.toLowerCase();
  
    if (lower.includes('sent successfully')) {
      return '.ההזמנה שלך נשלחה בהצלחה. תקבל/י התראה לאחר הבדיקה והאישור';
    } else if (lower.includes('approved')) {
      return '.ההזמנה שלך אושרה';
    } else if (lower.includes('rejected')) {
      return '.ההזמנה שלך נדחתה';
    } else {
      return message; 
    }
  }
  

  getStatusClass(message: string): string {
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('approved')) {
      return 'approved';
    } else if (lowerMessage.includes('rejected')) {
      return 'rejected';
    } else {
      return 'neutral'; 
    }
  }
  
}
