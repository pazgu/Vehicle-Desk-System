import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../services/loading.service';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  constructor(private loadingService: LoadingService) {}

 intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
  const shouldSkipLoading = this.shouldSkip(req.url);

  if (!shouldSkipLoading) {
    this.loadingService.show();
  }

  return next.handle(req).pipe(
    finalize(() => {
      if (!shouldSkipLoading) {
        this.loadingService.hide();
      }
    })
  );
}

private shouldSkip(url: string): boolean {
  const skipList = [
    '/api/distance',
    '/api/all-vehicles-new-ride',
    '/api/employees/by-department',
    '/api/cities',
    '/api/city',
    '/api/vehicles/types'
  ];

  return skipList.some(skipUrl => url.includes(skipUrl));
}

}

export const loadingInterceptorProvider = {
  provide: HTTP_INTERCEPTORS,
  useClass: LoadingInterceptor,
  multi: true
};