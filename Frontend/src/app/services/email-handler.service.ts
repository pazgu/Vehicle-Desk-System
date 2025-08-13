// import { Injectable, OnDestroy } from '@angular/core';
// import { BehaviorSubject, Observable, of, Subscription, timer } from 'rxjs';
// import { catchError, tap, takeWhile } from 'rxjs/operators';
// import { HttpErrorResponse } from '@angular/common/http';
// import { ToastService } from './toast.service';

// export interface EmailHandlerState {
//   isLoading: boolean;
//   message: string | null;
//   showRetry: boolean;
//   retryIdentifier: string | null;
//   retryCallback: (() => void) | null;
//   retryEmailFn: ((identifier: string) => Observable<any>) | null;
//   emailAction: 'forgot_password' | 'general' | null;
//   isCooldownActive: boolean;
// }

// @Injectable({
//   providedIn: 'root',
// })
// export class EmailHandlerService implements OnDestroy {
//   private initialState: EmailHandlerState = {
//     isLoading: false,
//     message: null,
//     showRetry: false,
//     retryIdentifier: null,
//     retryCallback: null,
//     retryEmailFn: null,
//     emailAction: null,
//     isCooldownActive: false,
//   };

//   private stateSubject = new BehaviorSubject<EmailHandlerState>(this.initialState);
//   public state$ = this.stateSubject.asObservable();

//   private cooldownTimerSubscription: Subscription | null = null;
//   private _retryCooldown = new BehaviorSubject<number>(0);
//   public retryCooldown$ = this._retryCooldown.asObservable();

//   constructor(private toastService: ToastService) {}

//   /**
//    * Handles the entire lifecycle of an email-related API call.
//    */
//   handleEmailOperation(
//     apiCall: Observable<any>,
//     retryCallback: () => void,
//     retryIdentifier?: string | null,
//     retryEmailFn?: (identifier: string) => Observable<any>,
//     emailAction: 'forgot_password' | 'general' = 'general'
//   ): Observable<any> {
//     this.updateState({
//       isLoading: true,
//       message: null,
//       showRetry: false,
//       retryIdentifier: null,
//       retryCallback: null,
//       retryEmailFn: null,
//       emailAction: emailAction,
//       isCooldownActive: false
//     });

//     return apiCall.pipe(
//       tap(() => {
//         this.toastService.show('המייל נשלח בהצלחה! ✅', 'success');
//         this.updateState({ 
//           isLoading: false, 
//           message: 'השליחה בוצעה בהצלחה.', 
//           showRetry: false 
//         });
//       }),
//       catchError((err: HttpErrorResponse) => {
//         const errorMessage = err.error?.detail || 'אירעה שגיאה. אנא נסו שוב.';
        
//         this.updateState({
//           isLoading: false,
//           message: errorMessage,
//           showRetry: true,
//           retryIdentifier: err.error?.retry_info?.identifier_id || retryIdentifier || null,
//           retryCallback: retryCallback,
//           retryEmailFn: retryEmailFn,
//           emailAction: emailAction,
//         });

//         if (this.stateSubject.value.showRetry && this.stateSubject.value.retryIdentifier) {
//           this.startRetryCooldown();
//         }
        
//         return of(null);
//       })
//       // REMOVED: The finalize operator has been removed to prevent race conditions.
//     );
//   }

//   /**
//    * Retries the failed email operation.
//    */
//   retry() {
//     const currentState = this.stateSubject.value;
//     if (currentState.isCooldownActive) {
//       return;
//     }
    
//     if (currentState.retryCallback) {
//       this.updateState({ 
//         isLoading: true, 
//         showRetry: false, 
//         message: null 
//       });
//       this.stopRetryCooldown();
//       currentState.retryCallback();
//     } else if (currentState.retryIdentifier && currentState.retryEmailFn) {
//       this.updateState({ 
//         isLoading: true, 
//         showRetry: false, 
//         message: null 
//       });
//       this.stopRetryCooldown();

