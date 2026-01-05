import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { ToastService } from '../../../services/toast.service';

@Injectable({
  providedIn: 'root',
})
export class ProtectedRouteGuard implements CanActivate {
  constructor(private router: Router, private toastService: ToastService) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('role');
    const url = state.url;

    if (!token) {
      this.toastService.show('אנא התחבר כדי לגשת לעמוד זה', 'error');
      this.router.navigate(['/login']);
      return false;
    }

    if (url.includes('order-card') && role !== 'supervisor') {
      this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
      if (role === 'employee') {
        this.router.navigate(['/home']);
      } else if (role === 'admin') {
        this.router.navigate(['/admin/critical-issues']);
      } else if (role === 'inspector') {
        this.router.navigate(['/inspector/inspection']);
      }
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
    ];

    if (
      adminOnlyRoutes.some((route) => url.includes(route)) &&
      role !== 'admin'
    ) {
      this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
      if (role === 'employee') {
        this.router.navigate(['/home']);
      } else if (role === 'supervisor') {
        this.router.navigate(['/supervisor-dashboard']);
      } else if (role === 'inspector') {
        this.router.navigate(['/inspector/inspection']);
      }
      return false;
    }

    if (
      url.includes('ride/details') &&
      role != 'employee' &&
      role != 'supervisor'
    ) {
      this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
      if (role == 'admin') {
        this.router.navigate(['/admin/critical-issues']);
        return false;
      }
      if (role == 'inspector') {
        this.router.navigate(['/inspector/inspection']);
        return false;
      }
      return false;
    }

    if (
      url.includes('ride-completion-form') &&
      role != 'employee' &&
      role != 'supervisor'
    ) {
      this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
      if (role == 'admin') {
        this.router.navigate(['/admin/critical-issues']);
        return false;
      }
      if (role == 'inspector') {
        this.router.navigate(['/inspector/inspection']);
        return false;
      }
      return false;
    }

    if (
      (url.includes('/home') || url.includes('/all-rides')) &&
      role !== 'employee' &&
      role !== 'supervisor'
    ) {
      this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
      if (role === 'admin') {
        this.router.navigate(['/admin/critical-issues']);
      } else if (role === 'inspector') {
        this.router.navigate(['/inspector/inspection']);
      }
      return false;
    }

    if (url.includes('/notifications')) {
      return true;
    }

    if (url.includes('supervisor-dashboard') && role != 'supervisor') {
      this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
      if (role == 'admin') {
        this.router.navigate(['/admin/critical-issues']);
        return false;
      }
      if (role == 'inspector') {
        this.router.navigate(['/inspector/inspection']);
        return false;
      }
      if (role == 'employee') {
        this.router.navigate(['/home']);
        return false;
      }
      return false;
    }

    if (url.startsWith('/ride/edit')) {
      if (role != 'employee' && role != 'supervisor') {
        this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
        if (role == 'admin') {
          this.router.navigate(['/admin/critical-issues']);
          return false;
        }
        if (role == 'inspector') {
          this.router.navigate(['/inspector/inspection']);
          return false;
        }
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
      this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
      if (role === 'employee') {
        this.router.navigate(['/home']);
      } else if (role === 'supervisor') {
        this.router.navigate(['/supervisor-dashboard']);
      } else if (role === 'admin') {
        this.router.navigate(['/admin/critical-issues']);
      }
      return false;
    }

    return true;
  }
}
