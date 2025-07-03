// src/app/admin/components/admin-inspections/admin-inspections.component.ts

import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';
import { FormsModule } from '@angular/forms'; // Ensure FormsModule is imported for ngModel
import { CriticalIssue } from '../../../models/critical-issue.model';


@Component({
  selector: 'app-admin-inspections',
  standalone: true,
  imports: [CommonModule, FormsModule], // Ensure FormsModule is here
  templateUrl: './admin-inspections.component.html',
  styleUrls: ['./admin-inspections.component.css']
})
export class AdminInspectionsComponent implements OnInit {
  inspections: (CriticalIssue | any)[] = [];
  loading = true;
  highlighted = false;
  showProblematicFilters = false;
  showMediumIssues = false;
  showCriticalIssues = false;

  private lastInspectionId: string | null = null;
  isCriticalMode = false;
  selectedIssue: CriticalIssue | null = null;



  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private socketService: SocketService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {

     // Detect mode via route path
  const currentPath = this.route.snapshot.routeConfig?.path;
  this.isCriticalMode = currentPath === 'admin/critical-issues';
    // ✅ Highlight row if query param exists
    this.route.queryParams.subscribe(params => {
      this.highlighted = params['highlight'] === '1';
    });

    // ✅ Load inspections on mount
    this.loadInspections();

    // 🔔 Listen for critical inspection notifications
    this.socketService.notifications$.subscribe((notif) => {
      if (notif?.message?.includes('בעיה חמורה')) {
        this.toastService.show('📢 בדיקה חדשה עם בעיה חמורה התקבלה', 'error');
        this.playAlertSound();
        this.loadInspections(); // Refresh data
      }
    });

    // 🔄 Listen for new inspection events (no refresh)
    this.socketService.newInspection$.subscribe((newInspection) => {
      if (
        newInspection &&
        newInspection.inspection_id !== this.lastInspectionId
      ) {
        console.log('🆕 Received inspection via socket:', newInspection);

        this.lastInspectionId = newInspection.inspection_id;
        // Important: If a new inspection arrives, it should respect current filters
        // If filters are active, you might need to re-evaluate if newInspection matches
        // For simplicity, just adding it to the list for now, but a full re-load
        // `this.loadInspections();` might be safer if filtering logic is complex
        // and needs to be strictly applied on new data.
        this.inspections.unshift(newInspection);
        this.cdr.detectChanges(); // Manually trigger change detection for unshift

        this.toastService.show('📢 התקבלה בדיקה חדשה');
        this.playAlertSound();
      }
    });
  }

  private mapCriticalIssues(raw: any[]): CriticalIssue[] {
  return raw.map(item => ({
    timestamp: item.timestamp,
    source_type: item.source_type,
    responsible_user: item.responsible_user,
    vehicle_info: item.vehicle_info || '',
    issue_summary: item.issue_summary
  }));
}

loadInspections(): void {
  this.loading = true;

  let url = this.isCriticalMode
    ? `${environment.apiUrl}/critical-issues`
    : `${environment.apiUrl}/inspections/today`;

  let params = new HttpParams();

  if (!this.isCriticalMode && this.showProblematicFilters && (this.showMediumIssues || this.showCriticalIssues)) {
    if (this.showMediumIssues && !this.showCriticalIssues) {
      params = params.set('problem_type', 'medium');
    } else if (!this.showMediumIssues && this.showCriticalIssues) {
      params = params.set('problem_type', 'critical');
    } else if (this.showMediumIssues && this.showCriticalIssues) {
      params = params.set('problem_type', 'medium,critical');
    }
  }

  this.http.get<any[]>(url, { params }).subscribe({
    next: (data) => {
      this.inspections = this.isCriticalMode ? this.mapCriticalIssues(data) : data;
      this.loading = false;
    },
    error: () => {
      this.loading = false;
      const errText = this.isCriticalMode
        ? 'שגיאה בטעינת רשימת החריגות'
        : 'שגיאה בטעינת בדיקות רכבים להיום';
      this.toastService.show(`❌ ${errText}`, 'error');
    }
  });
}


  // New helper method: checks if any problematic issue filter checkboxes are actually selected
  // This is different from `showProblematicFilters` which only toggles the visibility of the checkboxes.
  anyFiltersSelected(): boolean {
    return this.showProblematicFilters && (this.showMediumIssues || this.showCriticalIssues);
  }

  // ✅ Notification sound for new inspections
  private playAlertSound(): void {
    const audio = new Audio('assets/sounds/notif.mp3');
    audio.play().catch(err => {
      // Chrome may block this if user hasn't interacted yet (expected behavior)
      console.warn('🔇 Audio failed to play (autoplay policy):', err);
    });
  }
}