//       currentState.retryEmailFn(currentState.retryIdentifier).subscribe({
//         next: () => {
//           this.toastService.show('המייל נשלח בהצלחה! ✅', 'success');
//           this.updateState({ 
//             isLoading: false, 
//             message: 'השליחה בוצעה בהצלחה.', 
//             showRetry: false 
//           });
//         },
//         error: (err: HttpErrorResponse) => {
//           const errorMessage = err.error?.detail || 'שגיאה חוזרת. אנא נסו שוב מאוחר יותר.';
          
//           this.updateState({ 
//             isLoading: false, 
//             message: errorMessage, 
//             showRetry: true, 
//             retryIdentifier: currentState.retryIdentifier 
//           });
//           this.startRetryCooldown();
//         }
//       });
//     }
//   }

//   /**
//    * Manually closes the retry toast and resets the state.
//    */
//   closeRetryToast(): void {
//     this.stopRetryCooldown();
//     this.updateState({
//       showRetry: false,
//       message: null,
//       retryIdentifier: null,
//       retryCallback: null,
//       retryEmailFn: null,
//       isCooldownActive: false
//     });
//   }

//   /**
//    * Resets the entire service state.
//    */
//   reset(): void {
//     this.stopRetryCooldown();
//     this.stateSubject.next(this.initialState);
//   }

//   private startRetryCooldown(): void {
//     this.stopRetryCooldown(); 
//     this._retryCooldown.next(30);
//     this.updateState({ isCooldownActive: true });

//     this.cooldownTimerSubscription = timer(0, 1000).pipe(
//       takeWhile(() => this._retryCooldown.getValue() > 0)
//     ).subscribe(() => {
//       this._retryCooldown.next(this._retryCooldown.getValue() - 1);
//     }, null, () => {
//       this.stopRetryCooldown();
//       this.updateState({ isCooldownActive: false });
//     });
//   }

//   private stopRetryCooldown(): void {
//     if (this.cooldownTimerSubscription) {
//       this.cooldownTimerSubscription.unsubscribe();
//       this.cooldownTimerSubscription = null;
//     }
//     this._retryCooldown.next(0);
//   }

//   ngOnDestroy(): void {
//     this.stopRetryCooldown();
//     this.stateSubject.complete();
//     this._retryCooldown.complete();
//   }

//   private updateState(newState: Partial<EmailHandlerState>): void {
//     this.stateSubject.next({ ...this.stateSubject.value, ...newState });
//   }
// }








// import { Injectable, OnDestroy } from '@angular/core';
// import { BehaviorSubject, Observable, of, Subscription, timer } from 'rxjs';
// import { catchError, tap, takeWhile } from 'rxjs/operators';
// import { HttpErrorResponse } from '@angular/common/http';
// import { ToastService } from './toast.service';

// export interface EmailHandlerState {
//   isLoading: boolean;
//   message: string | null;
//   showRetry: boolean;
//   retryIdentifier: string | null;
//   retryCallback: (() => void) | null;
//   retryEmailFn: ((identifier: string) => Observable<any>) | null;
//   emailAction: 'forgot_password' | 'general' | null;
//   isCooldownActive: boolean;
//   cooldownSeconds: number; // Add this to track cooldown seconds
// }

// @Injectable({
//   providedIn: 'root',
// })
// export class EmailHandlerService implements OnDestroy {
//   private initialState: EmailHandlerState = {
//     isLoading: false,
//     message: null,
//     showRetry: false,
//     retryIdentifier: null,
//     retryCallback: null,
//     retryEmailFn: null,
//     emailAction: null,
//     isCooldownActive: false,
//     cooldownSeconds: 0,
//   };

//   private stateSubject = new BehaviorSubject<EmailHandlerState>(this.initialState);
//   public state$ = this.stateSubject.asObservable();

//   private cooldownTimerSubscription: Subscription | null = null;
//   private _retryCooldown = new BehaviorSubject<number>(0);
//   public retryCooldown$ = this._retryCooldown.asObservable();

