import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { HeaderComponent } from '../header/header.component';
import { RouterModule } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

// --- ADD THESE IMPORTS ---
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators'; // takeUntil comes from 'rxjs/operators'
import { LoadingSpinnerComponent } from '../../loading-spinner/loading-spinner/loading-spinner.component';
// -------------------------

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [HeaderComponent, RouterModule, CommonModule,LoadingSpinnerComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent implements OnInit,OnDestroy {
  private subscription = new Subscription();
  pendingRideId: string | null = null;
  feedbackCheckComplete = false;
  loggedIn = false;
   isFeedbackPage: boolean = false;
   private routerSubscription: Subscription | undefined;
  private unsubscribe$ = new Subject<void>();

  constructor(
    private socketService: SocketService,
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {

    this.authService.isLoggedIn$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((isLoggedIn: boolean) => { // Explicitly type 'isLoggedIn' for clarity and type safety
        this.loggedIn = isLoggedIn;
        this.checkFeedbackNeeded();
      });
      this.routerSubscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isFeedbackPage = event.urlAfterRedirects.includes('/ride-completion-form');
      }
    });

    // Initial check in case the component loads directly on the feedback page
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
  }})
    
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
    this.feedbackCheckComplete = true; // Set to true to allow *ngIf to evaluate
    this.pendingRideId = null; // This will hide the button
    localStorage.removeItem('pending_feedback_ride'); // Clear stored ID
    
  }

  checkFeedbackNeeded(): void {
    const userId = this.getUserIdFromAuthService();

 if (!userId) {
      this.hideFeedbackButton(); // Call the new function here
      return;
    }



    this.http.get<any>(`${environment.apiUrl}/rides/feedback/check/${userId}`).subscribe(
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
        if (!this.pendingRideId) {
          this.feedbackCheckComplete = true;
        }
      }
    );
  }

  getUserIdFromAuthService(): string | null {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return null;
    }
    try {
      const payloadJson = atob(token.split('.')[1]);
      const payload = JSON.parse(payloadJson);
      return payload.sub || null;
    } catch (err) {
      console.error('[GET USER ID] Error parsing token payload:', err);
      return null;
    }
  }

  onFormCompleted(): void {
    localStorage.removeItem('pending_feedback_ride');
    this.pendingRideId = null;
  }

  onFeedbackButtonClick(): void {
        this.pendingRideId = null;

  }
}