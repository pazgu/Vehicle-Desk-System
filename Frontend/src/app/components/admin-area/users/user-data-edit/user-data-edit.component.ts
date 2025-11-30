import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { UserService } from '../../../../services/user_service';
import { DepartmentService } from '../../../../services/department_service';
import { ToastService } from '../../../../services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { SocketService } from '../../../../services/socket.service';
import { Subscription } from 'rxjs';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-user-data',
  templateUrl: './user-data-edit.component.html',
  styleUrls: ['./user-data-edit.component.css'],
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule]
})
export class UserDataEditComponent implements OnInit, OnDestroy {
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
  isSubmitting = false;
  minDateTime: string = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private userService: UserService,
    private departmentService: DepartmentService,
    private toastService: ToastService,
    private router: Router,
    private socketService: SocketService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.setMinDateTime();
    this.initForm();
    this.loadUserData();
    this.fetchDepartments();
    this.loadRoles();
    this.setupFormSubscriptions();
    this.setupSocketSubscriptions();
    this.setupRoleBasedValidation();
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe());
  }
  setMinDateTime(): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    this.minDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
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
      department_id: [''],
      has_government_license: [false],
      license_file_url: [''],
      license_expiry_date: [''],
      phone: ['', [Validators.required, Validators.pattern(/^05\d{8}$/)]],
      block_reason: [''],
      block_expires_at: ['']
    });
  }

  get f() {
    return this.userForm.controls;
  }

  fetchDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: (data) => {
        const dbDepartments = data.filter((dept: any) => 
          dept.name.toLowerCase() !== 'unassigned'
        );
         const hasVip = dbDepartments.some(
        (dept: any) => dept.name.toLowerCase() === 'vip'
      );

      if (!hasVip) {
        dbDepartments.push({
          id: 'vip',  
          name: 'VIP'
        });
      }

      this.departments = dbDepartments;
      },
      error: (err) => {
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
        this.toastService.show('שגיאה בטעינת תפקידים', 'error');
        this.roles = [];
      }
    });
  }
  setupRoleBasedValidation(): void {
    const roleSub = this.userForm.get('role')?.valueChanges.subscribe((role: string) => {
      const deptControl = this.userForm.get('department_id');
      
      if (role === 'employee') {
        deptControl?.setValidators([Validators.required]);
      } else {
        deptControl?.clearValidators();
        if (role === 'admin' || role === 'inspector') {
          deptControl?.setValue('');
        }
      }
      
      deptControl?.updateValueAndValidity();
    });
    
    if (roleSub) this.subs.push(roleSub);
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
              : '',
            block_reason: user.block_reason || '',
            block_expires_at: user.block_expires_at 
              ? new Date(user.block_expires_at).toISOString().substring(0, 16)
              : ''
          });
          if (user.is_blocked) {
            this.userForm.get('block_reason')?.setValidators([Validators.required]);
            this.userForm.get('block_expires_at')?.setValidators([Validators.required]);
            this.userForm.get('block_reason')?.updateValueAndValidity();
            this.userForm.get('block_expires_at')?.updateValueAndValidity();
          }
        },
        error: () => {
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
      if (!licenseExpiryDate || licenseExpiryDate.trim() === '') {
        return { isValid: false, errorMessage: 'נדרש תאריך תפוגת רשיון בעת הפעלת רשיון ממשלתי' };
      }
    }
    return { isValid: true };
  }
  private validateBlockExpiry(): { isValid: boolean; errorMessage?: string } {
    const blockExpiresAt = this.userForm.get('block_expires_at')?.value;
    if (blockExpiresAt) {
      const expiryDate = new Date(blockExpiresAt);
      const now = new Date(); 
      if (expiryDate <= now) {
        return { isValid: false, errorMessage: 'תאריך סיום החסימה חייב להיות בעתיד' };
      }
    } 
    return { isValid: true };
  }
  private validateBlockFields(): { isValid: boolean; errorMessage?: string } {
    if (this.user?.is_blocked) {
      const blockReason = this.userForm.get('block_reason')?.value?.trim();
      const blockExpiresAt = this.userForm.get('block_expires_at')?.value;
      if (!blockReason) {
        return { isValid: false, errorMessage: 'סיבת החסימה היא שדה חובה' };
      }
      if (!blockExpiresAt || blockExpiresAt.trim() === '') {
        return { isValid: false, errorMessage: 'תאריך סיום החסימה הוא שדה חובה' };
      }
    } 
    return { isValid: true };
  }
  validateBlockExpiryOnBlur(): void {
    const blockExpiresAt = this.userForm.get('block_expires_at')?.value;
    if (blockExpiresAt) {
      const selectedDate = new Date(blockExpiresAt);
      const now = new Date();
      if (selectedDate <= now) {
        this.userForm.get('block_expires_at')?.setValue('', { emitEvent: false });
        this.toastService.show('לא ניתן לבחור תאריך בעבר לסיום חסימה', 'error');
      }
    }
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
    const blockValidationResult = this.validateBlockExpiry();
    if (!blockValidationResult.isValid) {
      this.toastService.show(blockValidationResult.errorMessage!, 'error');
      return;
    }
    const blockFieldsValidation = this.validateBlockFields();
    if (!blockFieldsValidation.isValid) {
      this.toastService.show(blockFieldsValidation.errorMessage!, 'error');
      return;
    }
    if (this.userForm.valid && this.userId) {
      this.isSubmitting = true;
      const formData = new FormData();
      const formValues = this.userForm.value;

      formData.append('first_name', formValues.first_name);
      formData.append('last_name', formValues.last_name);
      formData.append('username', formValues.username);
      formData.append('email', formValues.email);
      formData.append('role', formValues.role);
      if (formValues.department_id) {
        formData.append('department_id', formValues.department_id);
      }
      formData.append('phone', formValues.phone);

      const hasLicenseControl = this.userForm.get('has_government_license');
      if (hasLicenseControl) {
        formData.append('has_government_license', hasLicenseControl.value ? 'true' : 'false');
      }

      if (!this.hasExistingLicenseFile && this.selectedFile) {
        formData.append('license_file', this.selectedFile);
      }

      const newExpiryDate = formValues.license_expiry_date;
      const oldExpiryDate = this.user?.license_expiry_date;

      if (newExpiryDate && newExpiryDate !== oldExpiryDate) {
        formData.append('license_expiry_date', newExpiryDate);
      } else if (oldExpiryDate) {
        formData.append('license_expiry_date', new Date(oldExpiryDate).toISOString().substring(0, 10));
      }
      if (this.user?.is_blocked) {
        const blockReason = formValues.block_reason?.trim() || '';    
        formData.append('is_blocked', 'true');
        formData.append('block_reason', blockReason);
        if (formValues.block_expires_at) {
          const expiryDate = new Date(formValues.block_expires_at);
          const year = expiryDate.getFullYear();
          const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
          const day = String(expiryDate.getDate()).padStart(2, '0');
          const hours = String(expiryDate.getHours()).padStart(2, '0');
          const minutes = String(expiryDate.getMinutes()).padStart(2, '0');
          const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
          formData.append('block_expires_at', formattedDateTime);
        }
      } else {
        formData.append('is_blocked', 'false');
      }
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
          
          let errorMessage = 'שגיאה בעדכון המשתמש';
          if (err.error) {
            if (err.error.detail) {
              if (Array.isArray(err.error.detail)) {
                errorMessage = err.error.detail.map((e: any) => e.msg || e).join(', ');
              } else {
                errorMessage = err.error.detail;
              }
            } else if (typeof err.error === 'string') {
              errorMessage = err.error;
            }
          }
          this.toastService.show(errorMessage, 'error');
        }
      });
    } else {
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