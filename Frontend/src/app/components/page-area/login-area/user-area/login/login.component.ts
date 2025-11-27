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
import { environment } from '../../../../../../environments/environment';
import { MyRidesService } from '../../../../../services/myrides.service';

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
    private toastService: ToastService,
    private myRidesService:MyRidesService
  ) {}
  showPassword = false;

 
  
  
  ngOnInit(): void {
  this.loginForm = this.fb.group({
    username: [''],
    password: ['']
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

  const { username, password } = this.loginForm.value;


  if (!username && !password) {
    this.toastService.show('יש להזין שם משתמש וסיסמה', 'error');
    return;
  }

  if (!username) {
    this.toastService.show('יש להזין שם משתמש', 'error');
    return;
  }

  if (!password) {
    this.toastService.show('יש להזין סיסמה', 'error');
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
        } else {
            this.myRidesService.checkPendingRebook().subscribe({
              next: (res) => {
                if (res.has_pending) {
                  this.router.navigate(['/all-rides']);
                }
                else{
                  this.router.navigate(['/home']);
                }
              },
              error: (err) => console.error(err)
            });
          
        }
      } else {
        this.toastService.show('שגיאה בעיבוד פרטי ההתחברות', 'error');
      }
    },
    error: (err) => {
      console.error('Login failed:', err);

      if (err.status === 400 || err.status === 401) {
        this.toastService.show('שם משתמש וסיסמה לא נכונים. אנא נסה שוב', 'error');
      } else {
        this.toastService.show('אירעה שגיאה בהתחברות. אנא נסה שוב מאוחר יותר', 'error');
      }
    }
  });
}


}
