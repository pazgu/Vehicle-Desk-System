import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { ToastService } from '../../../services/toast.service';
import { MyRidesService } from '../../../services/myrides.service';
import { RideUserChecksService } from '../../../services/ride-user-checks.service';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ProtectedRouteGuard implements CanActivate {
  constructor(
    private router: Router,
    private toastService: ToastService,
    private myRidesService: MyRidesService,
    private rideUserChecksService: RideUserChecksService
  ) {}

  private redirectByRole(role: string) {
    this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
    this.router.navigate(['/not-found']);
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> | boolean {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('role');
    const url = state.url;

    if (!token) {
      this.toastService.show('אנא התחבר כדי לגשת לעמוד זה', 'error');
      this.router.navigate(['/login']);
      return false;
    }

    if (url.includes('/home')) {
      return this.checkHomeAccess();
    }

    if (url.includes('order-card') && role !== 'supervisor') {
      if (role) this.redirectByRole(role);
      return false;
    }

    const adminOnlyRoutes = [
      'user-card',
      'vehicle-details',
      'archived-vehicles',
      '/vehicle-dashboard',
      '/audit-logs',
      '/admin/critical-issues',
      '/user-data',
      '/department-data',
      '/admin/add-new-user',
      '/admin/analytics',
      'admin/guidelines',
    ];

    if (
      adminOnlyRoutes.some((route) => url.includes(route)) &&
      role !== 'admin'
    ) {
      if (role) this.redirectByRole(role);
      return false;
    }

    if (
      url.includes('ride/details') &&
      role != 'employee' &&
      role != 'supervisor'
    ) {
      if (role) this.redirectByRole(role);
      return false;
    }

    if (
      url.includes('ride-completion-form') &&
      role != 'employee' &&
      role != 'supervisor'
    ) {
      if (role) this.redirectByRole(role);
      return false;
    }

    if (
      (url.includes('/home') || url.includes('/all-rides')) &&
      role !== 'employee' &&
      role !== 'supervisor'
    ) {
      if (role) this.redirectByRole(role);
      return false;
    }

    if (url.includes('/notifications')) {
      return true;
    }

    if (url.includes('supervisor-dashboard') && role != 'supervisor') {
      if (role) this.redirectByRole(role);
      return false;
    }

    if (url.startsWith('/ride/edit')) {
      if (role != 'employee' && role != 'supervisor') {
        if (role) this.redirectByRole(role);
      }
      return true;
    }

    const inspectorOnlyRoutes = [
      '/inspector/inspection',
      '/inspector/vehicles',
    ];

    if (
      inspectorOnlyRoutes.some((r) => url.startsWith(r)) &&
      role !== 'inspector'
    ) {
      if (role) this.redirectByRole(role);
      return false;
    }

    return true;
  }

  private checkHomeAccess(): Observable<boolean> {
    const userId = localStorage.getItem('employee_id');
    
    if (!userId) {
      this.toastService.show('שגיאה: לא נמצא מזהה משתמש', 'error');
      this.router.navigate(['/all-rides']);
      return of(false);
    }

    return this.myRidesService.checkPendingRebook().pipe(
      switchMap((rebookRes) => {
        if (rebookRes.has_pending) {
          this.toastService.show(
            'יש נסיעות ממתינות לשחזור, יש להשלים את החידוש לפני הזמנת נסיעה חדשה',
            'error'
          );
          this.router.navigate(['/all-rides']);
          return of(false);
        }

        return this.rideUserChecksService.checkUserCanCreateRide(userId).pipe(
          map((result) => {
            if (!result.canNavigate) {
              if (result.reason === 'blocked') {
                const expiryMsg = result.blockExpirationDate
                  ? ' עד תאריך ' + new Date(result.blockExpirationDate).toLocaleDateString('he-IL')
                  : '';
                this.toastService.showPersistent(
                  `לא ניתן לשלוח בקשה: לצערנו אתה חסום מהאתר ולא ניתן לבצע הזמנות${expiryMsg}.`,
                  'error'
                );
              } else if (result.reason === 'no_license') {
                this.toastService.showPersistent(
                  'לא ניתן לשלוח בקשה: אין לך רישיון ממשלתי תקף. לעדכון פרטים יש ליצור קשר עם המנהל.',
                  'error'
                );
              } else if (result.reason === 'expired_license') {
                this.toastService.showPersistent(
                  'לא ניתן לשלוח בקשה: הרישיון הממשלתי שלך פג תוקף. לעדכון פרטים יש ליצור קשר עם המנהל.',
                  'error'
                );
              }

              this.router.navigate(['/all-rides']);
              return false;
            }

            return true;
          }),
          catchError((err) => {
            console.error('Error checking user ride eligibility:', err);
            return of(true);
          })
        );
      }),
      catchError((err) => {
        console.error('Error checking pending rebook:', err);
        return of(true);
      })
    );
  }
}