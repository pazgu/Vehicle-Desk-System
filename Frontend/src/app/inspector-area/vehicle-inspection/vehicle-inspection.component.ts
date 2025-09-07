import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { ToastService } from '../../services/toast.service';
import { InspectionService } from '../../services/inspection.service';
import { VehicleService } from '../../services/vehicle.service';
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
  issues_found?: string;
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
  searchTerm: string = '';      // ← new

  loading = true;
  submitting = false;
  formSubmitted = false;
  noVehiclesAvailable = false;
  @ViewChild('bottom') bottomRef!: ElementRef;

  scrollToBottom(): void {
    this.bottomRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }
  constructor(
    private http: HttpClient,
    private router: Router,
    private toastService: ToastService,
    private InspectorService: InspectionService,
    private vehicleService:VehicleService

  ) {}

  ngOnInit(): void {
    this.fetchVehicles();
  }
   get filteredIssues(): VehicleIssue[] {
    if (!this.searchTerm) {
      return this.vehicleIssues;
    }
    const term = this.searchTerm.trim().toLowerCase();
    return this.vehicleIssues.filter(issue =>
      issue.plate.toLowerCase().includes(term)
    );
  }

fetchVehicles(): void {
  const params = new HttpParams().set('status', 'available');

  this.http.get<Vehicle[]>(`${environment.apiUrl}/all-vehicles`, { params }).subscribe({
    next: (vehicles) => {
      if (vehicles.length === 0) {
        this.noVehiclesAvailable = true;
        this.vehicleIssues = [];
      } else {
        this.noVehiclesAvailable = false;
        this.vehicleIssues = vehicles.map(vehicle => ({
          vehicle_id: vehicle.id,
          plate: vehicle.plate_number,
          dirty: false,
          fuel_checked: false,
          items_left: false,
          critical_issue: false
        }));
      }
      this.loading = false;
    },
    error: () => {
      this.toastService.show('שגיאה בטעינת רכבים', 'error');
      this.loading = false;
    }
  });
}
  // ← הוסף את 2 הפונקציות האלה
resetForm(): void {
  this.vehicleIssues.forEach(vehicle => {
    vehicle.dirty = false;
    vehicle.fuel_checked = false;
    vehicle.items_left = false;
    vehicle.critical_issue = false;
    vehicle.issues_found = '';
  });
  this.searchTerm = '';
  this.formSubmitted = false;
}

openNewForm(): void {
  this.resetForm();
  this.fetchVehicles();
}
  submitIssues(): void {
      const nothingSelected = this.vehicleIssues.every(v =>
    !v.dirty &&
    !v.fuel_checked &&
    !v.items_left &&
    !v.critical_issue
  );

  if (nothingSelected) {
    this.toastService.show('לא נבחרה אף בעיה לרכב. יש לבחור לפחות שדה אחד לפני השליחה.','error');
    return; // Stop submission
  }

    this.submitting = true;

    const dirtyIds = this.vehicleIssues.filter(v => v.dirty).map(v => v.vehicle_id);
    const itemsLeftIds = this.vehicleIssues.filter(v => v.items_left).map(v => v.vehicle_id);
    const criticalIds = this.vehicleIssues.filter(v => v.critical_issue).map(v => v.vehicle_id);

    const unfueledVehicleIds = this.vehicleIssues
  .filter(v => v.fuel_checked)
  .map(v => v.vehicle_id);

    const cleanAll = this.vehicleIssues.every(v => !v.dirty);
    const itemsLeftNone = this.vehicleIssues.every(v => !v.items_left);
    const hasCritical = criticalIds.length > 0;

    const payload = {
      unfueled_vehicle_ids: unfueledVehicleIds,
      issues_found: this.vehicleIssues
        .filter(v => v.critical_issue && v.issues_found?.trim())
        .map(v => ({
          vehicle_id: v.vehicle_id,
          issue_found: v.issues_found?.trim() || ''
        }))
,
      inspected_by: localStorage.getItem('employee_id'),
      dirty_vehicle_ids: dirtyIds,
      items_left_vehicle_ids: itemsLeftIds,
      critical_issue_vehicle_ids: criticalIds
    };
console.log('inspection data in front:', JSON.stringify(payload, null, 2));
    const missingDescriptions = this.vehicleIssues.some(
    v => v.critical_issue && (!v.issues_found || !v.issues_found) // (redundant check)
);

if (missingDescriptions) {
  this.toastService.show('יש למלא תיאור של האירוע החריג לכל רכב רלוונטי', 'error');
  this.submitting = false; 
  return;
}



  this.InspectorService.postInspection(payload).subscribe({
  next: () => {
    this.toastService.show('הבדיקה נשלחה בהצלחה', 'success');
    this.submitting = false;
    this.formSubmitted = true;
    window.scrollTo(0, 0);
    const criticalVehicles = this.vehicleIssues.filter(v => v.critical_issue);

    criticalVehicles.forEach(vehicle => {
      this.vehicleService.updateVehicleStatus(
        vehicle.vehicle_id,
        'frozen',
        'maintenance'
      ).subscribe({
        next: () => console.log(`Vehicle frozen`),
        error: err => console.error(`Failed to freeze vehicle `, err)
      });
    });
      this.resetFormState();


  },
  error: (err) => {
    console.error('❌ Failed to save inspection:', err);
    this.toastService.show('שליחה נכשלה', 'error');
          this.submitting = false;

  }
});

  }
  hasCriticalIssue(): boolean {
  return this.vehicleIssues?.some(v => v.critical_issue) ?? false;
}

private resetFormState(): void {
  this.vehicleIssues = this.vehicleIssues.map(v => ({
    ...v,
    dirty: false,
    fuel_checked: false,
    items_left: false,
    critical_issue: false,
    issues_found: ''
  }));
  this.searchTerm = '';
}


}
