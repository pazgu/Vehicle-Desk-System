import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ToastService } from '../../../services/toast.service'; // ✅ Make sure this path is correct

@Injectable({
  providedIn: 'root'
})
export class ProtectedRouteGuard implements CanActivate {

  constructor(
    private router: Router,
    private toastService: ToastService // ✅ Inject ToastService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
  const token = localStorage.getItem('access_token');
  const role = localStorage.getItem('role');
  const url = state.url;

  // ❌ No token → block and show toast
  if (!token) {
    this.toastService.show('אנא התחבר כדי לגשת לעמוד זה', 'error');
    this.router.navigate(['/login']);
    return false;
  }

  // ✅ Allow access to /home
  if (url.includes('/home')) {
    return true;
  }

  // ✅ Admin-only routes
  if ((url.includes('/cars') || url.includes('/daily-checks')) && role !== 'admin') {
    this.toastService.show('העמוד מיועד למנהלים בלבד', 'error');
    this.router.navigate(['/home']);
    return false;
  }

  // ✅ Allow admin/supervisor to access dashboards
  if (['admin', 'supervisor'].includes(role || '')) {
    return true;
  }

  // ✅ Allow access to new-ride and notifications
  if (url.includes('/new-ride') || url.includes('/notifications')) {
    return true;
  }

  // ❌ All other cases → block
  this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
  this.router.navigate(['/login']);
  return false;
}

}
