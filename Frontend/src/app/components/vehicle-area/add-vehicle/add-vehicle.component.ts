import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../../services/vehicle.service';
import { DepartmentService } from '../../../services/department_service';
import {
  ReactiveFormsModule,
  FormsModule,
  Validators,
  FormGroup,
  FormBuilder,
} from '@angular/forms';
import { FuelType } from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { Router, RouterModule } from '@angular/router';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-add-vehicle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './add-vehicle.component.html',
  styleUrl: './add-vehicle.component.css',
})
export class AddVehicleComponent implements OnInit {
  vehicleForm!: FormGroup;
  departments: { value: string | null; name: string }[] = [];
  vehicleTypes: string[] = [];
  imagePreview: string | null = null;
  imageVerified = false;
  isDropdownOpen = false;
  filteredVehicleTypes: string[] = [];
  newTypeMessage: string = '';

  constructor(
    private fb: FormBuilder,
    private vehicleService: VehicleService,
    private departmentService: DepartmentService,
    private router: Router,
    private toastService: ToastService
  ) {}

  fuelTypes = [
    { value: FuelType.Gasoline, label: 'בנזין' },
    { value: FuelType.Electric, label: 'חשמלי' },
    { value: FuelType.Hybrid, label: 'היברידי' },
  ];

  ngOnInit(): void {
    this.vehicleForm = this.fb.group({
      plate_number: ['', Validators.required],
      type: ['', Validators.required],
      fuel_type: ['', Validators.required],
      mileage: [0, [Validators.required, Validators.min(0)]],
      vehicle_model: ['', Validators.required],
      department_id: [null],
      image_url: [
        '',
        [
          Validators.required,
          Validators.maxLength(2048),
          this.imageUrlValidator(),
        ],
      ],
      lease_expiry: ['', [Validators.required, this.futureDateValidator()]],
    });
    this.fetchDepartments();
    this.fetchVehicleTypes();

    this.vehicleForm.get('image_url')?.valueChanges.subscribe(() => {
      this.imagePreview = null;
      this.imageVerified = false;
      const ctrl = this.vehicleForm.get('image_url');
      if (ctrl?.hasError('urlLoadFailed')) {
        const { urlLoadFailed, ...rest } = ctrl.errors || {};
        ctrl.setErrors(Object.keys(rest).length ? rest : null);
      }
    });
  }
  fetchVehicleTypes(): void {
    this.vehicleService.getVehicleTypes().subscribe({
      next: (types: string[]) => {
        this.vehicleTypes = types;
        this.filteredVehicleTypes = types;
      },
      error: (err) => {
        this.toastService.show('שגיאה בטעינת סוגי רכבים', 'error');
        this.vehicleTypes = [];
        this.filteredVehicleTypes = [];
      },
    });
  }

  onVehicleTypeInput(event: any): void {
    const inputValue = event.target.value;
    this.filteredVehicleTypes = this.vehicleTypes.filter((type) =>
      type.toLowerCase().includes(inputValue.toLowerCase())
    );
    const trimmedType = inputValue.trim();
    this.isDropdownOpen = this.filteredVehicleTypes.length > 0;
    if (trimmedType && !this.vehicleTypes.includes(trimmedType)) {
      this.newTypeMessage = `סוג רכב "${trimmedType}" יתווסף בעת שמירת הרכב`;
    } else {
      this.newTypeMessage = '';
    }
  }

  onVehicleTypeFocus(): void {
    this.isDropdownOpen = true;
    this.filteredVehicleTypes = this.vehicleTypes;
  }

  selectVehicleType(type: string): void {
    this.vehicleForm.get('type')?.setValue(type);
    this.isDropdownOpen = false;
    this.filteredVehicleTypes = this.vehicleTypes;
    this.newTypeMessage = '';
  }

  closeDropdown(): void {
    setTimeout(() => {
      this.isDropdownOpen = false;
    }, 200);
  }

  fetchDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: (data: any) => {
        const filteredDepartments = data.filter(
          (dept: any) => dept.name.toLowerCase() !== 'unassigned'
        );
        const mappedDepartments = filteredDepartments.map((dept: any) => ({
          value: dept.id,
          name: dept.name,
        }));
        const hasVIP = mappedDepartments.some(
          (d: any) => d.name.toLowerCase() === 'vip'
        );

        const vipDepartment = { value: 'vip', name: 'VIP' };
        const finalDepartments = hasVIP
          ? mappedDepartments
          : [...mappedDepartments, vipDepartment];

        this.departments = [
          { value: null, name: 'ללא מחלקה' },
          ...finalDepartments,
        ];

        if (
          this.vehicleForm.get('department_id')?.value === '' ||
          this.vehicleForm.get('department_id')?.value === undefined
        ) {
          this.vehicleForm.get('department_id')?.setValue(null);
        }
      },
      error: (err) => {
        console.error('Failed to fetch departments', err);
        this.toastService.show('שגיאה בטעינת מחלקות', 'error');
        this.departments = [{ value: null, name: 'ללא מחלקה' }];
        this.vehicleForm.get('department_id')?.setValue(null);
      },
    });
  }

  submitForm() {
    this.vehicleForm.markAllAsTouched();

    if (!this.imageVerified && this.vehicleForm.get('image_url')?.value) {
      this.toastService.show(
        'קישור התמונה חייב להיות תקין ונטען בהצלחה',
        'error'
      );
      return;
    }
    if (this.vehicleForm.invalid) {
      Object.keys(this.vehicleForm.controls).forEach((key) => {
        const control = this.vehicleForm.get(key);
        if (control?.invalid) {
        }
      });
      this.toastService.show('יש למלא את כל השדות הנדרשים', 'error');
      return;
    }

    const vehicleData = this.vehicleForm.value;

    if (
      vehicleData.department_id === undefined ||
      vehicleData.department_id === ''
    ) {
      vehicleData.department_id = null;
    }

    this.vehicleService.addVehicle(vehicleData).subscribe({
      next: (response) => {
        this.toastService.show('הרכב נוסף בהצלחה ', 'success');
        this.router.navigate(['/vehicle-dashboard']);
      },
      error: (error) => {
        let errorMessage = 'שגיאה בהוספת רכב ';
        if (
          error.status === 422 &&
          error.error &&
          error.error.detail &&
          Array.isArray(error.error.detail) &&
          error.error.detail.length > 0
        ) {
          errorMessage = `שגיאה: ${error.error.detail[0].msg}`;
        } else if (error.status === 400 && error.error && error.error.detail) {
          errorMessage = `שגיאה: ${error.error.detail}`;
        }
        this.toastService.show(errorMessage, 'error');
      },
    });
  }

  goBack() {
    this.router.navigate(['/vehicle-dashboard']);
  }

  private imageUrlValidator() {
    return (control: any) => {
      const raw = (control?.value || '').trim();
      if (!raw) return null;

      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return { urlInvalid: true };
      }

      if (!(url.protocol === 'http:' || url.protocol === 'https:')) {
        return { urlProtocol: true };
      }

      if (!url.hostname || url.hostname.indexOf('.') === -1) {
        return { urlHostname: true };
      }

      const pathname = url.pathname || '';
      const hasImageExt = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(pathname);
      if (!hasImageExt) {
        return { urlImageExt: true };
      }

      if (/\s/.test(raw)) {
        return { urlSpaces: true };
      }

      if (raw.length > 2048) {
        return { maxlength: true };
      }

      return null;
    };
  }

  private futureDateValidator() {
    return (control: any) => {
      const value = control?.value;
      if (!value) return null;

      const selectedDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return { pastDate: true };
      }

      return null;
    };
  }

  onImageUrlBlur() {
    const ctrl = this.vehicleForm.get('image_url');
    const url = (ctrl?.value || '').trim();

    if (ctrl?.invalid) {
      this.imagePreview = null;
      this.imageVerified = false;
      return;
    }

    const img = new Image();
    img.onload = () => {
      this.imagePreview = url;
      this.imageVerified = true;

      const errs = ctrl?.errors || {};
      if (errs['urlLoadFailed']) {
        const { urlLoadFailed, ...rest } = errs;
        ctrl?.setErrors(Object.keys(rest).length ? rest : null);
      }
    };
    img.onerror = () => {
      this.imagePreview = null;
      this.imageVerified = false;
      const current = ctrl?.errors || {};
      ctrl?.setErrors({ ...current, urlLoadFailed: true });
    };
    img.src = url;
  }
}
