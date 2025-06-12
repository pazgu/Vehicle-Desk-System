import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-redirect-by-role',
  template: ''
})
export class RedirectByRoleComponent implements OnInit {

  constructor(private router: Router) {}

  ngOnInit(): void {
    const role = localStorage.getItem('role');
     console.log('RedirectByRoleComponent loaded. Role:', role); // 👈 Add this
    if (!role) {
      // No role found in localStorage, redirect to login page
      this.router.navigate(['/login']);
    } else if (role === 'admin') {
      this.router.navigate(['/admin/analytics']);
    } else if (role === 'supervisor') {
      this.router.navigate(['/supervisor-dashboard']);
    } else if (role === 'inspector') {
    this.router.navigate(['/inspector/vehicles']); // ✅ FIXED HERE
  } else {
      this.router.navigate(['/home']);
    }
  }
}
