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

    if (url.includes('order-card') && role != 'supervisor') {
      this.router.navigate(['/home']);
      return false;
    }
    if (url.includes('user-card') && role != 'admin') {
      this.toastService.show('העמוד מיועד למנהלים בלבד', 'error');

      this.router.navigate(['/home']);
      if (role == 'employee') {
        this.router.navigate(['/home']);
        return false;
      }
      if (role == 'supervisor') {
        this.router.navigate(['/supervisor-dashboard']);
        return false;
      }
      if (role == 'inspector') {
        this.router.navigate(['/inspector/inspection']);
        return false;
      }
      return false;
    }

    if (url.includes('vehicle-details') && role != 'admin') {
      this.toastService.show('העמוד מיועד למנהלים בלבד', 'error');

      this.router.navigate(['/home']);
      if (role == 'employee') {
        this.router.navigate(['/home']);
        return false;
      }
      if (role == 'supervisor') {
        this.router.navigate(['/supervisor-dashboard']);
        return false;
      }
      if (role == 'inspector') {
        this.router.navigate(['/inspector/inspection']);
        return false;
      }
      return false;
    }

    if (url.includes('archived-vehicles') && role != 'admin') {
      this.toastService.show('העמוד מיועד למנהלים בלבד', 'error');

      this.router.navigate(['/home']);
      if (role == 'employee') {
        this.router.navigate(['/home']);
        return false;
      }
      if (role == 'supervisor') {
        this.router.navigate(['/supervisor-dashboard']);
        return false;
      }
      if (role == 'inspector') {
        this.router.navigate(['/inspector/inspection']);
        return false;
      }
      return false;
    }

    if (
      url.includes('ride/details') &&
      role != 'employee' &&
      role != 'supervisor'
    ) {
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

    if (url.includes('ride-completion-form') && role != 'employee'&& role != 'supervisor') {
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
      (url.includes('/vehicle-dashboard') ||
        url.includes('/audit-logs') ||
        url.includes('/critical-issues') ||
        url.includes('/user-data') ||
        url.includes('/department-data') ||
        url.includes('/add-new-user') ||
        url.includes('admin/analytics')) &&
      role !== 'admin'
    ) {
      this.router.navigate(['/home']);
      return false;
    }

    if (url.includes('/home') || url.includes('/all-rides')) {
      if (role === 'admin') {
        this.toastService.show('עמוד זה אינו רלוונטי לאדמין', 'error');
        this.router.navigate(['/admin/critical-issues']);
        return false;
      }
      if (role == 'inspector') {
        this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
        this.router.navigate(['/inspector/inspection']);
        return false;
      }
      return true;
    }

    if (url.includes('/notifications')) {
      return true;
    }

    if (url.includes('supervisor-dashboard') && role != 'supervisor') {
      this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
      if (role == 'supervisor') {
        this.router.navigate(['/supervisor-dashboard']);
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

    if (url.includes('/inspector/inspection') && role != 'inspector') {
      this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
      if (role == 'employee') {
        this.router.navigate(['/home']);
        return false;
      }
      if (role == 'supervisor') {
        this.router.navigate(['/supervisor-dashboard']);
        return false;
      }
      if (role == 'admin') {
        this.router.navigate(['/admin/critical-issues']);
        return false;
      }
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

    if (
      role != 'inspector' &&
      (url.startsWith('/inspector/inspection') ||
        url.startsWith('/inspector/vehicles'))
    ) {
      return false;
    }

    return true;
  }
}
