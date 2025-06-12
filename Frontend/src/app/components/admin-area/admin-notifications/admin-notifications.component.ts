import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification';
import { MyNotification } from '../../../models/notification';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { InspectionService } from '../../../services/inspection.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-notifications.component.html',
  styleUrls: ['./admin-notifications.component.css']
})
export class AdminNotificationsComponent implements OnInit {
  notifications: (MyNotification & { timeAgo: string })[] = [];
  currentPage = 1;
  notificationsPerPage = 5;

  constructor(private notificationService: NotificationService ,  private inspectionService: InspectionService,
  private router: Router) {}

  ngOnInit(): void {
    this.notificationService.getNotifications().subscribe({
      next: (data) => {
        this.notifications = data
          .filter(n => n.notification_type === 'system') // 📌 Only system-level
          .map(note => ({
            ...note,
            timeAgo: formatDistanceToNow(new Date(note.sent_at), {
              addSuffix: true,
              locale: he
            })
          }));
      },
      error: (err) => {
        console.error('Failed to fetch admin notifications:', err);
      }
    });
  }

  get pagedNotifications() {
    const start = (this.currentPage - 1) * this.notificationsPerPage;
    return this.notifications.slice(start, start + this.notificationsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.notifications.length / this.notificationsPerPage));
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  onViewDailyInspections(): void {
  this.router.navigate(['/admin/daily-inspections']);
}

handleNotificationClick(notif: MyNotification): void {
  if (notif.message.includes('בעיה חמורה')) {
    this.router.navigate(['/admin/daily-inspections'], {
      queryParams: { highlight: '1' }
    });
  }
}




}