//   constructor(private toastService: ToastService) {}

//   /**
//    * Handles the entire lifecycle of an email-related API call.
//    */
//   handleEmailOperation(
//     apiCall: Observable<any>,
//     retryCallback: () => void,
//     retryIdentifier?: string | null,
//     retryEmailFn?: (identifier: string) => Observable<any>,
//     emailAction: 'forgot_password' | 'general' = 'general'
//   ): Observable<any> {
//     console.log('📧 Starting email operation:', {
//       emailAction,
//       retryIdentifier,
//       hasRetryCallback: !!retryCallback,
//       hasRetryEmailFn: !!retryEmailFn
//     });

//     this.updateState({
//       isLoading: true,
//       message: null,
//       showRetry: false,
//       retryIdentifier: null,
//       retryCallback: null,
//       retryEmailFn: null,
//       emailAction: emailAction,
//       isCooldownActive: false,
//       cooldownSeconds: 0
//     });

//     return apiCall.pipe(
//       tap((response) => {
//         console.log('✅ Email operation SUCCESS:', response);
//         this.toastService.show('המייל נשלח בהצלחה! ✅', 'success');
//         this.updateState({ 
//           isLoading: false, 
//           message: 'השליחה בוצעה בהצלחה.', 
//           showRetry: false 
//         });
//       }),
//       catchError((err: HttpErrorResponse) => {
//         console.log('❌ Email operation ERROR:', err);
//         const errorMessage = err.error?.detail || 'אירעה שגיאה. אנא נסו שוב.';
        
//         console.log('🔄 Setting up retry state:', {
//           errorMessage,
//           retryIdentifier: err.error?.retry_info?.identifier_id || retryIdentifier || null,
//           hasRetryCallback: !!retryCallback
//         });

//         this.updateState({
//           isLoading: false,
//           message: errorMessage,
//           showRetry: true,
//           retryIdentifier: err.error?.retry_info?.identifier_id || retryIdentifier || null,
//           retryCallback: retryCallback,
//           retryEmailFn: retryEmailFn,
//           emailAction: emailAction,
//         });

//         // Always start cooldown if we're showing retry, regardless of retryIdentifier
//         if (this.stateSubject.value.showRetry) {
//           console.log('Starting cooldown...');
//           this.startRetryCooldown();
//         }
        
//         return of(null);
//       })
//     );
//   }

//   /**
//    * Retries the failed email operation.
//    */
//   retry() {
//     console.log('🔄 Retry method called');
//     const currentState = this.stateSubject.value;
    
//     if (currentState.isCooldownActive) {
//       console.log('❌ Retry blocked - cooldown active');
//       return;
//     }
    
//     if (currentState.retryCallback) {
//       console.log('🔄 Using retry callback');
//       this.updateState({ 
//         isLoading: true, 
//         showRetry: false, 
//         message: null 
//       });
//       this.stopRetryCooldown();
//       currentState.retryCallback();
//     } else if (currentState.retryIdentifier && currentState.retryEmailFn) {
//       console.log('🔄 Using retry email function');
//       this.updateState({ 
//         isLoading: true, 
//         showRetry: false, 
//         message: null 
//       });
//       this.stopRetryCooldown();

//       currentState.retryEmailFn(currentState.retryIdentifier).subscribe({
//         next: () => {
//           console.log('✅ Retry SUCCESS');
//           this.toastService.show('המייל נשלח בהצלחה! ✅', 'success');
//           this.updateState({ 
//             isLoading: false, 
//             message: 'השליחה בוצעה בהצלחה.', 
//             showRetry: false 
//           });
//         },
//         error: (err: HttpErrorResponse) => {
//           console.log('❌ Retry ERROR:', err);
//           const errorMessage = err.error?.detail || 'שגיאה חוזרת. אנא נסו שוב מאוחר יותר.';
          
