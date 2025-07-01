import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastService } from '../../../services/toast.service';
import { NewUserPayload, UserService } from '../../../services/user_service';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';


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




  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private toast: ToastService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.addUserForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: [''], // Optional, can add validation
      role: ['', Validators.required],
      department_id: ['', Validators.required],
password: ['', [
  Validators.required,
  Validators.minLength(8),
  Validators.pattern(/^(?=.*[A-Z]).*$/) // ✅ At least one capital letter
]],
    });
    this.fetchDepartments();

  }

 // ✅ Added toggle password method
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }


submit(): void {
  if (this.addUserForm.invalid) {
    const controls = this.addUserForm.controls;
    for (const key in controls) {
      if (controls[key].invalid) {
        this.toast.show(`שדה חסר או לא תקין: ${this.getHebrewFieldName(key)}`, 'error');
        break;
      }
    }
    return;
  }

  const userData: NewUserPayload = this.addUserForm.value;
  this.userService.addNewUser(userData).subscribe({
    next: () => {
      this.toast.show('המשתמש נוסף בהצלחה!', 'success');
      this.addUserForm.reset();

      this.router.navigate(['/admin/analytics']);
    },
    error: (err) => {
      console.error(err);
      this.toast.show('שגיאה בהוספת משתמש', 'error');
    },
  });
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
  };
  return map[field] || field;
}

private departmentHebrewMap: { [key: string]: string } = {
  Engineering: 'הנדסה',
  HR: 'משאבי אנוש',
  'IT Department': 'טכנולוגיות מידע',
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


}
