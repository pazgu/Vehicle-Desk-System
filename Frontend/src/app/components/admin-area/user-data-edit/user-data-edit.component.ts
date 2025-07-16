import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../services/user_service';
import { ToastService } from '../../../services/toast.service';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { RedirectByRoleComponent } from '../../../services/redirect-by-role';
import { Router } from '@angular/router';
import { validateVerticalPosition } from '@angular/cdk/overlay';
import { SocketService } from '../../../services/socket.service';
import { Subscription } from 'rxjs';
import { Socket } from 'socket.io-client';


@Component({
  selector: 'app-user-data',
  templateUrl: './user-data-edit.component.html',
  styleUrls: ['./user-data-edit.component.css'],
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule]
})
export class UserDataEditComponent implements OnInit {
  userForm!: FormGroup;
  userId: string | null = null;
  user: any = null;
  departments: Array<{ id: string; name: string }> = [];
  roles: string[] = [];
  selectedFile: File | null = null;
  selectedFileName = '';
  hasExistingLicenseFile = false;
  private subs: Subscription[] = [];


  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private userService: UserService,
    private toastService: ToastService,
    private http: HttpClient,
    private router: Router,
    private socketService: SocketService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadUserData();
    this.fetchDepartments();
    this.loadRoles();
    this.setupFormSubscriptions();
    this.setupSocketSubscriptions();
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe());
  }

  setupFormSubscriptions(): void {
    const licenceExpirySub = this.userForm.get('license_expiry_date')?.valueChanges.subscribe((value: string) => {
      const expiry = value ? new Date(value) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (expiry && !isNaN(expiry.getTime())) {
        this.userForm.get('has_government_license')?.setValue(expiry >= today, { emitEvent: false });
      } else if (!value) {
        this.userForm.get('has_government_license')?.setValue(false, { emitEvent: false });
      }
    });

    const hasLicenseSub = this.userForm.get('has_government_license')?.valueChanges.subscribe((checked: boolean) => {
      if (!checked) {
        this.userForm.get('license_expiry_date')?.setValue('');
      }
    });

    if (licenceExpirySub) this.subs.push(licenceExpirySub);
    if (hasLicenseSub) this.subs.push(hasLicenseSub);
  }

  setupSocketSubscriptions(): void {
    const sockeytSub = this.socketService.usersLicense$.subscribe(update => {
      if (!this.user || this.user.employee_id !== update.id) return;

      this.user = { ...this.user, ...update };

      if (update.license_expiry_date) {
        this.user.license_expiry_date = new Date(update.license_expiry_date);
      }

      this.userForm.patchValue({
        license_expiry_date: this.user.license_expiry_date?.toISOString().substring(0, 10),
        has_government_license: this.user.has_government_license,
        license_file_url: this.user.license_file_url
      });
      this.hasExistingLicenseFile = !!this.user.license_file_url;
      this.cdr.detectChanges();
    });
    this.subs.push(sockeytSub);
  }


  initForm(): void {
    this.userForm = this.fb.group({
      first_name: ['', Validators.required],
      last_name: ['', Validators.required],
      username: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['', Validators.required],
      department_id: ['', Validators.required],
      has_government_license: [false],
      license_file_url: [''],
      license_expiry_date: [''],
      phone: ['', Validators.required]

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
          this.hasExistingLicenseFile = !!user.license_file_url;
          this.userForm.patchValue({
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            email: user.email,
            role: user.role,
            department_id: user.department_id,
            has_government_license: user.has_government_license,
            license_file_url: user.license_file_url,
            phone: user.phone,
            license_expiry_date: user.license_expiry_date
              ? new Date(user.license_expiry_date).toISOString().substring(0, 10)
              : ''
          });
        },
        error: (err) => {
          console.error('Failed to load user:', err);
          this.toastService.show('שגיאה בטעינת פרטי המשתמש', 'error');

        }
      });
    }
  }


  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input && input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.selectedFileName = this.selectedFile.name;
    }
  }

  // onSubmit(): void {
  //   if (this.userForm.valid && this.userId) {
  //     const formValues = this.userForm.value;
  //     const formData = new FormData();
  //     console.log('Form values before processing:', formValues);
  //     console.log('License expiry date from form:', formValues.license_expiry_date);
  //     console.log('Type of license_expiry_date:', typeof formValues.license_expiry_date);

  //     for (const key in formValues) {
  //       if (this.hasExistingLicenseFile && key.startsWith('license_') && !this.selectedFile) {
  //         continue;
  //       }

  //       const value = formValues[key];
  //       if (typeof value === 'boolean') {
  //         formData.append(key, value ? 'true' : 'false');
  //       } else if (value !== null && value !== undefined) {
  //         formData.append(key, value.toString());
  //       }
  //     }

  //     if (this.selectedFile) {
  //       formData.append('license_file', this.selectedFile);
  //     }

  //     this.userService.updateUser(this.userId, formData).subscribe({
  //       next: () => {
  //         this.toastService.show('המשתמש עודכן בהצלחה', 'success');
  //         setTimeout(() => {
  //           this.router.navigate(['/user-data']);
  //         }, 500);
  //       },
  //       error: (err) => {
  //         console.error('Failed to update user:', err);
  //         this.toastService.show('שגיאה בעדכון המשתמש', 'error');
  //       }
  //     });
  //   } else {
  //     Object.keys(this.userForm.controls).forEach(key => {
  //       this.userForm.get(key)?.markAsTouched();
  //     });
  //   }
  // }
// --- This is the full, corrected `onSubmit` method. Replace your existing one with this. ---

onSubmit(): void {
  if (this.userForm.valid && this.userId) {
    const formData = new FormData();
    const formValues = this.userForm.value;

    // Always append basic user data
    formData.append('first_name', formValues.first_name);
    formData.append('last_name', formValues.last_name);
    formData.append('username', formValues.username);
    formData.append('email', formValues.email);
    formData.append('role', formValues.role);
    formData.append('department_id', formValues.department_id);
    formData.append('phone', formValues.phone);

    // Only append the `has_government_license` field if the control is not disabled.
    // This prevents sending `false` when a license exists.
    const hasLicenseControl = this.userForm.get('has_government_license');
    if (hasLicenseControl && !hasLicenseControl.disabled) {
      formData.append('has_government_license', hasLicenseControl.value ? 'true' : 'false');
    }
    
    // Logic for NEW license upload (when no file exists yet)
    if (!this.hasExistingLicenseFile) {
      if (formValues.license_expiry_date) {
        formData.append('license_expiry_date', formValues.license_expiry_date);
      }
      if (this.selectedFile) {
        formData.append('license_file', this.selectedFile);
      }
    }
    
    // Logic for EXISTING license (when a file already exists)
    // We don't send license details unless a new file is explicitly selected.
    if (this.hasExistingLicenseFile && this.selectedFile) {
        formData.append('license_file', this.selectedFile);
    }
    
    this.userService.updateUser(this.userId, formData).subscribe({
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
