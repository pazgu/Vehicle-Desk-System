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
  // Define the type for departments to match the mapped structure: { value: string | null, name: string }
  departments: { value: string | null, name: string }[] = [];

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
      current_location: ['', Validators.required],
      odometer_reading: [0, [Validators.required, Validators.min(0)]],
      vehicle_model: ['', Validators.required],
      // Initialize department_id with `null`.
      // Since department_id is Optional[UUID] = None on the backend,
      // it doesn't need Validators.required on the frontend here.
      department_id: [null],
      image_url: ['', [Validators.required, Validators.maxLength(2048)]],
      lease_expiry: ['', Validators.required]
    });
    this.fetchDepartments();
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

    if (this.vehicleForm.valid) {
      const vehicleData = this.vehicleForm.value;

      // This guard ensures that if department_id somehow ends up as an empty string or undefined
      // (which should be rare with [ngValue]="null" and proper initialization),
      // it is converted to null, which the backend's Optional[UUID] can handle.
      if (vehicleData.department_id === undefined || vehicleData.department_id === '') {
        vehicleData.department_id = null;
      }

      console.log('Payload to send:', vehicleData);

      this.http.post('http://localhost:8000/api/add-vehicle', vehicleData).subscribe({
        next: (response) => {
          console.log('Vehicle added successfully!', response);
          this.toastService.show('הרכב נוסף בהצלחה ✅', 'success');
          this.router.navigate(['/vehicle-dashboard']);
        },
        error: (error) => {
          console.error('Error adding vehicle:', error);
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
      console.log('Form is invalid', this.vehicleForm.errors);
    }
  }

  goBack() {
    this.router.navigate(['/vehicle-dashboard']);
  }
}