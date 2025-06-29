import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { Observable, of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RideCompletionFormComponent } from '../../page-area/ride-completion-form/ride-completion-form.component';
import { environment } from '../../../../environments/environment';
import { SocketService } from '../../../services/socket.service';
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  fullName$: Observable<string> = of('');
  role$: Observable<string> = of('');
  isLoggedIn = false;

  showFeedbackModal = false;
  rideIdToComplete: string | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService,
    private http: HttpClient,
    private socketService:SocketService
  ) {}

  ngOnInit(): void {
    this.fullName$ = this.authService.fullName$;
    this.role$ = this.authService.role$;

    this.authService.isLoggedIn$.subscribe(value => {
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
  console.log('ride that needs feedback from header component:', data);
  if (data) {
    this.checkFeedbackNeeded();
  } else {
    console.warn('Received null or empty feedback data');
  }
  const role=localStorage.getItem('role');
  if(role==='employee'){this.toastService.show('יש למלא טופס חווית נסיעה','neutral')}
  
});

  }

  onLogout(): void {
    this.authService.logout();
    this.toastService.show('התנתקת בהצלחה', 'success');
    this.router.navigate(['/login']);
    this.toastService.clearAll()
  }

  getUserId(): string | null {
  const token = localStorage.getItem('access_token');
  if (!token) return null;

  // Decode token to extract user ID (assuming JWT)
  const payload = JSON.parse(atob(token.split('.')[1]));
  return payload.sub || null; // or 'user_id' depending on your token
}

  // Keep your original frontend code
checkFeedbackNeeded(): void {
  const userId = this.getUserId();

  if (!userId) return;

  this.http.get<any>(`${environment.apiUrl}/rides/feedback/check/${userId}`).subscribe(
    
    (res) => {
      console.log('Feedback check response:', res);
      if (res?.ride_id && res?.showPage) {
        localStorage.setItem('pending_feedback_ride', res.ride_id);
        this.rideIdToComplete = res.ride_id;
        this.showFeedbackModal = true;
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
}
