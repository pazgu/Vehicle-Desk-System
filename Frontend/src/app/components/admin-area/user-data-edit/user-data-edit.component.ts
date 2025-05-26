import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../services/user_service';
import { ToastService } from '../../../services/toast.service';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { RedirectByRoleComponent } from '../../../services/redirect-by-role';
import { Router } from '@angular/router';
@Component({
  selector: 'app-user-data',
  templateUrl: './user-data-edit.component.html',
  styleUrls: ['./user-data-edit.component.css'],
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule]
})export class UserDataEditComponent implements OnInit {
  userForm!: FormGroup;
  userId: string | null = null;
  user: any = null;

  departments: Array<{ id: string; name: string }> = [];
  roles: string[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private userService: UserService,
    private toastService: ToastService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadUserData();
    this.fetchDepartments();
    this.loadRoles();
  }

  initForm(): void {
    this.userForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['', Validators.required],
      department_id: ['', Validators.required],
    });
  }

  get f() {
    return this.userForm.controls;
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

  loadRoles(): void {
    this.userService.getRoles().subscribe({
      next: (rolesData) => {
        this.roles = rolesData;
      },
      error: (err) => {
        console.error('Failed to load roles', err);
        this.toastService.show('שגיאה בטעינת תפקידים', 'error');
        this.roles = [];
      }
    });
  }

  loadUserData(): void {
    this.userId = this.route.snapshot.paramMap.get('user_id');
    console.log('Extracted user_id:', this.userId);

    if (this.userId) {
      this.userService.getUserById(this.userId).subscribe({
        next: (user) => {
          console.log('User data:', user);
          this.user = user;

          this.userForm.patchValue({
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            email: user.email,
            role: user.role,
            department_id: user.department_id
          });
        },
        error: (err) => {
          console.error('Failed to load user:', err);
        }
      });
    }
  }
  updateUser(userId: string, updateData: any) {
    return this.http.patch(`http://localhost:8000/api/user-data-edit/${userId}`, updateData);
  }

  
  onSubmit(): void {
  if (this.userForm.valid && this.userId) {
    // Exclude password if empty or handle appropriately
    const updatePayload = { ...this.userForm.value };
    if (!updatePayload.password) {
      delete updatePayload.password;
    }

    this.userService.updateUser(this.userId, updatePayload).subscribe({
      next: (updatedUser) => {
        console.log('User updated:', updatedUser);
        this.toastService.show('המשתמש עודכן בהצלחה', 'success');
         setTimeout(() => {
    this.router.navigate(['/user-data']);
  }, 500);
      },
      error: (err) => {
        console.error('Failed to update user:', err);
        this.toastService.show('שגיאה בעדכון המשתמש', 'error');
      }
    });
  } else {
    Object.keys(this.userForm.controls).forEach(key => {
      this.userForm.get(key)?.markAsTouched();
    });
  }
 
}


}
