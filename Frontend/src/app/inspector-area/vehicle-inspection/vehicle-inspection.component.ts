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
      clean: [false],
      fuel_checked: [false],
      no_items_left: [false],
      critical_issue_bool: [false],
      issues_found: ['']
    });

    this.inspectionForm.get('critical_issue_bool')?.valueChanges.subscribe(value => {
      const field = this.inspectionForm.get('issues_found');
      if (value === true) {
        field?.setValidators([Validators.required]);
      } else {
        field?.clearValidators();
        field?.setValue('');
      }
      field?.updateValueAndValidity();
    });

    this.fetchVehicles();
  }

  fetchVehicles(): void {
    this.http.get<any[]>(`${environment.apiUrl}/all-vehicles`).subscribe({
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
    console.log('🧪 Submit clicked');
    console.log('Form value before submit:', this.inspectionForm.value);

    if (this.inspectionForm.invalid) {
      console.warn('🛑 FORM IS INVALID', this.inspectionForm.value);
      this.toastService.show('יש שגיאה בטופס, בדוק שוב את הערכים', 'error');
      return;
    }

    const form = this.inspectionForm.value;

    const data = {
      inspection_date: new Date(),
      inspected_by: localStorage.getItem('employee_id'),
      clean: form.clean,
      fuel_checked: form.fuel_checked,
      no_items_left: form.no_items_left,
      critical_issue_bool: form.critical_issue_bool,
      issues_found: form.critical_issue_bool && form.issues_found?.trim()
        ? form.issues_found.trim()
        : null
    };

    this.http.post(`${environment.apiUrl}/vehicle-inspections`, data).subscribe({
      next: () => {
        this.toastService.show('הבדיקה נשלחה בהצלחה', 'success');
        const role = localStorage.getItem('role');
        this.router.navigate([role === 'inspector' ? '/inspector/vehicles' : '/home']);
      },
      error: (err) => {
        if (err.status === 401) {
          this.toastService.show('הסתיים תוקף ההתחברות שלך. התחבר מחדש.', 'error');
        } else {
          this.toastService.show('שליחה נכשלה', 'error');
        }
      }
    });
  }

  logClick(): void {
    alert('🔍 Click detected!');
  }
}
