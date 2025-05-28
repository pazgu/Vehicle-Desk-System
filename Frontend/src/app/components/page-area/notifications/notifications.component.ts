import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminNotificationResponse, NotificationService } from '../../../services/notification';
import { formatDistanceToNow } from 'date-fns';
import { MyNotification } from '../../../models/notification';
import { he } from 'date-fns/locale';
import { Router } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css'
})
export class NotificationsComponent implements OnInit {
  notifications: (MyNotification & { timeAgo: string })[] = [];
  currentPage = 1;
  notificationsPerPage = 5;

  constructor(
    private notificationService: NotificationService,
    private socketService: SocketService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    
    const role = localStorage.getItem('role');

    if (role === 'admin') {
  this.notificationService.getAdminNotifications().subscribe({
    next: (data) => {
      console.log('🛠 Admin notification raw data:', data);

     // Step 1: Declare and assign mock if needed
    let safeData: AdminNotificationResponse;

 if (!data) {
      safeData = {
        plate_number: '123-456-78',
        detail: 'fallback',
        count: 0,
        vehicle_id: 'mock-id',
        odometer_reading: 10001
      };
    } else {
      safeData = data;
    }



// Step 2: Use it as normal
    const message = safeData.plate_number
      ? `עבר יותר מ-10000 קילומטר - לוחית: ${safeData.plate_number}`
      : 'התראה מנהלתית - פרטי הרכב אינם זמינים כרגע';

   this.notifications = [{
      id: 'admin-generated',
      user_id: '',
      notification_type: 'admin',
      title: 'התראה מנהלתית',
      message,
      sent_at: new Date().toISOString(),
      order_id: '',
      order_status: '',
      vehicle_id: '',
      timeAgo: formatDistanceToNow(new Date(), {
        addSuffix: true,
        locale: he,
      }),
    }];
  },
  error: (err) => {
    console.error('Failed to fetch admin notifications:', err);
  }
});
    } else {
      this.notificationService.getNotifications().subscribe({
        next: (data) => {
          this.notifications = data.map(note => ({
            ...note,
            timeAgo: formatDistanceToNow(new Date(note.sent_at), {
              addSuffix: true,
              locale: he,
            }),
          }));
        },
        error: (err) => {
          console.error('Failed to fetch notifications:', err);
        }
      });
    }
    this.socketService.notifications$.subscribe((newNotif) => {
  if (newNotif) {
    const notifWithTimeAgo = {
      ...newNotif,
      timeAgo: formatDistanceToNow(new Date(newNotif.sent_at), {
        addSuffix: true,
        locale: he,
      }),
    };

    // Add to the top of the list
    this.notifications.unshift(notifWithTimeAgo);

   if (newNotif.message.includes('בעיה חמורה') || newNotif.notification_type === 'critical') {
  const audio = new Audio('assets/sounds/notif.mp3');
  audio.play();
}



    this.toastService.show(newNotif.message, 'success');

    // Optional: log or show toast
    console.log('🟢 Live notification added:', notifWithTimeAgo);
  }
});

  }

  goToOrder(orderId: string): void {
    const role = localStorage.getItem('role');
    if (role === 'supervisor') {
      this.router.navigate([`/order-card/${orderId}`]);
    } else {
      this.router.navigate(['/home'], { queryParams: { highlight: orderId } });
    }
  }

  get pagedNotifications() {
    const start = (this.currentPage - 1) * this.notificationsPerPage;
    return this.notifications.slice(start, start + this.notificationsPerPage);
  }

  get totalPages(): number {
    return this.notifications.length > 0
      ? Math.ceil(this.notifications.length / this.notificationsPerPage)
      : 1;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
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
  getStatusClass(status?: string): string {
  if (!status) {
    return 'neutral';  // fallback class
  }
  switch (status.toLowerCase()) {
    case 'approved': return 'approved';
    case 'rejected': return 'rejected';
    case 'pending': return 'neutral';
    default: return 'neutral';
  }
}
getStatusIcon(status?: string): string {
  if (!status) {
    return '/assets/images/clock.png'; // fallback icon
  }
  switch (status.toLowerCase()) {
    case 'approved': return '/assets/images/approved.png';
    case 'rejected': return '/assets/images/rejected.png';
    case 'pending': return '/assets/images/clock.png';
    default: return '/assets/images/clock.png';
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
