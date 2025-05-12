import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  fullName: string = '';

constructor(private authService: AuthService, private router: Router) {}

onLogout(): void {
  this.authService.logout();
  this.router.navigate(['/login']); 
}

  ngOnInit(): void {
    // Get the full name directly from the AuthService
    this.fullName = this.authService.getUserFullName();
  }
}
