import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class ProtectedRouteGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('role');

    if (token && (role === 'admin' || role === 'supervisor')) {
      return true;
    }

    alert('אין לך הרשאה לגשת לדף זה');
    this.router.navigate(['/login']);
    return false;
  }
}
