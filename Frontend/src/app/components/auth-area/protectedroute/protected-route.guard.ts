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
  if ((url.includes('/vehicle-dashboard') || url.includes('/audit-logs')) && role !== 'admin') {
    this.toastService.show('העמוד מיועד למנהלים בלבד', 'error');
    this.router.navigate(['/home']);
    return false;
  }

  // ✅ Allow access to notifications for all roles
  if (url.includes('/notifications')) {
    return true;
  }

  // ❌ Block supervisors and inspectors from /new-ride
  if (url.includes('/new-ride')) {
    if (role === 'supervisor') {
      this.toastService.show('אין לך הרשאה להזמין נסיעה', 'error');
      this.router.navigate(['/supervisor-dashboard']);
      return false;
    }
    if (role === 'inspector') {
      this.toastService.show('בודק רכב אינו יכול להזמין נסיעה', 'error');
      this.router.navigate(['/inspector/inspection']);
      return false;
    }
    return true; // allow employee
  }

  // ❌ Block supervisors and inspectors from /home
  if (url.includes('/home')) {
    if (role === 'supervisor') {
      this.toastService.show('אין לך הזמנות אישיות', 'error');
      this.router.navigate(['/supervisor-dashboard']);
      return false;
    }
    if (role === 'inspector') {
      this.toastService.show('עמוד זה אינו רלוונטי לבודק רכב', 'error');
      this.router.navigate(['/inspector/vehicles']);
      return false;
    }
    return true; // allow others
  }

  // ✅ Allow employees to edit their rides
  if (url.startsWith('/ride/edit') && role === 'employee') {
    return true;
  }

  // ✅ Allow admin/supervisor to access their dashboards
  if (['admin', 'supervisor'].includes(role || '')) {
    return true;
  }

  // ✅ Allow inspector to access their pages
if (role === 'inspector' && (url.startsWith('/inspector/inspection') || url.startsWith('/inspector/vehicles'))) {
  return true;
}


  // ❌ All other cases → block access
  console.log('❌ Blocked by ProtectedRouteGuard - Unknown route or role mismatch');
  this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
  this.router.navigate(['/home']);
  return false;
}


  
}
