// import { Injectable } from '@angular/core';
// import { BehaviorSubject, finalize } from 'rxjs';
// import { HttpErrorResponse } from '@angular/common/http';

// // Define the structure for a retry toast
// export interface RetryToast {
//   message: string;
//   isRetryable: boolean;
//   onRetry: () => void;
// }

// @Injectable({
//   providedIn: 'root'
// })
// export class EmailRetryService {
//   // Loading state for the white overlay
//   private _isLoading = new BehaviorSubject<boolean>(false);
//   isLoading$ = this._isLoading.asObservable();

//   // Toast state for retry notifications
//   private _retryToast = new BehaviorSubject<RetryToast | null>(null);
//   retryToast$ = this._retryToast.asObservable();

//   // Hebrew error messages mapping for email operations
//   private errorMessages: { [key: string]: string } = {
//     'Email utility reported failure': 'אירעה בעיה בשליחת המייל. אנא בדקו את הכתובת או נסו שוב.',
//     'Invalid token': 'אירעה שגיאה טכנית. אנא נסו שוב או צרו קשר עם התמיכה.',
//     'User not found': 'כתובת המייל לא נמצאה במערכת. אנא בדקו את הכתובת.',
//     'Email not found': 'כתובת המייל לא נמצאה במערכת. אנא בדקו את הכתובת.',
//     'Missing or Invalid token': 'אירעה שגיאה טכנית. אנא נסו שוב.',
//     'Network error': 'אירעה בעיית רשת. אנא בדקו את החיבור לאינטרנט ונסו שוב.',
//     'Server error': 'אירעה שגיאת שרת. אנא נסו שוב מאוחר יותר.',
//     'Rate limit exceeded': 'נשלחו יותר מדי בקשות. אנא המתינו כמה דקות לפני שתנסו שוב.',
//     'Invalid email format': 'כתובת המייל אינה תקינה. אנא בדקו את הפורמט.',
//     'Service temporarily unavailable': 'שירות שליחת המיילים אינו זמין כרגע. אנא נסו שוב מאוחר יותר.',
//     'Email delivery failed': 'שליחת המייל נכשלה. אנא בדקו את כתובת המייל ונסו שוב.',
//     'SMTP error': 'אירעה בעיה בשליחת המייל. אנא נסו שוב או צרו קשר עם התמיכה.',
//     'Invalid email address': 'כתובת המייל אינה חוקית. אנא בדקו את הכתובת.',
//     'Account not found': 'לא נמצא חשבון עם כתובת מייל זו במערכת.'
//   };

//   constructor() {}

//   /**
//    * Show loading overlay
//    */
//   showLoading(): void {
//     this._isLoading.next(true);
//   }

//   /**
//    * Hide loading overlay
//    */
//   hideLoading(): void {
//     this._isLoading.next(false);
//   }

//   /**
//    * Hide retry toast
//    */
//   hideToast(): void {
//     this._retryToast.next(null);
//   }

//   /**
//    * Handle email operation with automatic error handling and retry functionality
//    * @param emailOperation - The observable that performs the email operation
//    * @param retryCallback - Function to call when user clicks retry (for non-backend retries)
//    * @param retryIdentifier - Backend retry identifier (if available)
//    * @param retryEmailFn - Function to call backend retry (if retryIdentifier exists)
//    */
//   handleEmailOperation(
//     emailOperation: any,
//     retryCallback: () => void,
//     retryIdentifier?: string | null,
//     retryEmailFn?: (identifier: string, type: string) => any
//   ) {
//     this.showLoading();
//     this.hideToast(); // Clear any existing toast

//     return emailOperation.pipe(
//       finalize(() => this.hideLoading())
//     ).subscribe({
//       next: (res: any) => {
//         // Success - no toast needed, just clear loading
//         return res;
//       },
//       error: (err: HttpErrorResponse) => {
//         this.handleError(err, retryCallback, retryIdentifier, retryEmailFn);
//       }
//     });
//   }

//   /**
//    * Handle errors and show appropriate retry toast
//    */
//   private handleError(
//     err: HttpErrorResponse,
//     retryCallback: () => void,
//     retryIdentifier?: string | null,
//     retryEmailFn?: (identifier: string, type: string) => any
//   ): void {
//     const errorMessage = this.getFriendlyErrorMessage(
//       err.error?.detail || err.message || 'Unknown error'
//     );

//     // Create retry function based on whether we have backend retry or not
//     const retryFn = () => {
//       this.hideToast();
      
//       if (retryIdentifier && retryEmailFn) {
//         // Use backend retry
//         this.showLoading();
//         retryEmailFn(retryIdentifier, 'forgot_password').pipe(
//           finalize(() => this.hideLoading())
//         ).subscribe({
//           next: (res: any) => {
//             // Success - handle as needed
//           },
//           error: (retryErr: HttpErrorResponse) => {
//             this.handleError(retryErr, retryCallback, retryIdentifier, retryEmailFn);
//           }
//         });
//       } else {
//         // Use original callback
//         retryCallback();
//       }
//     };

//     // Show retry toast
//     this._retryToast.next({
//       message: errorMessage,
//       isRetryable: true,
//       onRetry: retryFn
//     });
//   }

//   /**
//    * Convert technical error messages to user-friendly Hebrew messages
//    */
//   private getFriendlyErrorMessage(errorMessage: string): string {
//     // Handle specific email scenarios first
//     if (errorMessage.toLowerCase().includes('user not found') || 
//         errorMessage.toLowerCase().includes('email not found') ||
//         errorMessage.toLowerCase().includes('account not found')) {
//       return 'כתובת המייל לא נמצאה במערכת. אנא בדקו את הכתובת.';
//     }
    
//     if (errorMessage.toLowerCase().includes('email') && 
//         errorMessage.toLowerCase().includes('failed')) {
//       return 'שליחת המייל נכשלה. אנא בדקו את כתובת המייל ונסו שוב.';
//     }
    
//     if (errorMessage.toLowerCase().includes('invalid email')) {
//       return 'כתובת המייל אינה חוקית. אנא בדקו את הכתובת.';
//     }
    
//     if (errorMessage.toLowerCase().includes('rate limit') || 
//         errorMessage.toLowerCase().includes('too many')) {
//       return 'נשלחו יותר מדי בקשות. אנא המתינו כמה דקות לפני שתנסו שוב.';
//     }
    
//     // Check our error mappings
//     for (const [key, value] of Object.entries(this.errorMessages)) {
//       if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
//         return value;
//       }
//     }
    
//     // Check for common HTTP status patterns
//     if (errorMessage.includes('404')) {
//       return 'כתובת המייל לא נמצאה במערכת.';
//     }
//     if (errorMessage.includes('500')) {
//       return 'אירעה שגיאת שרת פנימית. אנא נסו שוב מאוחר יותר.';
//     }
//     if (errorMessage.includes('timeout')) {
//       return 'הבקשה לא הושלמה בזמן. אנא נסו שוב.';
//     }
//     if (errorMessage.includes('network') || errorMessage.includes('connection')) {
//       return 'אירעה בעיית רשת. אנא בדקו את החיבור לאינטרנט ונסו שוב.';
//     }
    
//     // Fallback for email operations
//     return 'אירעה שגיאה בעת שליחת המייל. אנא נסו שוב.';
//   }
// }