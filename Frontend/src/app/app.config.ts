import {
  ApplicationConfig,
  LOCALE_ID,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { authInterceptorProvider } from './interceptors/auth.interceptor';
import { provideAnimations } from '@angular/platform-browser/animations';
import { loadingInterceptorProvider } from './interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top', 
      })
    ),
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi()),
    authInterceptorProvider,
    loadingInterceptorProvider,
    { provide: LOCALE_ID, useValue: 'he' },
  ],
};
