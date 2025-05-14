import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
import { ToastService } from '../../../../../services/toast.service';

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
    private toastService: ToastService,
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
        this.toastService.show('שגיאה בטעינת מחלקות', 'error');
        this.departments = [];

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

      // Save user info
      localStorage.setItem('access_token', response.access_token);
      localStorage.setItem('username', response.username);
      localStorage.setItem('first_name', response.first_name);
      localStorage.setItem('last_name', response.last_name);
      localStorage.setItem('employee_id', response.employee_id);
      localStorage.setItem('role', response.role);
      localStorage.setItem('department_id', response.department_id);

      this.authService.setFullName(response.first_name, response.last_name);
      this.authService.setLoginState(true);
      this.authService.setRole(response.role);
      this.toastService.show('ההרשמה בוצעה בהצלחה 🎉', 'success');

      // ✅ Redirect based on role
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
      console.error('Registration failed:', err);

      if (err.status === 0) {
        this.toastService.show('השרת אינו זמין כרגע. נסה שוב מאוחר יותר', 'error');
      } else if (err.status === 400) {
        if (err.error?.detail?.includes('already exists')) {
          this.toastService.show('שם המשתמש או האימייל כבר קיימים במערכת', 'error');
        } else if (err.error?.detail?.includes('Invalid email')) {
          this.toastService.show('אימייל לא תקין', 'error');
        } else {
          this.toastService.show('שגיאה בפרטי ההרשמה - בדוק שוב את הקלט', 'error');
        }
      } else {
        const errorText = err.error?.detail || 'שגיאה כללית בהרשמה';
        this.toastService.show(errorText, 'error');
      }
    }
  });
}

}
