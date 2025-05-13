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

    if (role === 'admin') {
      this.router.navigate(['/daily-checks']);
    } else if (role === 'supervisor') {
      this.router.navigate(['/supervisor-dashboard']);
    } else {
      this.router.navigate(['/home']);
    }
  }
}
