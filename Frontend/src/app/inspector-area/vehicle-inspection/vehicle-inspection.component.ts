import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';

import { environment } from '../../../environments/environment';
import { ToastService } from '../../services/toast.service';
import { InspectionService } from '../../services/inspection.service';
import { VehicleService } from '../../services/vehicle.service';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

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
  styleUrls: ['./vehicle-inspection.component.css'],
})
export class VehicleInspectionComponent implements OnInit {
  vehicleIssues: VehicleIssue[] = [];
  issues_found: string = '';
  searchTerm: string = '';

  loading = true;
  submitting = false;
  formSubmitted = false;
  noVehiclesAvailable = false;
  showScrollArrow = false;

  @ViewChild('bottom') bottomRef!: ElementRef;

  scrollToBottom(): void {
    this.bottomRef.nativeElement.scrollIntoView({ behavior: 'smooth' });
  }

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastService: ToastService,
    private InspectorService: InspectionService,
    private vehicleService: VehicleService
  ) {}

  ngOnInit(): void {
    this.fetchVehicles();
  }

  get filteredIssues(): VehicleIssue[] {
    if (!this.searchTerm) {
      return this.vehicleIssues;
    }
    const term = this.searchTerm.trim().toLowerCase();
    return this.vehicleIssues.filter((issue) =>
      issue.plate.toLowerCase().includes(term)
    );
  }

  fetchVehicles(): void {
    const params = new HttpParams().set('status', 'available');

    this.http
      .get<Vehicle[]>(`${environment.apiUrl}/all-vehicles`, { params })
      .subscribe({
        next: (vehicles) => {
          if (vehicles.length === 0) {
            this.noVehiclesAvailable = true;
            this.vehicleIssues = [];
            this.showScrollArrow = false;
          } else {
            this.noVehiclesAvailable = false;

            this.vehicleIssues = vehicles.map((vehicle) => ({
              vehicle_id: vehicle.id,
              plate: vehicle.plate_number,
              dirty: false,
              fuel_checked: false,
              items_left: false,
              critical_issue: false,
            }));
          }
          this.loading = false;
          setTimeout(() => this.updateArrowVisibility(), 0);
        },
        error: () => {
          this.toastService.show('שגיאה בטעינת רכבים', 'error');
          this.loading = false;
        },
      });
  }

  onSearchTermChange(): void {
    setTimeout(() => this.updateArrowVisibility(), 0);
  }

  resetForm(): void {
    this.vehicleIssues.forEach((vehicle) => {
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
    document.body.style.overflow = 'auto';
    this.resetForm();
    this.fetchVehicles();
  }

  submitIssues(): void {
    const inspectedVehicles = this.vehicleIssues.filter(
      (v) => v.dirty || v.fuel_checked || v.items_left || v.critical_issue
    );

    if (inspectedVehicles.length === 0) {
      this.toastService.show(
        'לא נבחרה אף בעיה לרכב. יש לבחור לפחות שדה אחד לפני השליחה.',
        'error'
      );
      return;
    }

    const missingDescriptions = inspectedVehicles.some(
      (v) =>
        v.critical_issue && (!v.issues_found || v.issues_found.trim() === '')
    );
    if (missingDescriptions) {
      this.toastService.show(
        'יש למלא תיאור של האירוע החריג לכל רכב רלוונטי',
        'error'
      );
      return;
    }

    this.submitting = true;
    const requests = inspectedVehicles.map((v) => {
      const payload = {
        inspected_by: localStorage.getItem('employee_id'),
        vehicle_id: v.vehicle_id,
        is_clean: !v.dirty,
        is_unfueled: v.fuel_checked,
        has_items_left: v.items_left,
        has_critical_issue: v.critical_issue,
        issues_found: v.issues_found?.trim() || '',
      };

      return this.InspectorService.postInspection(payload).pipe(
        catchError(() => {
          console.error(`שגיאה בשליחת הטופס`);
          return of(null);
        })
      );
    });

    forkJoin(requests)
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (responses) => {
          const successfulCount = responses.filter(
            (res) => res !== null
          ).length;
          if (successfulCount > 0) {
            this.toastService.show('הבדיקות נשלחו בהצלחה', 'success');
            this.formSubmitted = true;
            window.scrollTo(0, 0);
            document.body.style.overflow = 'hidden';

            const criticalVehicles = inspectedVehicles.filter(
              (v) => v.critical_issue
            );
            criticalVehicles.forEach((vehicle) => {
              this.vehicleService
                .updateVehicleStatus(
                  vehicle.vehicle_id,
                  'frozen',
                  'maintenance'
                )
                .subscribe({});
            });
          }
        },
        error: () => {
          this.toastService.show('שליחה נכשלה עבור חלק מהרכבים', 'error');
        },
      });
  }

  hasCriticalIssue(): boolean {
    return this.vehicleIssues?.some((v) => v.critical_issue) ?? false;
  }

  private resetFormState(): void {
    this.vehicleIssues = this.vehicleIssues.map((v) => ({
      ...v,
      dirty: false,
      fuel_checked: false,
      items_left: false,
      critical_issue: false,
      issues_found: '',
    }));
    this.searchTerm = '';
  }

  updateArrowVisibility(): void {
    if (this.formSubmitted || this.noVehiclesAvailable) {
      this.showScrollArrow = false;
      return;
    }

    if (!this.bottomRef) {
      this.showScrollArrow = false;
      return;
    }

    const rect = this.bottomRef.nativeElement.getBoundingClientRect();
    const viewportHeight =
      window.innerHeight || document.documentElement.clientHeight;
    this.showScrollArrow = rect.bottom > viewportHeight - 20;
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  @HostListener('window:load')
  onWindowEvent(): void {
    this.updateArrowVisibility();
  }
}
