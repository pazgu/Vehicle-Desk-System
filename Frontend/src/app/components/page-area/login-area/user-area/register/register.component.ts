import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
import { ToastService } from '../../../../../services/toast.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule, MatButtonModule,
    MatIconModule,],
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
    private toastService: ToastService,
    private router: Router
  ) { }
  showPassword = false;


  ngOnInit(): void {
    this.registerForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[A-Za-zא-ת]+$/)]],
      last_name: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[A-Za-zא-ת]+$/)]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[A-Za-zא-ת]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Z])(?=.*\d).+$/)]],
      department_id: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]]
    });

    this.fetchDepartments();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  fetchDepartments(): void {
    this.http.get<any[]>('http://localhost:8000/api/departments').subscribe({
      next: (data) => {
        this.departments = data;
      },
      error: (err) => {
        console.error('Failed to fetch departments', err);
        this.toastService.show('שגיאה בטעינת מחלקות', 'error');
        this.departments = [];

      }
    });
  }

  get f() {
    return this.registerForm.controls;
  }

register(): void {
  console.log('Register function called!');
  console.log('Form valid:', this.registerForm.valid);
  console.log('Form errors:', this.registerForm.errors);
  this.errorMessage = null;

  if (this.registerForm.invalid) {
    this.registerForm.markAllAsTouched();
    // Check for phone pattern error specifically
    const phoneControl = this.registerForm.get('phone');
    if (phoneControl?.errors?.['pattern']) {
      this.toastService.show('מספר הטלפון שהוזן אינו תקין. אנא בדוק ונסה שוב', 'error');
      return;
    }
    
    // Check for email format error
    const emailControl = this.registerForm.get('email');
    if (emailControl?.errors?.['email']) {
      this.toastService.show('כתובת האימייל שגויה. אנא הזן כתובת תקינה (למשל name@example.com)', 'error');
      return;
    }
    
    console.log('About to show toast');
    this.toastService.show('יש למלא את כל השדות כנדרש ולוודא תקינות', 'error');
    return;
  }

  const registerData = {
    ...this.registerForm.value,
    role: 'employee'
  };

  this.authService.register(registerData).subscribe({
    next: (response) => {
      if (!response || !response.access_token) {
        this.toastService.show('שגיאה בלתי צפויה - נסה שוב מאוחר יותר', 'error');
        return;
      }

      localStorage.clear();
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('username', response.username);
      localStorage.setItem('first_name', response.first_name);
      localStorage.setItem('last_name', response.last_name);
      localStorage.setItem('employee_id', response.employee_id);
      localStorage.setItem('role', response.role);
      localStorage.setItem('department_id', response.department_id);
      localStorage.setItem('phone', response.phone);

      this.authService.setFullName(response.first_name, response.last_name);
      this.authService.setLoginState(true);
      this.authService.setRole(response.role);

      this.toastService.show('ההרשמה בוצעה בהצלחה 🎉', 'success');

      // ✅ Redirect based on role
      const role = response.role;
      if (role === 'admin') {
        this.router.navigate(['/audit-logs']);
      } else if (role === 'supervisor') {
        this.router.navigate(['/supervisor-dashboard']);
      } else if (role === 'inspector') {
        this.router.navigate(['/inspector/vehicles']);
      } else {
        this.router.navigate(['/home']);
      }
    },

    error: (err) => {
      console.error('Registration failed:', err);

      if (err.status === 0) {
        this.toastService.show('השרת אינו זמין כרגע. נסה שוב מאוחר יותר', 'error');

      } else if (err.status === 400 || err.status === 422) {
        const details = err.error?.detail;

        if (Array.isArray(details)) {
          // Handle FastAPI validation errors (array of objects)
          const emailError = details.find(d =>
            typeof d.msg === 'string' && d.msg.toLowerCase().includes('valid email')
          );
          if (emailError) {
            this.toastService.show('כתובת האימייל שגויה. אנא הזן כתובת תקינה (למשל name@example.com)', 'error');
            return;
          }

          const phoneError = details.find(d =>
            typeof d.msg === 'string' && d.msg.toLowerCase().includes('number')
          );
          if (phoneError) {
            this.toastService.show('מספר הטלפון שהוזן אינו תקין. אנא בדוק ונסה שוב', 'error');
            return;
          }

        } else if (typeof details === 'string') {
          // Handle string-based error messages
          if (details.includes('already exists')) {
            this.toastService.show('שם המשתמש או האימייל כבר קיימים במערכת', 'error');
            return;
          } else if (details.includes('Invalid email')) {
            this.toastService.show('כתובת האימייל שגויה. אנא הזן כתובת תקינה (למשל name@example.com)', 'error');
            return;
          } else if (details.includes('number')) {
            this.toastService.show('מספר הטלפון שהוזן אינו תקין. אנא בדוק ונסה שוב', 'error');
            return;
          }
        }

        // Fallback if no specific error was matched
        this.toastService.show('שגיאה בפרטי ההרשמה. אנא בדוק את הקלט ונסה שוב', 'error');

      } else {
        const errorText = err.error?.detail || 'שגיאה כללית בהרשמה';
        this.toastService.show(errorText, 'error');
      }
    }
  });
}
}
