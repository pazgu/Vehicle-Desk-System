import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
import { ToastService } from '../../../../../services/toast.service';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { LoginService } from '../../../../../services/login.service';

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
    private loginService: LoginService,
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

  this.loginForm.markAllAsTouched();

  if (this.loginForm.invalid) {
    this.toastService.show('יש למלא את כל השדות כנדרש', 'error');
    return;
  }

  const loginData = this.loginForm.value;
  this.loginService.login(loginData).subscribe({
    next: (response) => {
 const token = response.access_token;
localStorage.setItem('access_token', token);

const tokenParts = token.split('.');
if (tokenParts.length === 3) {
  const payload = JSON.parse(atob(tokenParts[1]));
  localStorage.setItem('user_id', payload.user_id);
  localStorage.setItem('employee_id', payload.sub);
  localStorage.setItem('username', payload.username);
  localStorage.setItem('first_name', payload.first_name);
  localStorage.setItem('last_name', payload.last_name);
  localStorage.setItem('role', payload.role);
  localStorage.setItem('department_id', payload.department_id);

  this.authService.setFullName(payload.first_name, payload.last_name);
  this.authService.setLoginState(true);
  this.authService.setRole(payload.role);

  const role = payload.role;

  if (role === 'admin') {
    this.router.navigate(['/admin/critical-issues']);
  } else if (role === 'supervisor') {
    this.router.navigate(['/supervisor-dashboard']);
 } else if (role === 'inspector') {
  this.router.navigate(['/inspector/inspection']);
}
 else {
    this.router.navigate(['/home']);
  }
} else {
  this.toastService.show('שגיאה בעיבוד פרטי ההתחברות', 'error');
}


    },
    error: (err) => {
      console.error('Login failed:', err);
    }
  });
}

}
