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
import { EmailHandlerService } from '../services/email-handler.service';

@Injectable()
export class EmailInterceptor implements HttpInterceptor {
  constructor(private emailHandlerService: EmailHandlerService) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Check for a specific header to identify email-related requests
    if (request.headers.has('X-Email-Operation')) {
      return next.handle(request).pipe(
        catchError((error: HttpErrorResponse) => {
          // Check for the 422 error and let the EmailHandlerService handle it
          if (error.status === 422) {
            console.log('EmailInterceptor caught a 422 error:', error.error);
            // We re-throw the error so the component's `handleEmailOperation`
            // can catch it and show the UI.
            return throwError(() => error);
          }
          // For any other error on an email request, just re-throw it
          return throwError(() => error);
        })
      );
    }

    // For any request that does NOT have our special header, skip this interceptor
    return next.handle(request);
  }
}