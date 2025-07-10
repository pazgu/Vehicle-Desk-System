import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { HeaderComponent } from '../header/header.component';
import { RouterModule } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

// --- ADD THESE IMPORTS ---
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators'; // takeUntil comes from 'rxjs/operators'
// -------------------------

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [HeaderComponent, RouterModule, CommonModule],
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
    private toastService: ToastService,
    private http: HttpClient,
    private router: Router,
    private authService: AuthService
  ) {}


  

  ngOnInit() {
    console.log('[ON INIT] LayoutComponent initialized.');

    this.authService.isLoggedIn$
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((isLoggedIn: boolean) => { // Explicitly type 'isLoggedIn' for clarity and type safety
        console.log('[AUTH STATUS CHANGE] Logged in status received:', isLoggedIn);
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
      console.log('[ON INIT] Found stored ride ID:', storedRideId);
      this.pendingRideId = storedRideId;
    }
      this.socketService.feedbackNeeded$.subscribe((data) => {
  console.log('ride that needs feedback from header component:', data);
  if (data) {
    this.checkFeedbackNeeded();
    
  } else {
    console.warn('Received null or empty feedback data');
  }})
    
  }

  ngOnDestroy(): void {
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    console.log('[ON DESTROY] LayoutComponent destroyed. Subscriptions unsubscribed.');
    this.subscription.unsubscribe();
      if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }

  }
    hideFeedbackButton(): void {
    console.log('[HIDE FEEDBACK BUTTON] Hiding feedback button and clearing state.');
    this.feedbackCheckComplete = true; // Set to true to allow *ngIf to evaluate
    this.pendingRideId = null; // This will hide the button
    localStorage.removeItem('pending_feedback_ride'); // Clear stored ID
    
  }

  checkFeedbackNeeded(): void {
    const userId = this.getUserIdFromAuthService();

 if (!userId) {
      console.log('[CHECK FEEDBACK] No user ID found or user logged out. Calling hideFeedbackButton().');
      this.hideFeedbackButton(); // Call the new function here
      return;
    }

    console.log('[CHECK FEEDBACK] User ID found:', userId);
    console.log('[CHECK FEEDBACK] Checking feedback for user:', userId);

    this.http.get<any>(`${environment.apiUrl}/rides/feedback/check/${userId}`).subscribe(
      (res) => {
        console.log('[CHECK FEEDBACK] Server response:', JSON.stringify(res));
        if (res?.showPage && res?.ride_id) {
          console.log('[CHECK FEEDBACK] Feedback required. Setting pendingRideId to:', res.ride_id);
          localStorage.setItem('pending_feedback_ride', res.ride_id);
          this.pendingRideId = res.ride_id;
        } else {
          console.log('[CHECK FEEDBACK] No feedback required. Clearing localStorage and state.');
          localStorage.removeItem('pending_feedback_ride');
          this.pendingRideId = null;
        }
        this.feedbackCheckComplete = true;
        console.log('[CHECK FEEDBACK] feedbackCheckComplete set to true.');
      },
      (error) => {
        console.error('[CHECK FEEDBACK] Error during feedback check:', error);
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
    console.log('[FORM COMPLETED] User completed feedback form. Clearing feedback state.');
    localStorage.removeItem('pending_feedback_ride');
    this.pendingRideId = null;
  }

  onFeedbackButtonClick(): void {
    console.log('Feedback button clicked! Navigating to form...');
        this.pendingRideId = null;

  }
}