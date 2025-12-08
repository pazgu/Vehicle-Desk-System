import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastService } from '../../../../services/toast.service';
import { UserService } from '../../../../services/user_service';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

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
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
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
          Validators.pattern(/^(?=.*[A-Z]).*$/),
        ],
      ],
    });

    this.addUserForm.get('role')?.valueChanges.subscribe((role) => {
      this.updateDepartmentValidation(role);
    });

    this.fetchDepartments();
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
    formData.append(key, typeof value === 'boolean' ? String(value) : value);
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
        console.error(err);
        this.toast.show('שגיאה בהוספת משתמש', 'error');
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

  fetchDepartments(): void {
    this.userService.getDepartments().subscribe({
      next: (data) => {
        const dbDepartments = data
          .filter((dep) => dep.name.toLowerCase() !== 'unassigned')
          .map((dep) => ({
            ...dep,
            name: dep.name,
          }));

        const vipExists = dbDepartments.some(
          (dep) => dep.name.toLowerCase() === 'vip'
        );
        if (!vipExists) {
          const vipDepartment = {
            id: 'vip',
            name: 'VIP',
          };
          this.departments = [...dbDepartments, vipDepartment];
        } else {
          this.departments = [...dbDepartments];
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
    return role === 'employee';
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
}
