import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  errorMessage: string | null = null;
  departments: any[] = [];

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[A-Za-zא-ת]+$/)]],
      last_name: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[A-Za-zא-ת]+$/)]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[A-Za-zא-ת]+$/)]],
      email: ['', [Validators.required, Validators.email, Validators.pattern(/@gmail\.com$/)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Z])(?=.*\d).+$/)]],
      department_id: ['', Validators.required]
  });

    this.fetchDepartments();
  }

  fetchDepartments(): void {
    this.http.get<any[]>('http://localhost:8000/api/departments').subscribe({
      next: (data) => {
        this.departments = data;
      },
      error: (err) => {
        console.error('Failed to fetch departments', err);
        this.departments = []; // fallback to empty
      }
    });
  }

  get f() {
    return this.registerForm.controls;
  }

  register(): void {
    this.errorMessage = null;

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.errorMessage = 'יש למלא את כל השדות כנדרש ולוודא תקינות';
      return;
    }

    const registerData = {
      ...this.registerForm.value,
      role: 'employee'
    };

    this.authService.register(registerData).subscribe({
      next: (response) => {
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('username', response.username);
        localStorage.setItem('role', response.role);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        console.error('Registration failed:', err);
        alert('אירעה שגיאה. נסה שוב.');
      }
    });
  }
}
