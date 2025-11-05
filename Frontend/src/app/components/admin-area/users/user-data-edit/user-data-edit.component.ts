import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../services/user_service';
import { ToastService } from '../../../../services/toast.service';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { RedirectByRoleComponent } from '../../../../services/redirect-by-role';
import { Router } from '@angular/router';
import { SocketService } from '../../../../services/socket.service';
import { Subscription } from 'rxjs';
import { Socket } from 'socket.io-client';
import { environment } from '../../../../../environments/environment';


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
  hasExistingExpiryDate = false;
  showFileRemovedMessage = false;
  private subs: Subscription[] = [];

  private isSubmitting = false;

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

      if (this.user && (this.user.has_government_license === null || this.user.has_government_license === undefined) &&
          !this.userForm.get('has_government_license')?.dirty) {
        if (expiry && !isNaN(expiry.getTime())) {
          this.userForm.get('has_government_license')?.setValue(expiry >= today, { emitEvent: false });
        } else if (!value) {
          this.userForm.get('has_government_license')?.setValue(false, { emitEvent: false });
        }
      }
    });

    const hasLicenseSub = this.userForm.get('has_government_license')?.valueChanges.subscribe((checked: boolean) => {
      if (!checked) {
        this.userForm.get('license_expiry_date')?.setValue('');
        if (this.hasExistingLicenseFile) {
          this.showFileRemovedMessage = true;
          this.hasExistingLicenseFile = false;
        }
      } else {
        this.showFileRemovedMessage = false;
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
      this.hasExistingExpiryDate = !!this.user.license_expiry_date;
      this.showFileRemovedMessage = false;
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
      phone: ['', [Validators.required, Validators.pattern(/^05\d{8}$/)]],

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

    if (this.userId) {
      this.userService.getUserById(this.userId).subscribe({
        next: (user) => {
          this.user = user;
          this.hasExistingLicenseFile = !!user.license_file_url;
          this.hasExistingExpiryDate = !!user.license_expiry_date;
          this.showFileRemovedMessage = false;
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
        error: () => {
          this.toastService.show('שגיאה בטעינת פרטי המשתמש');

        }
      });
    }
  }


  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input && input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.selectedFileName = this.selectedFile.name;
      this.showFileRemovedMessage = false; 
    } else {
      this.selectedFile = null;
      this.selectedFileName = '';
    }
  }
  
  private validateLicenseRequirements(): { isValid: boolean; errorMessage?: string } {
    const hasGovernmentLicense = this.userForm.get('has_government_license')?.value;
    const licenseExpiryDate = this.userForm.get('license_expiry_date')?.value;
    
    if (hasGovernmentLicense) {
      if (!this.hasExistingLicenseFile && !this.selectedFile) {
        return { isValid: false, errorMessage: 'נדרש קובץ רשיון בעת הפעלת רשיון ממשלתי' };
      }
      if (!licenseExpiryDate || licenseExpiryDate.trim() === '') {
        return { isValid: false, errorMessage: 'נדרש תאריך תפוגת רשיון בעת הפעלת רשיון ממשלתי' };
      }
    }
    return { isValid: true };
  }
  onSubmit(): void {
    if (this.isSubmitting) {
      return;
    }
    const validationResult = this.validateLicenseRequirements();
    if (!validationResult.isValid) {
      this.toastService.show(validationResult.errorMessage!, 'error');
      return;
    }
    if (this.userForm.valid && this.userId) {
      this.isSubmitting = true;
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

      const hasLicenseControl = this.userForm.get('has_government_license');
      if (hasLicenseControl) {
        formData.append('has_government_license', hasLicenseControl.value ? 'true' : 'false');
      }

      // Logic for license_file upload: Only send if it's a new upload (no existing file) AND a file is selected.
      if (!this.hasExistingLicenseFile && this.selectedFile) {
        formData.append('license_file', this.selectedFile);
      }

      const newExpiryDate = formValues.license_expiry_date;
      const oldExpiryDate = this.user?.license_expiry_date;

      if (newExpiryDate && newExpiryDate !== oldExpiryDate) {
        // User entered a new expiry date, send that
        formData.append('license_expiry_date', newExpiryDate);
      } else if (oldExpiryDate) {
        // No change, send the original value
        formData.append('license_expiry_date', new Date(oldExpiryDate).toISOString().substring(0, 10));
      }
console.log('FormData contents:');
formData.forEach((value, key) => {
  console.log(key, value);
});
      this.userService.updateUser(this.userId, formData).subscribe({
        next: (updatedUser) => {
          this.isSubmitting = false;
          this.toastService.show('המשתמש עודכן בהצלחה', 'success');
          setTimeout(() => {
            this.router.navigate(['/user-data']);
          }, 500);
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmitting = false;
          console.error('Failed to update user');
          // Extract specific error detail from backend if available, otherwise use a generic message
          const errorMessage = err.error && err.error.detail ? err.error.detail : 'שגיאה בעדכון המשתמש';
          if (!errorMessage.includes('נדרש קובץ רשיון בעת הפעלת רשיון ממשלתי') && 
              !errorMessage.includes('נדרש תאריך תפוגת רשיון בעת הפעלת רשיון ממשלתי') &&
              !errorMessage.includes('License file is required when enabling government license')) {
            this.toastService.show(errorMessage, 'error');
          }
        }
      });
    } else {
      // Mark all controls as touched to display validation errors
      Object.keys(this.userForm.controls).forEach(key => {
        this.userForm.get(key)?.markAsTouched();
      });
      this.toastService.show('אנא מלא את כל השדות הנדרשים', 'error');
    }
  }

    openLicenseInNewTab(): void {
      if (!this.user?.license_file_url) return;
      const fullUrl = environment.socketUrl + this.user.license_file_url;
      window.open(fullUrl, '_blank');
    }
}