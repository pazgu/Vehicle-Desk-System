import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastService } from '../../../services/toast.service';
import { NewUserPayload, UserService } from '../../../services/user_service';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-add-new-user',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './add-new-user.component.html',
  styleUrls: ['./add-new-user.component.css']
})
export class AddNewUserComponent implements OnInit {
  addUserForm!: FormGroup;
  roles = [
    { key: 'admin', label: 'מנהל' },
    { key: 'employee', label: 'עובד' },
    { key: 'supervisor', label: 'מפקח' },
    { key: 'inspector', label: 'בודק רכבים' }
  ];
  showPassword = false;
  
  departments: { id: string; name: string }[] = [];
  selectedFile: File | null = null;
  selectedFileName: string = '';

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private toast: ToastService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    const today = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 10); // 10 years from now
  const maxDateStr = maxDate.toISOString().split('T')[0];

    this.addUserForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [
      Validators.required, 
      Validators.pattern(/^\d{10}$/)  // Exactly 10 digits
    ]],      role: ['', Validators.required],
      has_government_license: [false], // ✅ Initialize as boolean, not string
      department_id: ['', Validators.required],
       license_expiry_date: ['', [
      Validators.required,
      this.dateRangeValidator(today, maxDateStr)
    ]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.pattern(/^(?=.*[A-Z]).*$/) // ✅ At least one capital letter
      ]],
    });
    this.fetchDepartments();
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  submit(): void {
    if (this.addUserForm.invalid || this.hasGovlicenseButNoFile()) {
      this.addUserForm.markAllAsTouched();
      
      if (this.hasGovlicenseButNoFile()) {
        this.toast.show('קובץ רישיון נדרש עבור משתמש עם רישיון', 'error');
      } else {
        this.toast.show('אנא מלא את כל השדות הנדרשים', 'error');
      }
      return;
    }

    const formData = new FormData();
    const formValues = this.addUserForm.value;

    // ✅ Append each field - FormData will handle boolean to string conversion
    for (const key in formValues) {
      const value = formValues[key];
      if (value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    }

    // ✅ Append the file only if needed
    if (this.checkIfHasGovernmentlicense() && this.selectedFile) {
      formData.append('license_file', this.selectedFile);
    }

 

    // ✅ Submit
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
      license_expiry_date: 'תוקף רישיון'
    };
    return map[field] || field;
  }

  private departmentHebrewMap: { [key: string]: string } = {
    Engineering: 'הנדסה',
    HR: 'משאבי אנוש',
    'IT Department': 'טכנولוגיות מידע',
    Finance: 'כספים',
    Security: 'ביטחון'
  };

  fetchDepartments(): void {
    this.http.get<any[]>('http://localhost:8000/api/departments').subscribe({
      next: (data) => {
        this.departments = data.map(dep => ({
          ...dep,
          name: this.departmentHebrewMap[dep.name] || dep.name
        }));
      },
      error: (err: any) => {
        console.error('Failed to fetch departments', err);
        this.toast.show('שגיאה בטעינת מחלקות', 'error');
        this.departments = [];
      }
    });
  }

  checkIfHasGovernmentlicense(): boolean {
    return this.addUserForm.get('has_government_license')?.value === true; // ✅ Compare with boolean true
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
      return { dateRange: { message: 'Date cannot be more than 10 years in the future' } };
    }
    return null;
  };
}
}