//           this.updateState({ 
//             isLoading: false, 
//             message: errorMessage, 
//             showRetry: true, 
//             retryIdentifier: currentState.retryIdentifier 
//           });
//           this.startRetryCooldown();
//         }
//       });
//     } else {
//       console.warn('❌ No retry method available');
//     }
//   }

//   /**
//    * Manually closes the retry toast and resets the state.
//    */
//   closeRetryToast(): void {
//     console.log('🔄 Closing retry toast');
//     this.stopRetryCooldown();
//     this.updateState({
//       showRetry: false,
//       message: null,
//       retryIdentifier: null,
//       retryCallback: null,
//       retryEmailFn: null,
//       isCooldownActive: false,
//       cooldownSeconds: 0
//     });
//   }

//   /**
//    * Resets the entire service state.
//    */
//   reset(): void {
//     console.log('🔄 Resetting email handler service');
//     this.stopRetryCooldown();
//     this.stateSubject.next(this.initialState);
//   }

//   /**
//    * Get the current state synchronously
//    */
//   getCurrentState(): EmailHandlerState {
//     return this.stateSubject.value;
//   }

//   /**
//    * Get the state observable
//    */
//   getState(): Observable<EmailHandlerState> {
//     return this.state$;
//   }

//   private startRetryCooldown(): void {
//     console.log('⏰ Starting retry cooldown (30 seconds)');
//     this.stopRetryCooldown(); 
//     this._retryCooldown.next(30);
//     this.updateState({ 
//       isCooldownActive: true,
//       cooldownSeconds: 30
//     });

//     this.cooldownTimerSubscription = timer(0, 1000).pipe(
//       takeWhile(() => this._retryCooldown.getValue() > 0)
//     ).subscribe(() => {
//       const remaining = this._retryCooldown.getValue() - 1;
//       this._retryCooldown.next(remaining);
//       this.updateState({ cooldownSeconds: remaining });
      
//       if (remaining <= 0) {
//         console.log('⏰ Cooldown finished');
//         this.updateState({ 
//           isCooldownActive: false,
//           cooldownSeconds: 0
//         });
//       }
//     });
//   }

//   private stopRetryCooldown(): void {
//     console.log('⏰ Stopping retry cooldown');
//     if (this.cooldownTimerSubscription) {
//       this.cooldownTimerSubscription.unsubscribe();
//       this.cooldownTimerSubscription = null;
//     }
//     this._retryCooldown.next(0);
//     this.updateState({ 
//       isCooldownActive: false,
//       cooldownSeconds: 0
//     });
//   }

//   ngOnDestroy(): void {
//     this.stopRetryCooldown();
//     this.stateSubject.complete();
//     this._retryCooldown.complete();
//   }

//   private updateState(newState: Partial<EmailHandlerState>): void {
//     const currentState = this.stateSubject.value;
//     const updatedState = { ...currentState, ...newState };
//     console.log('📊 State update:', { 
//       from: {
//         isLoading: currentState.isLoading,
//         showRetry: currentState.showRetry,
//         message: currentState.message,
//         isCooldownActive: currentState.isCooldownActive
//       }, 
//       to: {
//         isLoading: updatedState.isLoading,
//         showRetry: updatedState.showRetry,
//         message: updatedState.message,
//         isCooldownActive: updatedState.isCooldownActive
//       }
//     });
//     this.stateSubject.next(updatedState);
//   }
// }






// // src/app/services/email-handler.service.ts
// import { Injectable } from '@angular/core';
// import { BehaviorSubject, Observable, catchError, finalize, of, tap, throwError } from 'rxjs';
// import { HttpErrorResponse } from '@angular/common/http';

// export interface EmailHandlerState {
//   isLoading: boolean;
//   isSuccess: boolean;
//   errorMessage: string | null;
//   emailIdentifier: string | null;
//   emailAction: string | null;
//   retryCallback: (() => void) | null;
// }

// @Injectable({
//   providedIn: 'root'
// })
// export class EmailHandlerService {
//   private initialState: EmailHandlerState = {
//     isLoading: false,
//     isSuccess: false,
//     errorMessage: null,
//     emailIdentifier: null,
//     emailAction: null,
//     retryCallback: null
//   };

