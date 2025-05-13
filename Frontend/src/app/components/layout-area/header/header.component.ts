import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { Observable, of } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  fullName$: Observable<string> = of('');
  isLoggedIn = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastService: ToastService // ✅ Add this
  ) {}

  ngOnInit(): void {
    this.fullName$ = this.authService.fullName$;

    // ✅ Subscribe to login status
    this.authService.isLoggedIn$.subscribe(value => {
      this.isLoggedIn = value;
    });
  }

  onLogout(): void {
    this.authService.logout();
    this.toastService.show('התנתקת בהצלחה', 'success'); // ✅ Show toast
    this.router.navigate(['/login']);
  }
}
