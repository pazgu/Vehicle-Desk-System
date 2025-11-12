import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule, Validators, FormGroup, FormBuilder } from '@angular/forms';
import { FuelType } from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { Router, RouterModule } from '@angular/router';
import { ToastService } from '../../../services/toast.service';


@Component({
  selector: 'app-add-vehicle',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './add-vehicle.component.html',
  styleUrl: './add-vehicle.component.css'
})
export class AddVehicleComponent implements OnInit {
  vehicleForm!: FormGroup;
  departments: { value: string | null, name: string }[] = [];
  imagePreview: string | null = null; 
  imageVerified = false;             



  constructor(private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private toastService: ToastService) { }

  fuelTypes = [
    { value: FuelType.Gasoline, label: 'בנזין' },
    { value: FuelType.Electric, label: 'חשמלי' },
    { value: FuelType.Hybrid, label: 'היברידי' }
  ];

  ngOnInit(): void {
    this.vehicleForm = this.fb.group({
      plate_number: ['', Validators.required],
      type: ['', Validators.required],
      fuel_type: ['', Validators.required],
      mileage: [0, [Validators.required, Validators.min(0)]],
      vehicle_model: ['', Validators.required],
      // Initialize department_id with `null`.
      // Since department_id is Optional[UUID] = None on the backend,
      // it doesn't need Validators.required on the frontend here.
      department_id: [null],
      image_url: ['', [
  Validators.required,
  Validators.maxLength(2048),
  this.imageUrlValidator()
]],

      lease_expiry: ['', Validators.required]
    });
    this.fetchDepartments();

    this.vehicleForm.get('image_url')?.valueChanges.subscribe(() => {
  this.imagePreview = null;
  this.imageVerified = false;
  const ctrl = this.vehicleForm.get('image_url');
  // remove only the urlLoadFailed flag if present (keep other errors)
  if (ctrl?.hasError('urlLoadFailed')) {
    const { urlLoadFailed, ...rest } = ctrl.errors || {};
    ctrl.setErrors(Object.keys(rest).length ? rest : null);
  }
});

  }
  

  fetchDepartments(): void {
    // The backend returns { id: string, name: string }[]
    // We need to map 'id' to 'value' for the frontend select element.
    this.http.get<{ id: string, name: string }[]>('http://localhost:8000/api/departments').subscribe({
      next: (data) => {
        // Map the 'id' from backend data to 'value' for the dropdown options
        const mappedDepartments = data.map(dept => ({ value: dept.id, name: dept.name }));

        // Add the "ללא מחלקה" option (with null value) at the beginning of the list
        this.departments = [{ value: null, name: 'ללא מחלקה' }, ...mappedDepartments];

        // Ensure the form control's value is explicitly null if it's currently
        // an empty string or undefined, so the "ללא מחלקה" option is correctly selected.
        if (this.vehicleForm.get('department_id')?.value === '' || this.vehicleForm.get('department_id')?.value === undefined) {
          this.vehicleForm.get('department_id')?.setValue(null);
        }
      },
      error: (err) => {
        console.error('Failed to fetch departments', err);
        this.toastService.show('שגיאה בטעינת מחלקות', 'error');
        // If fetching fails, ensure 'ללא מחלקה' is still the only option available.
        this.departments = [{ value: null, name: 'ללא מחלקה' }];
        // Also set the form control value to null in case of a fetch error.
        this.vehicleForm.get('department_id')?.setValue(null);
      }
    });
  }

  submitForm() {
    // Mark all controls as touched to trigger validation messages visually for the user
    this.vehicleForm.markAllAsTouched();

    if (!this.imageVerified) {
  this.toastService.show('קישור התמונה חייב להיות תקין ונטען בהצלחה', 'error');
  this.vehicleForm.get('image_url')?.markAsTouched();
  return;
}


    if (this.vehicleForm.valid) {
      const vehicleData = this.vehicleForm.value;

      
      if (vehicleData.department_id === undefined || vehicleData.department_id === '') {
        vehicleData.department_id = null;
      }


      this.http.post('http://localhost:8000/api/add-vehicle', vehicleData).subscribe({
        next: (response) => {
          this.toastService.show('הרכב נוסף בהצלחה ✅', 'success');
          this.router.navigate(['/vehicle-dashboard']);
        },
        error: (error) => {
          let errorMessage = 'שגיאה בהוספת רכב ❌';
          // Attempt to extract more specific error messages from the backend response
          if (error.status === 422 && error.error && error.error.detail && Array.isArray(error.error.detail) && error.error.detail.length > 0) {
            errorMessage = `שגיאה: ${error.error.detail[0].msg}`;
          } else if (error.status === 400 && error.error && error.error.detail) {
            // This might catch the "Vehicle with this plate number already exists" error
            errorMessage = `שגיאה: ${error.error.detail}`;
          }
          this.toastService.show(errorMessage, 'error');
        }
      });
    }
    else {
      // If the form is invalid, show a generic error message
      this.toastService.show('נא למלא את כל השדות הנדרשים ❗', 'error');
    }
  }

  goBack() {
    this.router.navigate(['/vehicle-dashboard']);
  }

 private imageUrlValidator() {
  return (control: any) => {
    const raw = (control?.value || '').trim();
    if (!raw) return null; // required handles empty

    // must be a real, parseable URL
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return { urlInvalid: true };
    }

    // protocol http/https only
    if (!(url.protocol === 'http:' || url.protocol === 'https:')) {
      return { urlProtocol: true };
    }

    // must have hostname (and not localhost if you don’t want it)
    if (!url.hostname || url.hostname.indexOf('.') === -1) {
      return { urlHostname: true };
    }

    // must have a pathname with valid image extension
    const pathname = url.pathname || '';
    const hasImageExt = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(pathname);
    if (!hasImageExt) {
      return { urlImageExt: true };
    }

    // no spaces anywhere
    if (/\s/.test(raw)) {
      return { urlSpaces: true };
    }

    // length guard (also enforced by maxLength)
    if (raw.length > 2048) {
      return { maxlength: true };
    }

    return null;
  };
}


onImageUrlBlur() {
  const ctrl = this.vehicleForm.get('image_url');
  const url = (ctrl?.value || '').trim();

  // if basic validators fail, don’t try loading
  if (ctrl?.invalid) {
    this.imagePreview = null;
    this.imageVerified = false;
    return;
  }

  const img = new Image();
  img.onload = () => {
    this.imagePreview = url;
    this.imageVerified = true;
    // clear only urlLoadFailed if it exists
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