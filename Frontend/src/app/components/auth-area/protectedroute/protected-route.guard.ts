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

    console.log('🧾 Route Guard Check:');
    console.log('🔑 Token:', token);
    console.log('👤 Role:', role);
    console.log('🧭 URL:', url);

    // ❌ No token → block and show toast
    if (!token) {
      this.toastService.show('אנא התחבר כדי לגשת לעמוד זה', 'error');
      this.router.navigate(['/login']);
      return false;
    }

    // ✅ Admin-only routes
    if ((url.includes('/cars') || url.includes('/daily-checks')) && role !== 'admin') {
      this.toastService.show('העמוד מיועד למנהלים בלבד', 'error');
      this.router.navigate(['/home']);
      return false;
    }

    // ✅ Allow access to notifications for all roles
    if (url.includes('/notifications')) {
      return true;
    }

    // ❌ Block supervisors from /new-ride
    if (url.includes('/new-ride')) {
      if (role === 'supervisor') {
        this.toastService.show('אין לך הרשאה להזמין נסיעה', 'error');
        this.router.navigate(['/supervisor-dashboard']);
        return false;
      }
      return true;
    }

    // ❌ Block supervisors from /home, allow others
    if (url.includes('/home')) {
      if (role === 'supervisor') {
        this.toastService.show('אין לך הזמנות אישיות', 'error');
        this.router.navigate(['/supervisor-dashboard']);
        return false;
      }
      return true; // allow others
    }

     // ✅ ✅ ✅ NEW: Allow employees to access ride edit
  if (url.startsWith('/ride/edit') && role === 'employee') {
    return true;
  }

    // ✅ Allow admin/supervisor to access dashboards and other permitted routes
  if (['admin', 'supervisor'].includes(role || '')) {
    return true;
  }

    console.log('❌ Blocked by ProtectedRouteGuard - Unknown route or role mismatch');


    // ✅ Allow admin/supervisor to access dashboards and other permitted routes
    if (['admin', 'supervisor'].includes(role || '')) {
      return true;
    }

    // ❌ All other cases → block access
    this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
    this.router.navigate(['/home']);
    return false;
  }

  
}
