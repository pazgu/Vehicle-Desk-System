import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule, Validators, FormGroup, FormBuilder } from '@angular/forms';
import { FuelType } from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { Router, RouterModule } from '@angular/router';
import { ToastService } from '../../../services/toast.service';


@Component({
  selector: 'app-add-vehicle',
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './add-vehicle.component.html',
  styleUrl: './add-vehicle.component.css'
})
export class AddVehicleComponent implements OnInit {
  vehicleForm!: FormGroup;
  departments: any[] = [];

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
      department_id: ['', Validators.required],
      image_url: ['', [Validators.required, Validators.maxLength(2048)]],
      lease_expiry: ['', Validators.required]
    });
    this.fetchDepartments();

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

  submitForm() {
    if (this.vehicleForm.valid) {
      const vehicleData = this.vehicleForm.value;
      console.log('Payload to send:', vehicleData);

      this.http.post('http://localhost:8000/api/add-vehicle', vehicleData).subscribe({
        next: (response) => {
          console.log('Vehicle added successfully!', response);
          this.toastService.show('הרכב נוסף בהצלחה ✅', 'success');

          this.router.navigate(['/vehicle-dashboard']); // Navigate to the vehicle list or reset the form
        },
        error: (error) => {
          console.error('Error adding vehicle:', error);
          this.toastService.show('שגיאה בהוספת רכב ❌', 'error');
          // Optionally: show an error message to user
        }
      });
    }
    else {
      this.toastService.show('נא למלא את כל השדות הנדרשים ❗', 'error');
      console.log('Form is invalid', this.vehicleForm.errors);
    }
  }

  goBack() {
    this.router.navigate(['/vehicle-dashboard']);
  }


}