//   private stateSubject = new BehaviorSubject<EmailHandlerState>(this.initialState);
//   state$ = this.stateSubject.asObservable();

//   constructor() {}

//   handleEmailOperation(apiCall: Observable<any>, retryCallback: () => void): void {
//     this.setState({ isLoading: true, isSuccess: false, errorMessage: null });

//     apiCall.pipe(
//       tap(() => {
//         // Success path
//         this.setState({
//           isLoading: false,
//           isSuccess: true,
//           errorMessage: 'האימייל נשלח בהצלחה!', // Email sent successfully!
//           retryCallback: null,
//           emailIdentifier: null,
//           emailAction: null
//         });
//       }),
//       catchError((error: HttpErrorResponse) => {
//         // Error path, specifically for the 422
//         if (error.status === 422 && error.error?.detail?.retry_info) {
//           console.error('API call failed with 422. Showing retry options.');
//           this.setState({
//             isLoading: false,
//             isSuccess: false,
//             errorMessage: 'לא ניתן היה לשלוח את האימייל.', // Could not send the email.
//             retryCallback: retryCallback,
//             emailIdentifier: error.error.detail.retry_info.identifier_id,
//             emailAction: error.error.detail.retry_info.email_type
//           });
//           // Do not re-throw here, as we have handled the error
//           return of(null);
//         } else {
//           // Handle other, unexpected errors
//           console.error('An unexpected error occurred:', error);
//           this.setState({
//             isLoading: false,
//             isSuccess: false,
//             errorMessage: 'אירעה שגיאה בלתי צפויה.', // An unexpected error occurred.
//             retryCallback: null,
//             emailIdentifier: null,
//             emailAction: null
//           });
//           return throwError(() => error);
//         }
//       }),
//       finalize(() => {
//         // Any cleanup if needed
//       })
//     ).subscribe();
//   }

//   retry(): void {
//     const currentState = this.stateSubject.value;
//     if (currentState.retryCallback) {
//       this.setState({ ...currentState, isLoading: true, errorMessage: null });
//       currentState.retryCallback();
//       this.reset(); // Reset the state after a retry attempt is initiated
//     }
//   }

//   reset(): void {
//     this.stateSubject.next(this.initialState);
//   }

//   private setState(newState: Partial<EmailHandlerState>): void {
//     this.stateSubject.next({ ...this.stateSubject.value, ...newState });
//   }
// }


// src/app/services/email-handler.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, EMPTY, defer } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, tap } from 'rxjs/operators';

/**
 * Back-compat state (old fields) + new fields.
 * Keep old names so existing templates/components don't break.
 */
export interface EmailHandlerState {
  // OLD fields (kept for compatibility)
  isLoading: boolean;
  message: string | null;
  showRetry: boolean;
  retryIdentifier: string | null;
  retryCallback: (() => void) | null;
  retryEmailFn: ((identifier: string) => Observable<any>) | null;
  emailAction: 'forgot_password' | 'general' | null;
  isCooldownActive: boolean; // no-op now
  cooldownSeconds: number;   // no-op now

  // NEW fields (recommended)
  visible: boolean;
  loading: boolean;
  success: boolean;
  errorMessage?: string;
  lastOpFactory?: () => Observable<unknown>;
}

@Injectable({ providedIn: 'root' })
export class EmailHandlerService {
  private readonly _state = new BehaviorSubject<EmailHandlerState>({
    // old
    isLoading: false,
    message: null,
    showRetry: false,
    retryIdentifier: null,
    retryCallback: null,
    retryEmailFn: null,
    emailAction: null,
    isCooldownActive: false,
    cooldownSeconds: 0,
    // new
    visible: false,
    loading: false,
    success: false,
    errorMessage: undefined,
    lastOpFactory: undefined
  });

  /** Stream for templates/components */
  readonly state$ = this._state.asObservable();

