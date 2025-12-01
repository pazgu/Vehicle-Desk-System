// import { Injectable } from '@angular/core';
// import { HttpErrorResponse } from '@angular/common/http';
// import { BehaviorSubject, Observable, EMPTY, defer } from 'rxjs';
// import { catchError, tap } from 'rxjs/operators';

// /**
//  * Back-compat state (old fields) + new fields.
//  * Kept to avoid breaking existing components/templates.
//  */
// export interface EmailHandlerState {
//   // OLD fields (compat)
//   isLoading: boolean;
//   message: string | null;
//   showRetry: boolean;
//   retryIdentifier: string | null;
//   retryCallback: (() => void) | null;
//   retryEmailFn: ((identifier: string) => Observable<any>) | null;
//   emailAction: 'forgot_password' | 'general' | null;
//   isCooldownActive: boolean; // no-op (kept for compat)
//   cooldownSeconds: number;   // no-op (kept for compat)

//   // NEW fields (preferred)
//   visible: boolean;
//   loading: boolean;
//   success: boolean;
//   errorMessage?: string;
//   lastOpFactory?: () => Observable<unknown>;
// }

// @Injectable({ providedIn: 'root' })
// export class EmailHandlerService {
//   private readonly _state = new BehaviorSubject<EmailHandlerState>({
//     // old
//     isLoading: false,
//     message: null,
//     showRetry: false,
//     retryIdentifier: null,
//     retryCallback: null,
//     retryEmailFn: null,
//     emailAction: null,
//     isCooldownActive: false,
//     cooldownSeconds: 0,
//     // new
//     visible: false,
//     loading: false,
//     success: false,
//     errorMessage: undefined,
//     lastOpFactory: undefined
//   });

//   /** Public state stream */
//   readonly state$ = this._state.asObservable();

//   /** NO-OP cooldown stream (kept so old subscribers don’t break) */
//   private _retryCooldown = new BehaviorSubject<number>(0);
//   readonly retryCooldown$ = this._retryCooldown.asObservable();

//   // =========================
//   // NEW, preferred API
//   // =========================

//   /**
//    * Wrap any email op so 422 opens the retry UI.
//    * Usage:
//    *   emailHandler.handle(() => http.post(...)).subscribe(...)
//    * Optionally pass a retryFactory to call a dedicated /emails/retry endpoint.
//    */
//   handle<T>(
//     opFactory: () => Observable<T>,
//     retryFactory?: () => Observable<unknown>
//   ): Observable<T> {
//     this.patch({
//       loading: true,  isLoading: true,
//       visible: false, showRetry: false,
//       success: false,
//       errorMessage: undefined, message: null,
//       lastOpFactory: undefined,
//       // clear legacy retry info
//       retryIdentifier: null,
//       retryCallback: null,
//       retryEmailFn: null
//     });

//     return defer(opFactory).pipe(
//       tap(() => {
//         this.patch({
//           loading: false, isLoading: false,
//           visible: false, showRetry: false,
//           success: true,
//           errorMessage: undefined, message: null
//         });
//       }),
//       catchError((err: HttpErrorResponse) => {
//         const isRetryable422 = err.status === 422;
//         if (isRetryable422) {
//           const serverId = err.error?.retry_info?.identifier_id ?? null;
//           const msg = err.error?.message || err.error?.detail || 'שליחת המייל נכשלה זמנית. תרצה לנסות שוב?';

//           this.patch({
//             loading: false, isLoading: false,
//             visible: true,  showRetry: true,
//             success: false,
//             errorMessage: msg, message: msg,

//             // store the server-provided identifier for retry
//             retryIdentifier: serverId,

//             // keep any provided retry function so we can call it with the server id
//             // (handleEmailOperation stores retryEmailFn on the state before calling handle())
//             // @ts-ignore - this._state value has retryEmailFn (compat)
//             retryEmailFn: this._state.value.retryEmailFn ?? null,

//             // Fallback for retry: if we have serverId+retryEmailFn use that,
//             // else retry the original opFactory (or a provided retryFactory)
//             lastOpFactory:
//               serverId && this._state.value.retryEmailFn
//                 ? () => this._state.value.retryEmailFn!(serverId)
//                 : (retryFactory ?? opFactory)
//           });

//           // Complete quietly so components don't need special error handling
//           return EMPTY;
//         }

//         // Non-422 → close popup; let AuthInterceptor toast if needed
//         this.patch({
//           loading: false, isLoading: false,
//           visible: false, showRetry: false,
//           success: false
//         });
//         throw err;
//       })
//     );
//   }

//   /** Re-run the last failed op (if any). */
//   retry(): void {
//     const s = this._state.value;

