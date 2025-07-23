import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { ToastService } from '../../services/toast.service';

interface Vehicle {
  id: string;
  plate_number: string;
}

interface VehicleIssue {
  vehicle_id: string;
  plate: string;
  dirty: boolean;
  fuel_checked: boolean;
  items_left: boolean;
  critical_issue: boolean;
}

@Component({
  selector: 'app-vehicle-issue-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicle-inspection.component.html',
  styleUrls: ['./vehicle-inspection.component.css']
})
export class VehicleInspectionComponent implements OnInit {
  vehicleIssues: VehicleIssue[] = [];
  issues_found: string = '';
  loading = true;

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.fetchVehicles();
  }

  fetchVehicles(): void {
    this.http.get<Vehicle[]>(`${environment.apiUrl}/all-vehicles`).subscribe({
      next: (vehicles) => {
        this.vehicleIssues = vehicles.map(vehicle => ({
          vehicle_id: vehicle.id,
          plate: vehicle.plate_number,
          dirty: false,
          fuel_checked: false,
          items_left: false,
          critical_issue: false
        }));
        this.loading = false;
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת רכבים', 'error');
        this.loading = false;
      }
    });
  }

  submitIssues(): void {
    const dirtyIds = this.vehicleIssues.filter(v => v.dirty).map(v => v.vehicle_id);
    const itemsLeftIds = this.vehicleIssues.filter(v => v.items_left).map(v => v.vehicle_id);
    const criticalIds = this.vehicleIssues.filter(v => v.critical_issue).map(v => v.vehicle_id);

    const fuelCheckedAll = this.vehicleIssues.every(v => v.fuel_checked);
    const cleanAll = this.vehicleIssues.every(v => !v.dirty);
    const itemsLeftNone = this.vehicleIssues.every(v => !v.items_left);
    const hasCritical = criticalIds.length > 0;

    const payload = {
      clean: cleanAll,
      fuel_checked: fuelCheckedAll,
      no_items_left: itemsLeftNone,
      critical_issue_bool: hasCritical,
      issues_found: hasCritical ? this.issues_found.trim() : null,
      inspected_by: localStorage.getItem('employee_id'),
      dirty_vehicle_ids: dirtyIds,
      items_left_vehicle_ids: itemsLeftIds,
      critical_issue_vehicle_ids: criticalIds
    };

    if (hasCritical && !this.issues_found.trim()) {
      this.toastService.show('יש למלא תיאור של האירוע החריג', 'error');
      return;
    }

    this.http.post(`${environment.apiUrl}/vehicle-inspections`, payload).subscribe({
      next: () => {
        console.log('Issues submitted successfully:', payload);
        this.toastService.show('הבעיות נשלחו בהצלחה', 'success');
        this.router.navigate(['/inspector/inspection']);
      },
      error: () => {
        this.toastService.show('שליחה נכשלה', 'error');
      }
    });
  }
  hasCriticalIssue(): boolean {
  return this.vehicleIssues?.some(v => v.critical_issue) ?? false;
}

}
