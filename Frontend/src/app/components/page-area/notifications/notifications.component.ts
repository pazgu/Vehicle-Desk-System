import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AdminNotificationResponse,
  NotificationService,
} from '../../../services/notification';
import { formatDistanceToNow } from 'date-fns';
import { MyNotification } from '../../../models/notification';
import { he } from 'date-fns/locale';
import { Router } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';
import { ChangeDetectorRef } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.css',
})
export class NotificationsComponent implements OnInit {
  notifications: (MyNotification & { timeAgo: string })[] = [];
  currentPage = 1;
  notificationsPerPage = 3;

  constructor(
    private notificationService: NotificationService,
    private socketService: SocketService,
    private toastService: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private location: Location
  ) {}
  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    const userId = localStorage.getItem('employee_id');
    this.notificationService.markAllNotificationsAsSeen().subscribe({
      next: () => {
        this.notificationService.unreadCount$.next(0);
      },
      error: (err) => {
        console.error('Failed to mark notifications as seen:', err);
      }
    });

    const role = localStorage.getItem('role');
    if (role === 'admin') {
      this.notificationService.getNotifications().subscribe({
        next: (data) => {
          this.notifications = data.map((note) => ({
            ...note,
            timeAgo: formatDistanceToNow(new Date(note.sent_at), {
              addSuffix: true,
              locale: he,
            }),
          }));
        },
        error: (err) => {
          console.error('Failed to fetch notifications:', err);
        },
      });

      this.socketService.vehicleExpiry$.subscribe((newNotif) => {
        if (newNotif) {
          const notifWithTimeAgo = {
            ...newNotif,
            timeAgo: formatDistanceToNow(new Date(newNotif.sent_at), {
              addSuffix: true,
              locale: he,
            }),
          };

          this.notifications = [notifWithTimeAgo, ...this.notifications];
          this.cdr.detectChanges();

          if (this.router.url != '/notifications') {
            if (
              newNotif.message.includes('בעיה חמורה') ||
              newNotif.notification_type === 'critical'
            ) {
              const audio = new Audio('assets/sounds/notif.mp3');
              audio.play();
            }

           
          }
        }
      });
      this.socketService.odometerNotif$.subscribe(
        (payload: { updated_notifications: MyNotification[] } | null) => {
          if (!payload || !payload.updated_notifications) {
            console.warn(
              'Got null or bad odometer notification payload:',
              payload
            );
            return;
          }

          const notifs = payload.updated_notifications;

          notifs.forEach((newNotif) => {
            const notifWithTimeAgo = {
              ...newNotif,
              timeAgo: formatDistanceToNow(new Date(newNotif.sent_at), {
                addSuffix: true,
                locale: he,
              }),
            };

            this.notifications = [notifWithTimeAgo, ...this.notifications];
            this.cdr.detectChanges();

            if (this.router.url !== '/notifications') {
              if (
                newNotif.message.includes('בעיה חמורה') ||
                newNotif.notification_type === 'critical'
              ) {
                const audio = new Audio('assets/sounds/notif.mp3');
                audio.play();
              }

            
            }
          });
        }
      );
    } else {
      this.notificationService.getNotifications().subscribe({
        next: (data) => {
          this.notifications = data.map((note) => ({
            ...note,
            timeAgo: formatDistanceToNow(new Date(note.sent_at), {
              addSuffix: true,
              locale: he,
            }),
          }));
        },
        error: (err) => {
          console.error('Failed to fetch notifications:', err);
        },
      });
    }
    this.socketService.notifications$.subscribe((newNotif) => {
  if (newNotif && newNotif.user_id == userId) {
    const notifWithTimeAgo = {
      ...newNotif,
      timeAgo: formatDistanceToNow(new Date(newNotif.sent_at), {
        addSuffix: true,
        locale: he,
      }),
    };

    this.notifications = [notifWithTimeAgo, ...this.notifications];
    this.cdr.detectChanges();

    if (this.router.url != '/notifications') {
      // special case: reservation cancelled due to vehicle freeze
      if (this.isVehicleFreezeCancellation(newNotif)) {
        this.toastService.show(
          'הנסיעה שלך בוטלה כי הרכב יצא משימוש (תקלת מוסך / תאונה). אנא הזמן/י נסיעה חדשה.',
          'error'
        );
        return;
      }

      if (
        newNotif.message?.includes('בעיה חמורה') ||
        newNotif.notification_type === 'critical'
      ) {
        const audio = new Audio('assets/sounds/notif.mp3');
        audio.play();
      }

      if (newNotif.message?.includes('נדחתה')) {
        this.toastService.show(newNotif.message, 'error');
      } else {
        this.toastService.show(newNotif.message || '', 'success');
      }
    }
  }
});

  }

  goToOrder(orderId: string): void {
  const role = localStorage.getItem('role');

  if (role === 'supervisor') {
    this.router.navigate([`/order-card/${orderId}`]);
  } else {
    this.router.navigate([`/ride/details/${orderId}`]);
  }
}


  goToVehicle(vehicleId: string): void {
    this.router.navigate([`/vehicle-details/${vehicleId}`]);
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

    if (lower.includes('vehicle unavailable due to technical issues') || lower.includes('בוטלה עקב תקלה ברכב')) {
      return 'ההזמנה שלך בוטלה כי הרכב הוקפא בעקבות תקלה. אנא הזמן/י נסיעה חדשה עם רכב אחר.';
    } else if (lower.includes('נשלחה בהצלחה')) {
      return 'ההזמנה שלך נשלחה בהצלחה. תקבל/י התראה לאחר הבדיקה והאישור.';
    } else if (lower.includes('אושרה')) {
      return 'ההזמנה שלך אושרה.';
    } else if (lower.includes('נדחתה')) {
      return 'ההזמנה שלך נדחתה.';
    } else {
      return message;
    }
  }

  getStatusClass(status?: string): string {
    if (!status) {
      return 'neutral';
    }
    switch (status.toLowerCase()) {
      case 'approved':
        return 'approved';
      case 'rejected':
        return 'rejected';
      case 'pending':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  getStatusIcon(status?: string): string {
    if (!status) {
      return '/assets/images/clock.png';
    }
    switch (status.toLowerCase()) {
      case 'approved':
        return '/assets/images/approved.png';
      case 'rejected':
        return '/assets/images/rejected.png';
      case 'pending':
        return '/assets/images/clock.png';
      default:
        return '/assets/images/clock.png';
    }
  }

    handleNotificationClick(notif: MyNotification): void {
    const role = localStorage.getItem('role');

    if (!notif.seen) {
      this.notificationService.markNotificationAsSeen(notif.id).subscribe({
        next: () => {
          notif.seen = true;
        },
        error: (err) => {
          console.error('Failed to mark notification as seen:', err);
        }
      });
    }

    // 🔴 1) Vehicle freeze → go to "הנסיעות שלי" (My Reservations)
    if (this.isVehicleFreezeCancellation(notif)) {
      this.router.navigate(['/all-rides'], {
        queryParams: {
          mode: 'future',           // show future rides (where the cancelled one was)
          highlight: notif.order_id // let the table highlight that row if still present
        },
      });
      return;
    }

    // existing logic
    if (role != 'admin' && notif.message.includes('לא הוחזר בזמן')) {
      return;
    }

    if (role === 'admin' && notif.message.includes('בעיה חמורה')) {
      this.router.navigate(['/admin/critical-issues'], {
        queryParams: { highlight: '1' },
      });
    } else if (notif.order_id) {
      this.goToOrder(notif.order_id);
    } else if (notif.vehicle_id) {
      this.goToVehicle(notif.vehicle_id);
    }
  }


  getLeaseAlerts(title: string): string {
    return title == 'Vehicle Lease Expiry' ? 'lease-alert' : '';
  }

  getInactiveAlerts(title: string): string {
    return title == 'Inactive Vehicle' ? 'inactive-alert' : '';
  }
  onImageError(event: any, note: MyNotification): void {
    event.target.src = 'assets/images/message.png';
  }

  isVehicleFreezeCancellation(notif: MyNotification): boolean {
  const type = (notif as any).notification_type?.toLowerCase?.() || '';
  const msg = notif.message?.toLowerCase?.() || '';

  return (
    type === 'reservation_vehicle_frozen' ||
    type === 'ride_cancelled_vehicle_freeze' ||
    msg.includes('vehicle unavailable due to technical issues') ||
    msg.includes('בוטלה עקב תקלה ברכב')
  );
}


}
