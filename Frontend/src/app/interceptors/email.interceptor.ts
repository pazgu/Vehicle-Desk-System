// src/app/interceptors/email.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class EmailInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (request.headers.has('X-Email-Operation')) {
      return next.handle(request).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 422) {
            console.log('EmailInterceptor caught a 422 error:', error.error);
            return throwError(() => error);
          }
          return throwError(() => error);
        })
      );
    }
    return next.handle(request);
  }
}
