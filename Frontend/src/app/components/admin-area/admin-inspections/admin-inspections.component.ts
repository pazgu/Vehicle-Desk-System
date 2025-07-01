// src/app/admin/components/admin-inspections/admin-inspections.component.ts

import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';
import { FormsModule } from '@angular/forms'; // Ensure FormsModule is imported for ngModel

@Component({
  selector: 'app-admin-inspections',
  standalone: true,
  imports: [CommonModule, FormsModule], // Ensure FormsModule is here
  templateUrl: './admin-inspections.component.html',
  styleUrls: ['./admin-inspections.component.css']
})
export class AdminInspectionsComponent implements OnInit {
  inspections: any[] = [];
  loading = true;
  highlighted = false;
  showProblematicFilters = false;
  showMediumIssues = false;
  showCriticalIssues = false;

  private lastInspectionId: string | null = null;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private socketService: SocketService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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

  loadInspections(): void {
    this.loading = true;

    let params = new HttpParams();
    // Only add problem_type param if the problematic filters are visible AND
    // at least one of the specific issue types is selected.
    if (this.showProblematicFilters && (this.showMediumIssues || this.showCriticalIssues)) {
      if (this.showMediumIssues && !this.showCriticalIssues) {
        params = params.set('problem_type', 'medium');
      } else if (!this.showMediumIssues && this.showCriticalIssues) {
        params = params.set('problem_type', 'critical');
      } else if (this.showMediumIssues && this.showCriticalIssues) {
        params = params.set('problem_type', 'medium,critical');
      }
    }
    // If showProblematicFilters is false, or if it's true but no sub-checkboxes are selected,
    // then 'params' will remain empty, and the backend will return all inspections.

    this.http.get<any[]>(`${environment.apiUrl}/inspections/today`, { params }).subscribe({
      next: (data) => {
        this.inspections = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toastService.show('❌ שגיאה בטעינת בדיקות רכבים להיום', 'error');
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