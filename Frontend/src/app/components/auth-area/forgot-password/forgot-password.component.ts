import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css'],
  imports: [CommonModule, ReactiveFormsModule]
})
export class ForgotPasswordComponent {
  forgotForm: FormGroup;
  submitted = false;
  message = '';
  
  // New state management for better UX
  showRetryToast = false;
  isLoading = false;
  toastMessage = '';
  retryIdentifier: string | null = null;
  
  floatingChars: { char: string; left: number; delay: number; duration: number }[] = [];
  
  // User-friendly error messages mapping for forgot password context
  private userFriendlyErrors: { [key: string]: string } = {
    'Email utility reported failure': 'אירעה בעיה בשליחת המייל. אנא בדקו את הכתובת או נסו שוב.',
    'Invalid token': 'אירעה שגיאה טכנית. אנא נסו שוב או צרו קשר עם התמיכה.',
    'User not found': 'כתובת המייל לא נמצאה במערכת. אנא בדקו את הכתובת.',
    'Email not found': 'כתובת המייל לא נמצאה במערכת. אנא בדקו את הכתובת.',
    'Missing or Invalid token': 'אירעה שגיאה טכנית. אנא נסו שוב.',
    'Network error': 'אירעה בעיית רשת. אנא בדקו את החיבור לאינטרנט ונסו שוב.',
    'Server error': 'אירעה שגיאת שרת. אנא נסו שוב מאוחר יותר.',
    'Rate limit exceeded': 'נשלחו יותר מדי בקשות. אנא המתינו כמה דקות לפני שתנסו שוב.',
    'Invalid email format': 'כתובת המייל אינה תקינה. אנא בדקו את הפורמט.',
    'Service temporarily unavailable': 'שירות שליחת המיילים אינו זמין כרגע. אנא נסו שוב מאוחר יותר.',
    'Email delivery failed': 'שליחת המייל נכשלה. אנא בדקו את כתובת המייל ונסו שוב.',
    'SMTP error': 'אירעה בעיה בשליחת המייל. אנא נסו שוב או צרו קשר עם התמיכה.',
    'Invalid email address': 'כתובת המייל אינה חוקית. אנא בדקו את הכתובת.',
    'Account not found': 'לא נמצא חשבון עם כתובת מייל זו במערכת.'
  };

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
    
    const symbols = ['*', '#', '•', '@', '$', '%', '&'];
    for (let i = 0; i < 50; i++) {
      this.floatingChars.push({
        char: symbols[Math.floor(Math.random() * symbols.length)],
        left: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 5 + Math.random() * 5
      });
    }
  }

  get f() {
    return this.forgotForm.controls;
  }

  onSubmit() {
    this.submitted = true;
    this.message = '';
    this.hideRetryToast();

    if (this.forgotForm.invalid) return;

    this.isLoading = true;
    const email = this.forgotForm.value.email;
    
    this.authService.requestPasswordReset(email).subscribe({
      next: res => {
        this.isLoading = false;
        this.message = res.message;
      },
      error: err => {
        this.isLoading = false;
        this.handleError(err);
      }
    });
  }

  private handleError(err: any) {
    // Handle retryable errors
    if (err.status === 422 && err.error.retry_info) {
      this.toastMessage = this.getFriendlyErrorMessage(err.error.detail);
      this.showRetryToast = true;
      this.retryIdentifier = err.error.retry_info.identifier_id;
    } else {
      // Handle non-retryable errors with toast
      this.toastMessage = this.getFriendlyErrorMessage(err.error?.detail || err.message || 'Unknown error');
      this.showRetryToast = true;
      this.retryIdentifier = null; // No retry available
    }
  }

  private getFriendlyErrorMessage(errorMessage: string): string {
    // First, let's handle specific forgot password scenarios
    if (errorMessage.toLowerCase().includes('user not found') || 
        errorMessage.toLowerCase().includes('email not found') ||
        errorMessage.toLowerCase().includes('account not found')) {
      return 'כתובת המייל לא נמצאה במערכת. אנא בדקו את הכתובת.';
    }
    
    if (errorMessage.toLowerCase().includes('email') && 
        errorMessage.toLowerCase().includes('failed')) {
      return 'שליחת המייל נכשלה. אנא בדקו את כתובת המייל ונסו שוב.';
    }
    
    if (errorMessage.toLowerCase().includes('invalid email')) {
      return 'כתובת המייל אינה חוקית. אנא בדקו את הכתובת.';
    }
    
    if (errorMessage.toLowerCase().includes('rate limit') || 
        errorMessage.toLowerCase().includes('too many')) {
      return 'נשלחו יותר מדי בקשות. אנא המתינו כמה דקות לפני שתנסו שוב.';
    }
    
    // Check our error mappings
    for (const [key, value] of Object.entries(this.userFriendlyErrors)) {
      if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    
    // Check for common HTTP status patterns
    if (errorMessage.includes('404')) {
      return 'כתובת המייל לא נמצאה במערכת.';
    }
    if (errorMessage.includes('500')) {
      return 'אירעה שגיאת שרת פנימית. אנא נסו שוב מאוחר יותר.';
    }
    if (errorMessage.includes('timeout')) {
      return 'הבקשה לא הושלמה בזמן. אנא נסו שוב.';
    }
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'אירעה בעיית רשת. אנא בדקו את החיבור לאינטרנט ונסו שוב.';
    }
    
    // Fallback for unexpected errors - more generic and appropriate for forgot password
    return 'אירעה שגיאה בעת שליחת בקשת איפוס הסיסמה. אנא נסו שוב.';
  }

  onRetry() {
    // If we have a retryIdentifier, use the backend retry endpoint
    if (this.retryIdentifier) {
      this.isLoading = true;
      this.hideRetryToast();

      this.authService.retryEmail(this.retryIdentifier, 'forgot_password').subscribe({
        next: res => {
          this.isLoading = false;
          this.message = res.message;
        },
        error: err => {
          this.isLoading = false;
          this.handleError(err);
        }
      });
    } else {
      // For non-retryable errors, just resubmit the form
      this.hideRetryToast();
      this.onSubmit();
    }
  }

  hideRetryToast() {
    this.showRetryToast = false;
    this.toastMessage = '';
    this.retryIdentifier = null;
  }

  navigateBack() {
    this.router.navigate(['/login']);
  }
}