//     if (s.retryIdentifier && s.retryEmailFn) {
//       // Call the backend /emails/retry endpoint with the server-provided id
//       s.retryEmailFn(s.retryIdentifier).subscribe({
//         next: () => this.reset(),
//         error: () => this.patch({ visible: true, showRetry: true }) // keep popup open on failure
//       });
//       return;
//     }

//     const f = s.lastOpFactory;
//     if (f) this.handle(f).subscribe({ next: () => {}, error: () => {} });
//   }

//   /** Hide popup / clear error. */
//   reset(): void {
//     this.patch({
//       visible: false, showRetry: false,
//       errorMessage: undefined, message: null,
//       lastOpFactory: undefined,
//       loading: false, isLoading: false
//     });
//   }

//   // =========================
//   // BACK-COMPAT API (kept)
//   // =========================

//   /**
//    * Old signature (still supported):
//    * handleEmailOperation(apiCall$, retryCallback?, retryIdentifier?, retryEmailFn?, emailAction?)
//    * - If retryEmailFn+identifier are provided, we'll prefer them for the retry.
//    * - Otherwise we retry the same operation.
//    */
//   handleEmailOperation<T>(
//     apiCall$: Observable<T>,
//     retryCallback?: () => void,
//     retryIdentifier?: string | null,
//     retryEmailFn?: (identifier: string) => Observable<any>,
//     emailAction: 'forgot_password' | 'general' = 'general'
//   ): Observable<T> {
//     const opFactory = () => apiCall$;
//     const retryFactory = (retryEmailFn && retryIdentifier)
//       ? () => retryEmailFn(retryIdentifier)
//       : opFactory;

//     // store legacy metadata for any code that reads it
//     this.patch({
//       emailAction,
//       retryIdentifier: retryIdentifier ?? null,
//       retryCallback: retryCallback ?? null,
//       retryEmailFn: retryEmailFn ?? null
//     });

//     return this.handle(opFactory, retryFactory);
//   }

//   /** Old alias kept so existing code compiles */
//   closeRetryToast(): void { this.reset(); }

//   /** Old getters (kept) */
//   getState(): Observable<EmailHandlerState> { return this.state$; }
//   getCurrentState(): EmailHandlerState { return this._state.value; }

//   // =========================
//   // internals
//   // =========================
//   private patch(p: Partial<EmailHandlerState>) {
//     this._state.next({ ...this._state.value, ...p });
//   }
// }

import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, EMPTY, defer } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

/**
 * Back-compat state (old fields) + new fields.
 * Kept to avoid breaking existing components/templates.
 */
export interface EmailHandlerState {
  // OLD fields (compat)
  isLoading: boolean;
  message: string | null;
  showRetry: boolean;
  retryIdentifier: string | null;
  retryCallback: (() => void) | null;
  retryEmailFn: ((identifier: string) => Observable<any>) | null;
  emailAction: 'forgot_password' | 'general' | null;
  isCooldownActive: boolean; // no-op (kept for compat)
  cooldownSeconds: number; // no-op (kept for compat)

