import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../../../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      username: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[A-Za-z֐-׿]+$/),
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



  get f() {
    return this.loginForm.controls;
  }

  onLogin(): void {
    this.errorMessage = null;

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.toastService.show('יש למלא את כל השדות כנדרש', 'error');
      return;
    }

    const loginData = this.loginForm.value;

    this.http.post<any>('http://localhost:8000/api/login', loginData).subscribe({
      next: (response) => {
        if (!response || !response.access_token) {
          this.toastService.show('שגיאה לא צפויה - נסה שוב מאוחר יותר', 'error');
          return;
        }

        const token = response.access_token;
        localStorage.setItem('access_token', token);
        localStorage.setItem('username', response.username);
        localStorage.setItem('role', response.role);
        this.toastService.show('התחברת בהצלחה 🎉', 'success');
        this.router.navigate(['/home']);
      },
      error: (err) => {
        if (err.status === 0) {
          this.toastService.show('שרת לא זמין כרגע. נסה שוב מאוחר יותר', 'error');
        } else if (err.status === 401) {
          if (err.error?.detail?.includes('not found')) {
            this.toastService.show('שם המשתמש לא קיים במערכת', 'error');
          } else if (err.error?.detail?.includes('incorrect')) {
            this.toastService.show('הסיסמה שגויה', 'error');
          } else {
            this.toastService.show('התחברות נכשלה - בדוק את הפרטים', 'error');
          }
        } else {
          this.toastService.show('שגיאת התחברות כללית', 'error');
        }
      }
    });
  }
}
