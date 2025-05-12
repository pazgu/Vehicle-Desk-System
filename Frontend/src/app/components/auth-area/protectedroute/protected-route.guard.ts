import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class ProtectedRouteGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('role');
    
    // Allow access to specific routes (like notifications and new orders)
    const isNotificationRoute = state.url.includes('/notifications');
    const isNewOrderRoute = state.url.includes('/new-ride');
    
    if (token && (isNotificationRoute || isNewOrderRoute || role === 'admin' || role === 'supervisor')) {
      return true;
    }

    // If the user does not have a valid token or required role, redirect to login
    alert('אין לך הרשאה לגשת לדף זה'); // You don't have permission to access this page
    this.router.navigate(['/login']);
    return false;
  }
}
