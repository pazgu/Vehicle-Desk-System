import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

@Injectable({
  providedIn: 'root' // Important for DI to pick it up
})
export class AuthInterceptor implements HttpInterceptor {
  constructor(private router: Router,private authService:AuthService,  private toastService: ToastService
) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = localStorage.getItem('access_token');

    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    const isEmailOp = authReq.headers.has('X-Email-Operation');

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        console.log('Caught in interceptor:', err); // 👈 Add this

        if (isEmailOp && err.status === 422) {
          return throwError(() => err);
        }

          if (err.status === 401 && err.error?.detail === 'Invalid token') {
          localStorage.clear();
          this.authService.setFullName('משתמש', '');
          this.toastService.show('הסתיים תוקף ההתחברות שלך. התחבר מחדש.', 'error'); // ✅ use toast
          this.router.navigate(['/login']);
        } else if (err.status === 403) {
          this.toastService.show('אין לך הרשאות לגשת למשאב זה.', 'error'); // ✅ also convert this one
        } else {
            const msg = err.error?.detail || err.error?.message || `Request failed (${err.status})`;
            this.toastService.show(msg, 'error');
        }

        return throwError(() => err);
      })
    );
  }
}

export const authInterceptorProvider = {
  provide: HTTP_INTERCEPTORS,
  useClass: AuthInterceptor,
  multi: true,
};

