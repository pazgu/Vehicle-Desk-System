import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [RouterModule,FormsModule,CommonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
   

  registerData = {
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    department_id: '',
    role: 'employee' // default role
  };
  departments: any[] = [];

  constructor(private authService: AuthService, private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.fetchDepartments();
  }

  fetchDepartments() {
    this.http.get<any[]>('http://localhost:8000/api/departments') // adjust backend URL if needed
      .subscribe({
        next: data => this.departments = data,
        error: err => console.error('Failed to fetch departments', err)
      });
  }
  register() {
    this.authService.register(this.registerData).subscribe({
      next: response => {
        console.log('Registered and logged in:', response);
        const token = response.access_token; 
        localStorage.setItem('access_token', token);
        localStorage.setItem('username', response.username);
        localStorage.setItem('role', response.role);
        this.router.navigate(['/home']);
      },
      error: err => {
        console.error('Registration failed:', err);
        alert('Registration error. Check the form or try again.');
      }
    });
  }
  
}  