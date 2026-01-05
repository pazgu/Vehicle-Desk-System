import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastService } from '../../../../services/toast.service';
import { UserService } from '../../../../services/user_service';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import * as validator from 'validator';
@Component({
  selector: 'app-add-new-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './add-new-user.component.html',
  styleUrls: ['./add-new-user.component.css'],
})
export class AddNewUserComponent implements OnInit {
  addUserForm!: FormGroup;
  roles = [
    { key: 'admin', label: 'מנהל' },
    { key: 'employee', label: 'עובד' },
    { key: 'supervisor', label: 'מפקח' },
    { key: 'inspector', label: 'בודק רכבים' },
    { key: 'raan', label: 'רע"ן' },
  ];
  showPassword = false;

  departments: { id: string; name: string }[] = [];
  selectedFile: File | null = null;
  selectedFileName: string = '';

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private toast: ToastService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 10);
    const maxDateStr = maxDate.toISOString().split('T')[0];

    this.addUserForm = this.fb.group({
      first_name: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[A-Za-zא-ת]+$/),
          Validators.minLength(2),
          this.noMixedLanguageValidator(),
        ],
      ],
      last_name: [
        '',
        [
          Validators.required,
          Validators.pattern(/^[A-Za-zא-ת]+$/),
          Validators.minLength(2),
          this.noMixedLanguageValidator(),
        ],
      ],
      username: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.pattern(/^[A-Za-zא-ת]+$/),
          this.noMixedLanguageValidator(),
        ],
      ],
      email: ['', [Validators.required, this.emailValidator()]],
      phone: ['', [Validators.required, Validators.pattern(/^05\d{8}$/)]],
      role: ['', Validators.required],
      has_government_license: [false],
      department_id: [''],
      license_expiry_date: ['', [this.dateRangeValidator(today, maxDateStr)]],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[A-Z])(?=.*\d)\S*$/),
        ],
      ],
    });

    this.addUserForm.get('role')?.valueChanges.subscribe((role) => {
      this.updateDepartmentValidation(role);
    });

    this.addUserForm.get('role')?.valueChanges.subscribe((role) => {
      this.updateDepartmentValidation(role);
      this.fetchDepartments(role);
    });
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

  getPasswordErrors(): string | null {
    const passwordControl = this.addUserForm.get('password'); 
    if (!passwordControl) {
      return null;
    }

    if (!passwordControl.value && !passwordControl.touched) {
      return null;
    }

    const errors: string[] = [];

    if (passwordControl.errors?.['required'] && passwordControl.touched) {
      errors.push('חובה להזין סיסמה');
    }

    if (passwordControl.value && passwordControl.errors?.['minlength']) {
      errors.push('לפחות 8 תווים');
    }

    if (passwordControl.value && passwordControl.errors?.['pattern']) {
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

    if (passwordControl.value && passwordControl.errors?.['foreignLanguage']) {
      errors.push('הסיסמה מכילה תווים לא חוקיים');
    }

    return errors.length > 0 ? errors.join(' | ') : null;
  }

  getPhoneErrors(): string | null {
    const phoneControl = this.addUserForm.get('phone'); 
    if (!phoneControl) {
      return null;
    }

    if (!phoneControl.value && !phoneControl.touched) {
      return null;
    }

    const errors: string[] = [];
    const value = phoneControl.value || '';

    if (phoneControl.errors?.['required'] && phoneControl.touched) {
      errors.push('חובה להזין מספר טלפון');
    }

    if (value.length > 0) {
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

      if (!onlyDigits) {
        errors.push('מספר טלפון חייב להכיל ספרות בלבד');
      }
    }

    return errors.length > 0 ? errors.join(' | ') : null;
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

  updateDepartmentValidation(role: string): void {
    const departmentControl = this.addUserForm.get('department_id');

    if (role === 'employee') {
      departmentControl?.setValidators([Validators.required]);
    } else if (role === 'supervisor' || role === 'raan') {
      departmentControl?.clearValidators();
    } else {
      departmentControl?.clearValidators();
      departmentControl?.setValue('');
    }

    departmentControl?.updateValueAndValidity();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  submit(): void {
    if (this.addUserForm.invalid) {
      this.addUserForm.markAllAsTouched();
      this.toast.show('אנא מלא את כל השדות הנדרשים', 'error');
      return;
    }

    const formValues = this.addUserForm.value;

    const isRaan = formValues.role?.toLowerCase() === 'raan';

    const processedValues = {
      ...formValues,
      role: isRaan ? 'supervisor' : formValues.role,
      isRaan: isRaan,
    };

    const formData = new FormData();

    for (const key in processedValues) {
      const value = processedValues[key];
      if (value !== null && value !== undefined && value !== '') {
        formData.append(
          key,
          typeof value === 'boolean' ? String(value) : value
        );
      }
    }

    if (this.checkIfHasGovernmentlicense() && this.selectedFile) {
      formData.append('license_file', this.selectedFile);
    }

    this.userService.addNewUser(formData).subscribe({
      next: () => {
        this.toast.show('המשתמש נוסף בהצלחה!', 'success');
        this.addUserForm.reset();
        this.selectedFile = null;
        this.selectedFileName = '';
        this.router.navigate(['/user-data']);
      },
      error: (err) => {
        if (err.status === 0) {
          this.toast.show('השרת אינו זמין כרגע. נסה שוב מאוחר יותר', 'error');
        } else if (err.status === 400 || err.status === 422) {
          const details = err.error?.detail;

          if (typeof details === 'string') {
            const lowerDetails = details.toLowerCase();

            if (
              lowerDetails.includes('already in use') ||
              lowerDetails.includes('already exists') ||
              lowerDetails.includes('exist') ||
              lowerDetails.includes('קיים')
            ) {
              this.toast.show(
                'שם המשתמש, מייל או מספר טלפון כבר קיימים במערכת',
                'error'
              );
              return;
            }
          }

          if (Array.isArray(details)) {
            const existsError = details.find(
              (d) =>
                typeof d.msg === 'string' &&
                (d.msg.toLowerCase().includes('already exists') ||
                  d.msg.toLowerCase().includes('already in use') ||
                  d.msg.toLowerCase().includes('exist'))
            );
            if (existsError) {
              this.toast.show(
                'שם המשתמש, מייל או מספר טלפון כבר קיימים במערכת',
                'error'
              );
              return;
            }
          }

          this.toast.show('שגיאה בהוספת משתמש', 'error');
        } else {
          this.toast.show('שגיאה כללית בהוספת משתמש', 'error');
        }
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input && input.files && input.files.length > 0) {
      const file = input.files[0];
      this.selectedFile = file;
      this.selectedFileName = file.name;
    } else {
      this.selectedFile = null;
      this.selectedFileName = '';
    }
  }

  getHebrewFieldName(field: string): string {
    const map: { [key: string]: string } = {
      first_name: 'שם פרטי',
      last_name: 'שם משפחה',
      username: 'שם משתמש',
      email: 'אימייל',
      phone: 'טלפון',
      role: 'תפקיד',
      department_id: 'מחלקה',
      password: 'סיסמה',
      has_government_license: 'בעל רישיון',
      license_file_url: 'רישיון',
      license_expiry_date: 'תוקף רישיון',
    };
    return map[field] || field;
  }

  fetchDepartments(role: string): void {
    this.userService.getDepartments().subscribe({
      next: (data) => {
        const dbDepartments = data.filter(
          (dep) => dep.name.toLowerCase() !== 'unassigned'
        );

        if (role === 'raan' || role === 'supervisor') {
          this.departments = dbDepartments.filter(
            (dep) => dep.name.toLowerCase() !== 'vip'
          );
        } else {
          const vipExists = dbDepartments.some(
            (dep) => dep.name.toLowerCase() === 'vip'
          );
          this.departments = vipExists
            ? [...dbDepartments]
            : [...dbDepartments, { id: 'vip', name: 'VIP' }];
        }
      },
      error: (err: any) => {
        console.error('Failed to fetch departments', err);
        this.toast.show('שגיאה בטעינת מחלקות', 'error');
        this.departments = [];
      },
    });
  }

  checkIfHasGovernmentlicense(): boolean {
    return this.addUserForm.get('has_government_license')?.value === true;
  }

  isDepartmentRequired(): boolean {
    const role = this.addUserForm.get('role')?.value;
    return role === 'employee' || role === 'raan';
  }
  shouldShowDepartment(): boolean {
    const role = this.addUserForm.get('role')?.value;
    return role === 'employee' || role === 'supervisor' || role === 'raan';
  }

  hasGovlicenseButNoFile(): boolean {
    return this.checkIfHasGovernmentlicense() && !this.selectedFile;
  }

  dateRangeValidator(minDate: string, maxDate: string) {
    return (control: any) => {
      if (!control.value) return null;

      const selectedDate = new Date(control.value);
      const min = new Date(minDate);
      const max = new Date(maxDate);

      if (selectedDate < min) {
        return { dateRange: { message: 'Date cannot be in the past' } };
      }
      if (selectedDate > max) {
        return {
          dateRange: {
            message: 'Date cannot be more than 10 years in the future',
          },
        };
      }
      return null;
    };
  }

  getPasswordValue(): string {
    return this.addUserForm?.get('password')?.value || '';
  }

  passwordHasUppercase(): boolean {
    const pw = this.getPasswordValue();
    return /[A-Z]/.test(pw);
  }

  passwordHasDigit(): boolean {
    const pw = this.getPasswordValue();
    return /\d/.test(pw);
  }

  uppercaseValidator() {
    return (control: any) => {
      if (!control.value) return null;
      if (/[A-Z]/.test(control.value)) return null;
      return { uppercase: true };
    };
  }

  digitValidator() {
    return (control: any) => {
      if (!control.value) return null;
      if (/\d/.test(control.value)) return null;
      return { digit: true };
    };
  }
}
