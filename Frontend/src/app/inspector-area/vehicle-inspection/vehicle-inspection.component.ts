import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../services/toast.service';
import { environment } from '../../../environments/environment';

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
  fuel_level: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
  tires_ok: [false],
  clean: [false],
  critical_issue: [''],
  fuel_checked: [false],
  no_items_left: [false]
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
      const role = localStorage.getItem('role');
      if (role !== 'inspector') {
        this.toastService.show('שגיאה בטעינת רכבים', 'error');
      }
      this.loading = false;
    }
  });
}


submitInspection(): void {
  if (this.inspectionForm.invalid) {
    // Show toast if fuel_level is invalid
   if (this.inspectionForm.invalid) {
  this.toastService.show('יש שגיאה בטופס, בדוק שוב את הערכים', 'error');
  return;
}

  }

  const form = this.inspectionForm.value;

const data = {
  ride_id: crypto.randomUUID(), // ✅ must be included
  vehicle_id: form.vehicle_id, // ✅ must match DB ID
  inspected_by: localStorage.getItem('employee_id'), // ✅ UUID string
  fuel_level: form.fuel_level,
  tires_ok: form.tires_ok,
  clean: form.clean,
  issues_found: form.critical_issue?.trim()
    ? { critical_event: form.critical_issue.trim() }
    : null
};


this.http.post(`${environment.apiUrl}/vehicle-inspections`, data)
.subscribe({
    next: () => {
      this.toastService.show('הבדיקה נשלחה בהצלחה', 'success');
      this.router.navigate(['/home']);
    },
    error: () => this.toastService.show('שליחה נכשלה', 'error')
  });
}

updateFuelDisplay(): void {
  const level = this.inspectionForm.get('fuel_level')?.value;
  if (level < 15) {
    console.warn('🔴 Fuel critically low!');
  }
}

getFuelColor(value: number): string {
  if (value < 25) return 'red';
  if (value < 50) return 'orange';
  return 'green';
}




}
