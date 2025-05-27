import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-vehicle-inspection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vehicle-inspection.component.html',
  styleUrls: ['./vehicle-inspection.component.css']
})
export class VehicleInspectionComponent implements OnInit {
  inspectionForm!: FormGroup;
  vehicleOptions: any[] = [];
  loading = true;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.inspectionForm = this.fb.group({
      vehicle_id: ['', Validators.required],
      fuel_level: ['', Validators.required],
      tires_ok: [false],
      clean: [false],
      issues_found: ['']
    });

    this.fetchVehicles();
  }

  fetchVehicles(): void {
    this.http.get<any[]>('/api/all-vehicles').subscribe({
      next: (vehicles) => {
        this.vehicleOptions = vehicles;
        this.loading = false;
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת רכבים', 'error');
        this.loading = false;
      }
    });
  }

  submitInspection(): void {
    if (this.inspectionForm.invalid) return;

    const data = {
      ...this.inspectionForm.value,
      inspected_by: localStorage.getItem('employee_id') // your user ID
    };

    this.http.post('/api/vehicle-inspections', data).subscribe({
      next: () => {
        this.toastService.show('הבדיקה נשלחה בהצלחה', 'success');
        this.router.navigate(['/home']);
      },
      error: () => this.toastService.show('שליחה נכשלה', 'error')
    });
  }
}
