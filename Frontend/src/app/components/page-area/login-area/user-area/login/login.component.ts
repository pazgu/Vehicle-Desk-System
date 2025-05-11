import { Component } from '@angular/core';
import { LayoutComponent } from '../../../../layout-area/layout/layout.component';
import { HeaderComponent } from '../../../../layout-area/header/header.component';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [RouterModule,FormsModule,CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username: string = '';
  password: string = '';
  errorMessage: string | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  onLogin(): void {
    const loginData = {
      username: this.username,
      password: this.password
    };

    this.http.post<any>('http://localhost:8000/api/login', loginData).subscribe({
      next: (response) => {
        const token = response.access_token; 
        localStorage.setItem('access_token', token);  // adjust key as needed
        this.router.navigate(['/home']);  // change route as needed
      },
      error: (err) => {
        this.errorMessage = err.error?.detail || 'Login failed';
      }
    });
  }
}

