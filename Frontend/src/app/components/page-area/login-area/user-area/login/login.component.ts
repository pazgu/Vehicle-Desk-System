import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
import { environment } from '../../../../../../environments/environment';
import { ToastService } from '../../../../../services/toast.service';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule,MatButtonModule,
    MatIconModule,MatFormFieldModule,MatInputModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  formSubmitted = false;
  loginForm!: FormGroup;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private authService: AuthService,
    private toastService: ToastService
  ) {}
  showPassword = false;

 
  
  
  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[A-Za-z֐-׿]+$/), // Hebrew + English letters
          Validators.minLength(3),
          Validators.maxLength(20)
        ]
      ],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(6)
        ]
      ]
    });
  }
  togglePassword() {
    this.showPassword = !this.showPassword;
  }
  get f() {
    return this.loginForm.controls;
  }

onLogin(): void {
  this.formSubmitted = true;
  this.errorMessage = null;

  // ✅ Trigger form validation first
  this.loginForm.markAllAsTouched();

  // ✅ Show toast if form is invalid
  if (this.loginForm.invalid) {
    this.toastService.show('יש למלא את כל השדות כנדרש', 'error');
    return;
  }

  const loginData = this.loginForm.value;
  const loginUrl = environment.loginUrl;
  this.http.post<any>(loginUrl, loginData).subscribe({
    next: (response) => {
      const token = response.access_token;
      localStorage.setItem('access_token', token);
      localStorage.setItem('username', response.username);
      localStorage.setItem('first_name', response.first_name);
      localStorage.setItem('last_name', response.last_name);
      localStorage.setItem('employee_id', response.employee_id);
      localStorage.setItem('role', response.role);
      localStorage.setItem('department_id', response.department_id);
      
            // Update AuthService state
      this.authService.setFullName(response.first_name, response.last_name);
      this.authService.setLoginState(true);
      this.authService.setRole(response.role);

      const role = response.role;
      if (role === 'admin') {
        this.router.navigate(['/daily-checks']);
      } else if (role === 'supervisor') {
        this.router.navigate(['/supervisor-dashboard']);
      } else {
        this.router.navigate(['/home']);
      }
    },
    error: (err) => {
      console.error('Login failed:', err);
      this.toastService.show('שם משתמש או סיסמה שגויים', 'error');
    }
  });
}

}
