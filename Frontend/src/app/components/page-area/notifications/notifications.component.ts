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

  getStatusIcon(status: string): string {
    return status === 'Approved' ? '✅' : '❌';
  }

  getStatusClass(status: string): string {
    return status === 'Approved' ? 'approved' : 'rejected';
  }
}