  /** NO-OP cooldown stream (kept only so old subscribers don't break) */
  private _retryCooldown = new BehaviorSubject<number>(0);
  readonly retryCooldown$ = this._retryCooldown.asObservable();

  // =========================
  // NEW, preferred API
  // =========================

  /**
   * Preferred usage:
   *   emailHandler.handle(() => http.post(...)).subscribe(...)
   * Optional retryFactory lets you switch to a dedicated /emails/retry endpoint on 422.
   */
  handle<T>(
    opFactory: () => Observable<T>,
    retryFactory?: () => Observable<unknown>
  ): Observable<T> {
    this.patch({
      loading: true, isLoading: true,
      visible: false, showRetry: false,
      success: false,
      errorMessage: undefined, message: null,
      lastOpFactory: undefined,
      // clear legacy retry info
      retryIdentifier: null,
      retryCallback: null,
      retryEmailFn: null
    });

    return defer(opFactory).pipe(
      tap(() => {
        this.patch({
          loading: false, isLoading: false,
          visible: false, showRetry: false,
          success: true,
          errorMessage: undefined, message: null
        });
      }),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 422) {
          const msg = err.error?.message || err.error?.detail || 'שליחת המייל נכשלה זמנית. תרצה לנסות שוב?';
          this.patch({
            loading: false, isLoading: false,
            visible: true,  showRetry: true,
            success: false,
            errorMessage: msg, message: msg,
            lastOpFactory: retryFactory ?? opFactory
          });
          return EMPTY;
        }
        // Non-422 → close popup; let AuthInterceptor toast if needed
        this.patch({
          loading: false, isLoading: false,
          visible: false, showRetry: false,
          success: false
        });
        return defer(() => { throw err; });
      })
    );
  }

  /** Re-run last failed op (if any). */
  retry(): void {
    const f = this._state.value.lastOpFactory;
    if (!f) return;
    this.handle(f).subscribe({ next: () => {}, error: () => {} });
  }

  /** Hide popup / clear error. */
  reset(): void {
    this.patch({
      visible: false, showRetry: false,
      errorMessage: undefined, message: null,
      lastOpFactory: undefined,
      loading: false, isLoading: false
    });
  }

  // =========================
  // BACK-COMPAT API (kept)
  // =========================

  /**
   * Old signature (still supported):
   * handleEmailOperation(apiCall$, retryCallback?, retryIdentifier?, retryEmailFn?, emailAction?)
   * - If retryEmailFn+identifier are provided, we'll prefer them for the retry.
   * - Otherwise we retry the same operation.
   */
  handleEmailOperation<T>(
    apiCall$: Observable<T>,
    retryCallback?: () => void,
    retryIdentifier?: string | null,
    retryEmailFn?: (identifier: string) => Observable<any>,
    emailAction: 'forgot_password' | 'general' = 'general'
  ): Observable<T> {
    // build factories so retries create fresh requests
    const opFactory = () => apiCall$;
    const retryFactory = (retryEmailFn && retryIdentifier)
      ? () => retryEmailFn(retryIdentifier)
      : opFactory;

    // store some legacy metadata for any component that reads it
    this.patch({ emailAction, retryIdentifier: retryIdentifier ?? null, retryCallback: retryCallback ?? null, retryEmailFn: retryEmailFn ?? null });

    // run through the new engine
    const result$ = this.handle(opFactory, retryFactory);

    // If someone relies on retryCallback instead of our internal retry,
    // keep it available via state.retryCallback (we still recommend calling service.retry()).
    return result$;
  }

  /** Old alias kept so existing code compiles */
  closeRetryToast(): void { this.reset(); }

  /** Old getters (kept) */
  getState(): Observable<EmailHandlerState> { return this.state$; }
  getCurrentState(): EmailHandlerState { return this._state.value; }

  // =========================
  // internals
  // =========================
  private patch(p: Partial<EmailHandlerState>) {
    this._state.next({ ...this._state.value, ...p });
  }
}
