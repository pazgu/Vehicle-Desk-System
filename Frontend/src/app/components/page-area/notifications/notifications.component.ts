import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification';
import { formatDistanceToNow } from 'date-fns';
import { MyNotification } from '../../../models/notification';
import { he } from 'date-fns/locale';
import { Router } from '@angular/router';

@Component({
  selector: 'app-notifications',
  standalone: true,  
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent {
  notifications: (MyNotification & { timeAgo: string })[] = [];

  constructor(private notificationService: NotificationService,private router: Router) {}

goToOrder(orderId: string): void {
  const role = localStorage.getItem('role');

  if (role === 'supervisor') {
    this.router.navigate([`/order-card/${orderId}`]);
  } else {
    this.router.navigate([`/home`], { queryParams: { highlight: orderId } });
  }
}


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
  // Use filtered notifications length for total pages calculation
  return this.notifications.length > 0 
    ? Math.ceil(this.notifications.length / this.notificationsPerPage)
    : 1; // Fallback to 1 page if no notifications
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
  switch (status) {
    case 'approved': return '/assets/images/approved.png';
    case 'rejected': return '/assets/images/rejected.png';
    case 'pending': return '/assets/images/clock.png';
    default: return '/assets/images/clock.png';
  }
}

getStatusClass(status: string): string {
  switch (status) {
    case 'approved': return 'approved';
    case 'rejected': return 'rejected';
    case 'pending': return 'neutral';
    default: return 'neutral';
  }
}

  translateMessage(message: string): string {
    const lower = message.toLowerCase();
  
    if (lower.includes('נשלחה בהצלחה')) {
      return '.ההזמנה שלך נשלחה בהצלחה. תקבל/י התראה לאחר הבדיקה והאישור';
    } else if (lower.includes('אושרה')) {
      return '.ההזמנה שלך אושרה';
    } else if (lower.includes('נדחתה')) {
      return '.ההזמנה שלך נדחתה';
    } else {
      return message; 
    }
  }

  handleNotificationClick(notif: MyNotification): void {
  const role = localStorage.getItem('role');
  
  // If this is a critical vehicle inspection message and the user is admin:
  if (role === 'admin' && notif.message.includes('בעיה חמורה')) {
    this.router.navigate(['/admin/daily-inspections'], {
      queryParams: { highlight: '1' }
    });
  } else if (notif.order_id) {
    this.goToOrder(notif.order_id);
  } else {
    console.log('ℹ️ Notification has no specific route.');
  }
}

}
