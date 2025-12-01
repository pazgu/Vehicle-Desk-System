import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { Observable, of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification';
import { SocketService } from '../../../services/socket.service';
import { HeaderService } from '../../../services/header.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
  fullName$: Observable<string> = of('');
  role$: Observable<string> = of('');
  unreadCount$!: Observable<number>;
  isLoggedIn = false;
  showFeedbackModal = false;
  rideIdToComplete: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private notificationService: NotificationService,
    private socketService: SocketService,
    private headerService: HeaderService
  ) {}

  ngOnInit(): void {
    this.fullName$ = this.authService.fullName$;
    this.role$ = this.authService.role$;
    this.unreadCount$ = this.notificationService.unreadCount$;

    this.authService.isLoggedIn$.subscribe((value) => {
      this.isLoggedIn = value;
    });

    const pendingRideId = localStorage.getItem('pending_feedback_ride');
    if (pendingRideId) {
      this.rideIdToComplete = pendingRideId;
      this.showFeedbackModal = true;
    } else {
      this.checkFeedbackNeeded();
    }

    this.socketService.feedbackNeeded$.subscribe((data) => {
      if (data?.ride_id && data?.showPage) {
        localStorage.setItem('pending_feedback_ride', data.ride_id);
        this.rideIdToComplete = data.ride_id;
        this.showFeedbackModal = true;
      }
    });
  }

  onLogout(): void {
    this.authService.logout();
    this.toastService.show('התנתקת בהצלחה', 'success');
    this.router.navigate(['/login']);
    this.toastService.clearAll();
  }

  getUserId(): string | null {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || null;
    } catch (e) {
      console.error('Error parsing access token payload:', e);
      return null;
    }
  }

  checkFeedbackNeeded(): void {
    const userId = this.getUserId();
    if (!userId) return;

    this.headerService.checkFeedbackNeeded(userId).subscribe(
      (res) => {
        if (res?.ride_id && res?.showPage) {
          localStorage.setItem('pending_feedback_ride', res.ride_id);
          this.rideIdToComplete = res.ride_id;
          this.showFeedbackModal = true;
          this.toastService.show('יש למלא טופס חווית נסיעה', 'neutral');
        }
      },
      (error) => {
        console.error('Feedback check error:', error);
      }
    );
  }

  onFormCompleted(): void {
    localStorage.removeItem('pending_feedback_ride');
    this.rideIdToComplete = null;
    this.showFeedbackModal = false;
  }

  get isAuthPage(): boolean {
    const url = this.router.url;
    return (
      url.startsWith('/login') ||
      url.startsWith('/register') ||
      url.startsWith('/reset-password')
    );
  }
}