  // NEW fields (preferred)
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
    lastOpFactory: undefined,
  });

  /** Public state stream */
  readonly state$ = this._state.asObservable();

  /** NO-OP cooldown stream (kept so old subscribers don't break) */
  private _retryCooldown = new BehaviorSubject<number>(0);
  readonly retryCooldown$ = this._retryCooldown.asObservable();

  // Store reference to success callback for clearing form fields
  private successCallback?: () => void;
  private toastService?: any; // Will be injected dynamically

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  // Inject ToastService dynamically to avoid circular dependencies
  setToastService(toastService: any) {
    this.toastService = toastService;
  }

  // =========================
  // NEW, preferred API
  // =========================

  /**
   * Wrap any email op so 422 opens the retry UI.
   * Usage:
   *   emailHandler.handle(() => http.post(...), undefined, successCallback).subscribe(...)
   * Optionally pass a retryFactory to call a dedicated /emails/retry endpoint.
   */
  handle<T>(
    opFactory: () => Observable<T>,
    retryFactory?: () => Observable<unknown>,
    successCallback?: () => void
  ): Observable<T> {
    this.successCallback = successCallback;

    this.patch({
      loading: true,
      isLoading: true,
      visible: false,
      showRetry: false,
      success: false,
      errorMessage: undefined,
      message: null,
      lastOpFactory: undefined,
      // clear legacy retry info
      retryIdentifier: null,
      retryCallback: null,
      retryEmailFn: null,
    });

    return defer(opFactory).pipe(
      tap(() => {
        this.patch({
          loading: false,
          isLoading: false,
          visible: false,
          showRetry: false,
          success: true,
          errorMessage: undefined,
          message: null,
        });

        // Call success callback and show toast
        if (this.successCallback) {
          this.successCallback();
        }

        if (isPlatformBrowser(this.platformId) && this.toastService) {
          this.toastService.show('המייל נשלח בהצלחה!', 'success');
        }
      }),
      catchError((err: HttpErrorResponse) => {
        const isRetryable422 = err.status === 422;
        if (isRetryable422) {
          const serverId = err.error?.retry_info?.identifier_id ?? null;
          const msg =
            err.error?.message ||
            err.error?.detail ||
            'שליחת המייל נכשלה זמנית. תרצה לנסות שוב?';

          this.patch({
            loading: false,
            isLoading: false,
            visible: true,
            showRetry: true,
            success: false,
            errorMessage: msg,
            message: msg,

            // store the server-provided identifier for retry
            retryIdentifier: serverId,

            // keep any provided retry function so we can call it with the server id
            // (handleEmailOperation stores retryEmailFn on the state before calling handle())
            // @ts-ignore - this._state value has retryEmailFn (compat)
            retryEmailFn: this._state.value.retryEmailFn ?? null,

            // Fallback for retry: if we have serverId+retryEmailFn use that,
            // else retry the original opFactory (or a provided retryFactory)
            lastOpFactory:
              serverId && this._state.value.retryEmailFn
                ? () => this._state.value.retryEmailFn!(serverId)
                : retryFactory ?? opFactory,
          });

          // Complete quietly so components don't need special error handling
          return EMPTY;
        }

        // Non-422 → close popup; let AuthInterceptor toast if needed
        this.patch({
          loading: false,
          isLoading: false,
          visible: false,
          showRetry: false,
          success: false,
        });
        throw err;
      })
    );
  }

  /** Re-run the last failed op (if any). */
  retry(): void {
    const s = this._state.value;

    if (s.retryIdentifier && s.retryEmailFn) {
      // Call the backend /emails/retry endpoint with the server-provided id
      s.retryEmailFn(s.retryIdentifier).subscribe({
        next: () => {
          this.reset();
          // Call success callback and show toast on successful retry
          if (this.successCallback) {
            this.successCallback();
          }
          if (isPlatformBrowser(this.platformId) && this.toastService) {
            this.toastService.show('המייל נשלח בהצלחה!', 'success');
          }
        },
        error: (err) => {
          console.error('Retry failed:', err);
          // Keep popup open on failure, but maybe update the error message
          this.patch({
            visible: true,
            showRetry: true,
            errorMessage: 'הניסיון החוזר נכשל. אנא נסה שוב מאוחר יותר.',
            message: 'הניסיון החוזר נכשל. אנא נסה שוב מאוחר יותר.',
          });
        },
      });
      return;
    }

    const f = s.lastOpFactory;
    if (f) {
      this.handle(f).subscribe({
        next: () => {},
        error: () => {},
      });
    }
  }

  /** Hide popup / clear error. */
  reset(): void {
    this.patch({
      visible: false,
      showRetry: false,
      errorMessage: undefined,
      message: null,
      lastOpFactory: undefined,
      loading: false,
      isLoading: false,
    });
  }

  // =========================
  // BACK-COMPAT API (kept)
  // =========================

  /**
   * Old signature (still supported):
   * handleEmailOperation(apiCall$, retryCallback?, retryIdentifier?, retryEmailFn?, emailAction?, successCallback?)
   * - If retryEmailFn+identifier are provided, we'll prefer them for the retry.
   * - Otherwise we retry the same operation.
   */
  handleEmailOperation<T>(
    apiCall$: Observable<T>,
    retryCallback?: () => void,
    retryIdentifier?: string | null,
    retryEmailFn?: (identifier: string) => Observable<any>,
    emailAction: 'forgot_password' | 'general' = 'general',
    successCallback?: () => void
  ): Observable<T> {
    const opFactory = () => apiCall$;
    const retryFactory =
      retryEmailFn && retryIdentifier
        ? () => retryEmailFn(retryIdentifier)
        : opFactory;

    // store legacy metadata for any code that reads it
    this.patch({
      emailAction,
      retryIdentifier: retryIdentifier ?? null,
      retryCallback: retryCallback ?? null,
      retryEmailFn: retryEmailFn ?? null,
    });

    return this.handle(opFactory, retryFactory, successCallback);
  }

  /** Old alias kept so existing code compiles */
  closeRetryToast(): void {
    this.reset();
  }

  /** Old getters (kept) */
  getState(): Observable<EmailHandlerState> {
    return this.state$;
  }
  getCurrentState(): EmailHandlerState {
    return this._state.value;
  }

  // =========================
  // internals
  // =========================
  private patch(p: Partial<EmailHandlerState>) {
    this._state.next({ ...this._state.value, ...p });
  }
}
