import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
import { ToastService } from '../../../../../services/toast.service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DepartmentService } from '../../../../../services/department_service';
import * as validator from 'validator';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    CommonModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  errorMessage: string | null = null;
  departments: any[] = [];

  constructor(
    private fb: FormBuilder,
    private departmentService: DepartmentService,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {}
  showPassword = false;

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      first_name: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-zא-ת]+$/),
          this.noForeignLanguages.bind(this),
          this.noMixedLanguageValidator(),
        ],
      ],
      last_name: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[A-Za-zא-ת]+$/),
          this.noForeignLanguages.bind(this),
          this.noMixedLanguageValidator(),
        ],
      ],
      username: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.pattern(/^[A-Za-zא-ת0-9]+$/), // Allow letters and numbers
          this.noMixedLanguageValidator(),
          this.minLettersValidator(2), // At least 2 letters required
          this.noForeignLanguages.bind(this),
        ],
      ],
      email: [
        '',
        [
          Validators.required,
          // Validators.email,
          this.noForeignLanguages.bind(this),
          this.emailValidator(),
        ],
      ],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[A-Z])(?=.*\d).+$/),
          this.noForeignLanguages.bind(this),
        ],
      ],
      department_id: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern(/^05\d{8}$/)]],
    });

    this.fetchDepartments();
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  preventSpaces(event: KeyboardEvent): void {
    if (event.key === ' ') {
      event.preventDefault();
    }
  }

  emailValidator() {
    return (control: any) => {
      if (!control.value) return null;

      if (validator.isEmail(control.value)) {
        return null;
      }

      return { invalidEmail: true };
    };
  }

  minLettersValidator(minLetters: number) {
    return (control: any) => {
      if (!control.value) return null;

      const letterCount = (control.value.match(/[A-Za-zא-ת]/g) || []).length;

      if (letterCount < minLetters) {
        return { minLetters: true };
      }

      return null;
    };
  }

  noMixedLanguageValidator() {
    return (control: any) => {
      if (!control.value) return null;

      const hasHebrew = /[א-ת]/.test(control.value);
      const hasEnglish = /[A-Za-z]/.test(control.value);

      if (hasHebrew && hasEnglish) {
        return { mixedLanguage: true };
      }

      return null;
    };
  }

  noForeignLanguages(control: any) {
    if (!control.value) {
      return null;
    }
    const foreignChars =
      /[^\x00-\x7Fא-ת\s\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
    return foreignChars.test(control.value) ? { foreignLanguage: true } : null;
  }

  fetchDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: (data) => {
        this.departments = data.filter(
          (dept: any) => dept.name !== 'Unassigned' && dept.name !== 'לא משויך'
        );
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת מחלקות', 'error');
        this.departments = [];
      },
    });
  }

  get f() {
    return this.registerForm.controls;
  }

  getPasswordErrors(): string | null {
    const passwordControl = this.registerForm.get('password');
    if (!passwordControl || !passwordControl.value) {
      return null;
    }

    const errors: string[] = [];

    if (passwordControl.errors?.['minlength']) {
      errors.push('לפחות 8 תווים');
    }

    if (passwordControl.errors?.['pattern']) {
      const value = passwordControl.value || '';
      const hasUpperCase = /[A-Z]/.test(value);
      const hasNumber = /\d/.test(value);

      if (!hasUpperCase && !hasNumber) {
        errors.push('חובה לכלול אות גדולה ומספר');
      } else if (!hasUpperCase) {
        errors.push('חובה לכלול אות גדולה');
      } else if (!hasNumber) {
        errors.push('חובה לכלול מספר');
      }
    }

    return errors.length > 0 ? errors.join(' | ') : null;
  }

  getPhoneErrors(): string | null {
    const phoneControl = this.registerForm.get('phone');
    if (!phoneControl || !phoneControl.value) {
      return null;
    }
    

    const errors: string[] = [];
    const value = phoneControl.value || '';

    const startsWithCorrect = value.startsWith('05');

    const hasCorrectLength = value.length === 10;

    const onlyDigits = /^\d+$/.test(value);

    if (!startsWithCorrect && !hasCorrectLength) {
      return 'מספר טלפון חייב להכיל 10 ספרות ולהתחיל ב-05';
    }

    if (!startsWithCorrect) {
      errors.push('מספר טלפון חייב להתחיל ב-05');
    }

    if (!hasCorrectLength) {
      errors.push('מספר טלפון חייב להכיל 10 ספרות');
    }

    if (!onlyDigits && value.length > 0) {
      errors.push('מספר טלפון חייב להכיל ספרות בלבד');
    }

    return errors.length > 0 ? errors.join(' | ') : null;
  }
 getUsernameErrors(): string | null {
    const usernameControl = this.registerForm.get('username');
    if (!usernameControl || !usernameControl.value) {
      return null;
    }

    const errors: string[] = [];

    if (usernameControl.errors?.['minlength']) {
      errors.push('לפחות 3 תווים');
    }

    if (usernameControl.errors?.['pattern']) {
      errors.push('רק אותיות בעברית, אנגלית או מספרים');
    }

    if (usernameControl.errors?.['mixedLanguage']) {
      errors.push('לא ניתן לערבב עברית ואנגלית');
    }

    if (usernameControl.errors?.['minLetters']) {
      errors.push(' לפחות 2 אותיות');
    }

    return errors.length > 0 ? errors.join(' | ') : null;
  }

  register(): void {
    this.errorMessage = null;

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();

      let invalidFieldsCount = 0;
      Object.keys(this.registerForm.controls).forEach((key) => {
        if (this.registerForm.get(key)?.invalid) {
          invalidFieldsCount++;
        }
      });

      if (invalidFieldsCount > 1) {
        this.toastService.show(
          'יש למלא את כל השדות כנדרש ולוודא תקינות',
          'error'
        );
        return;
      }

      this.toastService.show(
        'יש למלא את כל השדות כנדרש ולוודא תקינות',
        'error'
      );
      return;
    }

    const registerData = {
      ...this.registerForm.value,
      role: 'employee',
    };

    this.authService.register(registerData).subscribe({
      next: (response) => {
        if (!response || !response.access_token) {
          this.toastService.show(
            'שגיאה בלתי צפויה - נסה שוב מאוחר יותר',
            'error'
          );
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

        this.toastService.show('ההרשמה בוצעה בהצלחה', 'success');

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
        if (err.status === 0) {
          this.toastService.show(
            'השרת אינו זמין כרגע. נסה שוב מאוחר יותר',
            'error'
          );
        } else if (err.status === 400 || err.status === 422) {
          const details = err.error?.detail;

          if (Array.isArray(details)) {
            const emailError = details.find(
              (d) =>
                typeof d.msg === 'string' &&
                d.msg.toLowerCase().includes('valid email')
            );
            if (emailError) {
              this.toastService.show(
                'כתובת האימייל שגויה. אנא הזן כתובת תקינה (למשל name@example.com)',
                'error'
              );
              return;
            }

            const phoneError = details.find(
              (d) =>
                typeof d.msg === 'string' &&
                d.msg.toLowerCase().includes('number')
            );
            if (phoneError) {
              this.toastService.show(
                'מספר הטלפון שהוזן אינו תקין. אנא בדוק ונסה שוב',
                'error'
              );
              return;
            }
          } else if (typeof details === 'string') {
            if (details.includes('already exists')) {
              this.toastService.show(
                'שם המשתמש, מייל או מספר טלפון כבר קיימים במערכת',
                'error'
              );
              return;
            } else if (details.includes('Invalid email')) {
              this.toastService.show(
                'כתובת האימייל שגויה. אנא הזן כתובת תקינה (למשל name@example.com)',
                'error'
              );
              return;
            } else if (details.includes('number')) {
              this.toastService.show(
                'מספר הטלפון שהוזן אינו תקין. אנא בדוק ונסה שוב',
                'error'
              );
              return;
            }
          }

          this.toastService.show(
            'שגיאה בפרטי ההרשמה. אנא בדוק את הקלט ונסה שוב',
            'error'
          );
        } else {
          const errorText = 'שגיאה כללית בהרשמה';
          this.toastService.show(errorText, 'error');
        }
      },
    });
  }
}
