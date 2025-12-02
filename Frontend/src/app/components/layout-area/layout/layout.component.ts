import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';
import { RouterModule } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { Subscription, Subject } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { takeUntil } from 'rxjs/operators';
import { LoadingSpinnerComponent } from '../../loading-spinner/loading-spinner/loading-spinner.component';
import { LayoutService } from '../../../services/layout.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    HeaderComponent,
    RouterModule,
    CommonModule,
    LoadingSpinnerComponent,
  ],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit, OnDestroy {
  private subscription = new Subscription();
  pendingRideId: string | null = null;
  feedbackCheckComplete = false;
  loggedIn = false;
  isFeedbackPage: boolean = false;
  private routerSubscription: Subscription | undefined;
  private unsubscribe$ = new Subject<void>();

  constructor(
    private socketService: SocketService,
    private router: Router,
    private authService: AuthService,
    private layoutService: LayoutService
  ) {}

  ngOnInit() {
    this.authService.isLoggedIn$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((isLoggedIn: boolean) => {
        this.loggedIn = isLoggedIn;
        if (isLoggedIn) {
          this.checkFeedbackNeeded();
        } else {
          this.hideFeedbackButton();
        }
      });

    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.isFeedbackPage = event.urlAfterRedirects.includes(
          '/ride-completion-form'
        );
      }
    });

    this.isFeedbackPage = this.router.url.includes('/ride-completion-form');

    const storedRideId = localStorage.getItem('pending_feedback_ride');
    if (storedRideId) {
      this.pendingRideId = storedRideId;
    }

    this.socketService.feedbackNeeded$.subscribe((data) => {
      if (data) {
        this.checkFeedbackNeeded();
      } else {
        console.warn('Received null or empty feedback data');
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    this.subscription.unsubscribe();
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  hideFeedbackButton(): void {
    this.feedbackCheckComplete = true;
    this.pendingRideId = null;
    localStorage.removeItem('pending_feedback_ride');
  }

  checkFeedbackNeeded(): void {
    const userId = this.layoutService.getUserIdFromToken();

    if (!userId) {
      this.hideFeedbackButton();
      return;
    }

    this.layoutService.checkPendingFeedback(userId).subscribe(
      (res) => {
        if (res?.showPage && res?.ride_id) {
          localStorage.setItem('pending_feedback_ride', res.ride_id);
          this.pendingRideId = res.ride_id;
        } else {
          localStorage.removeItem('pending_feedback_ride');
          this.pendingRideId = null;
        }
        this.feedbackCheckComplete = true;
      },
      (error) => {
        console.error('Error checking feedback status:', error);
        if (!this.pendingRideId) {
          this.feedbackCheckComplete = true;
        }
      }
    );
  }

  onFormCompleted(): void {
    localStorage.removeItem('pending_feedback_ride');
    this.pendingRideId = null;
  }

  onFeedbackButtonClick(): void {
    this.pendingRideId = null;
  }
}
