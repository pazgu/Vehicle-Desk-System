// // src/app/admin/components/admin-inspections/admin-inspections.component.ts

// import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { HttpClient, HttpParams } from '@angular/common/http';
// import { environment } from '../../../../environments/environment';
// import { ActivatedRoute } from '@angular/router';
// import { SocketService } from '../../../services/socket.service';
// import { ToastService } from '../../../services/toast.service';
// import { FormsModule } from '@angular/forms'; // Ensure FormsModule is imported for ngModel
// import { CriticalIssue } from '../../../models/critical-issue.model';
// import { RawCriticalIssue } from '../../../models/raw-critical-issue.model'; // add this line



// @Component({
//   selector: 'app-admin-inspections',
//   standalone: true,
//   imports: [CommonModule, FormsModule], // Ensure FormsModule is here
//   templateUrl: './admin-inspections.component.html',
//   styleUrls: ['./admin-inspections.component.css']
// })
// export class AdminInspectionsComponent implements OnInit {
//   inspections: (CriticalIssue | any)[] = [];
//   loading = true;
//   highlighted = false;
//   showProblematicFilters = false;
//   showMediumIssues = false;
//   showCriticalIssues = false;

//   private lastInspectionId: string | null = null;
//   isCriticalMode = false;
//   selectedIssue: CriticalIssue | null = null;
//   selectedIssueDetails: any = null;




//   constructor(
//     private http: HttpClient,
//     private route: ActivatedRoute,
//     private socketService: SocketService,
//     private toastService: ToastService,
//     private cdr: ChangeDetectorRef
//   ) {}

//   ngOnInit(): void {

//      // Detect mode via route path
//   const currentPath = this.route.snapshot.routeConfig?.path;
//   this.isCriticalMode = currentPath === 'admin/critical-issues';
//   console.log('is critical in nginit is:',this.isCriticalMode)
//     // ✅ Highlight row if query param exists
//     this.route.queryParams.subscribe(params => {
//       this.highlighted = params['highlight'] === '1';
//     });

//     // ✅ Load inspections on mount
//     this.loadInspections();


//     // 🔔 Listen for critical inspection notifications
//     this.socketService.notifications$.subscribe((notif) => {
//       if (notif?.message?.includes('בעיה חמורה')) {
//         this.toastService.show('📢 בדיקה חדשה עם בעיה חמורה התקבלה', 'error');
//         this.playAlertSound();
//         this.loadInspections(); // Refresh data
//       }
//     });

//     // 🔄 Listen for new inspection events (no refresh)
//     this.socketService.newInspection$.subscribe((newInspection) => {
//       if (
//         newInspection &&
//         newInspection.inspection_id !== this.lastInspectionId
//       ) {
//         console.log('🆕 Received inspection via socket:', newInspection);

//         this.lastInspectionId = newInspection.inspection_id;
//         // Important: If a new inspection arrives, it should respect current filters
//         // If filters are active, you might need to re-evaluate if newInspection matches
//         // For simplicity, just adding it to the list for now, but a full re-load
//         // `this.loadInspections();` might be safer if filtering logic is complex
//         // and needs to be strictly applied on new data.
//         console.log('🚨 Incoming newInspection data:', newInspection);

//         const mapped = this.isCriticalMode ? this.mapCriticalIssues([newInspection])[0] : newInspection;
//         this.inspections.unshift(mapped);
//         this.cdr.detectChanges(); // Manually trigger change detection for unshift

//         this.toastService.show('📢 התקבלה בדיקה חדשה');
//         this.playAlertSound();
//       }
//     });
//   }
// private mapCriticalIssues(raw: RawCriticalIssue[]): CriticalIssue[] {
//   return raw
//     .map(item => {
//           let id: string;

//           if (item.inspection_id) {
//             id = item.inspection_id;
//           } else if (item.ride_id) {
//             id = item.ride_id;
//           } else {
//             // Invalid item — skip it, don't include it in the mapped array
//             return null as any;
//           }
//        let source_type: 'Inspector' | 'Trip Completion';

//       if (item.role === 'inspector' || item.inspection_id) {
//         source_type = 'Inspector';
//       }
//       else {
//         source_type = item.role === 'inspector' ? 'Inspector' : 'Trip Completion';
//       }

//   const mappedItem: CriticalIssue = {
//   id: item.inspection_id || `${item.approved_by ?? item.submitted_by}-${item.timestamp}`,
//   timestamp: item.timestamp,
//   source_type: item.role === 'inspector' || item.type === 'inspector' ? 'Inspector' : 'Trip Completion',
//   responsible_user: item.approved_by || item.submitted_by || 'לא ידוע',
//   vehicle_info: item.vehicle_info || item.vehicle_id || '',
//   issue_summary: item.issue_description || item.issue_text || 'אין תיאור',
// };

// if (item.inspection_id) {
//   mappedItem.inspection_id = item.inspection_id;
// }
// if (item.ride_id) {
//   mappedItem.ride_id = item.ride_id;
// }


//       // Only add optional properties if they exist
//       if (item.inspection_id) {
//         mappedItem.inspection_id = item.inspection_id;
//       }
//       if (item.ride_id) {
//         mappedItem.ride_id = item.ride_id;
//       }

//       return mappedItem;
//     })
//     .filter(item => item !== null); // Remove the type predicate since we're not filtering out any items
// }




// loadInspections(): void {
//   this.loading = true;

//   let url = this.isCriticalMode
//     ? `${environment.apiUrl}/critical-issues`
//     : `${environment.apiUrl}/inspections/today`;

//   let params = new HttpParams();

//   if (!this.isCriticalMode && this.showProblematicFilters && (this.showMediumIssues || this.showCriticalIssues)) {
//     if (this.showMediumIssues && !this.showCriticalIssues) {
//       params = params.set('problem_type', 'medium');
//     } else if (!this.showMediumIssues && this.showCriticalIssues) {
//       params = params.set('problem_type', 'critical');
//     } else if (this.showMediumIssues && this.showCriticalIssues) {
//       params = params.set('problem_type', 'medium,critical');
//     }
//   }

// this.http.get<RawCriticalIssue[]>(url, { params }).subscribe({
//   next: (data) => {
//     console.log('📦 Raw API data for issues:', data);
//     this.inspections = this.isCriticalMode ? this.mapCriticalIssues(data) : data;
//     console.log('📊 After mapping:', this.inspections);
//     this.loading = false;
//   },
//     error: () => {
//       this.loading = false;
//       const errText = this.isCriticalMode
//         ? 'שגיאה בטעינת רשימת החריגות'
//         : 'שגיאה בטעינת בדיקות רכבים להיום';
//       this.toastService.show(`❌ ${errText}`, 'error');
//     }
//   });
// }


//   // New helper method: checks if any problematic issue filter checkboxes are actually selected
//   // This is different from `showProblematicFilters` which only toggles the visibility of the checkboxes.
//   anyFiltersSelected(): boolean {
//     return this.showProblematicFilters && (this.showMediumIssues || this.showCriticalIssues);
//   }

//   // ✅ Notification sound for new inspections
//   private playAlertSound(): void {
//     const audio = new Audio('assets/sounds/notif.mp3');
//     audio.play().catch(err => {
//       // Chrome may block this if user hasn't interacted yet (expected behavior)
//       console.warn('🔇 Audio failed to play (autoplay policy):', err);
//     });
//   }

// loadIssueDetails(issue: any): void {
//   const id = issue?.id;
//   console.log('🆔 issue id to load details:', id, issue); // 👈 debug log

//   if (!id) {
//     this.toastService.show("❌ לא ניתן לפתוח את החריגה - מזהה חסר", 'error');
//     return;
//   }

//   this.http.get(`${environment.apiUrl}/critical-issues/${id}`).subscribe({

//     next: (data) => {
//       console.log("issues from backend:",data)
//       this.selectedIssueDetails = data;
//     },
//     error: () => {
//       this.toastService.show("❌ שגיאה בטעינת פרטי חריגה", 'error');
//     }
//   });
// }

// openIssueDetails(issue: any): void {
//   this.loadIssueDetails(issue);
// }



// }


import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';
import { FormsModule } from '@angular/forms';
import { VehicleInspection } from '../../../models/vehicle-inspections.model';
import { OrderCardItem } from '../../../models/order-card-item.module';

@Component({
  selector: 'app-admin-inspections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-inspections.component.html',
  styleUrls: ['./admin-inspections.component.css']
})
export class AdminInspectionsComponent implements OnInit {
  inspections: VehicleInspection[] = [];
  rides: OrderCardItem[] = [];
  loading = true;
  showProblematicFilters = false;
  showMediumIssues = false;
  showCriticalIssues = false;
  filteredInspections: VehicleInspection[] = [];

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private socketService: SocketService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    const url = `${environment.apiUrl}/critical-issues`;
    let params = new HttpParams();

    // Add problem_type param based on selected checkboxes
    if (this.showProblematicFilters && (this.showMediumIssues || this.showCriticalIssues)) {
      if (this.showMediumIssues && !this.showCriticalIssues) {
        params = params.set('problem_type', 'medium');
      } else if (!this.showMediumIssues && this.showCriticalIssues) {
        params = params.set('problem_type', 'critical');
      } else if (this.showMediumIssues && this.showCriticalIssues) {
        params = params.set('problem_type', 'medium,critical');
      }
    }

    this.http.get<{ inspections: VehicleInspection[]; rides: OrderCardItem[] }>(url, { params }).subscribe({
      next: (data) => {
        this.inspections = data.inspections || [];
        this.rides = data.rides || [];
        this.applyInspectionFilters(); // Apply filters after data is loaded
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.toastService.show('❌ שגיאה בטעינת נתונים', 'error');
      }
    });
  }

  applyInspectionFilters(): void {
    // If showProblematicFilters is false (meaning the filter section is hidden)
    // or if both checkboxes are unchecked, then display all original inspections.
    if (!this.showProblematicFilters || (!this.showMediumIssues && !this.showCriticalIssues)) {
      this.filteredInspections = [...this.inspections]; // Reset to all original inspections
      return;
    }

    this.filteredInspections = this.inspections.filter(insp => {
      const hasMediumIssue = insp.issues_found && insp.issues_found.toLowerCase().includes('medium'); // Assuming 'medium' is in issues_found
      const hasCriticalIssue = insp.critical_issue_bool;

      if (this.showMediumIssues && this.showCriticalIssues) {
        return hasMediumIssue || hasCriticalIssue;
      } else if (this.showMediumIssues) {
        return hasMediumIssue;
      } else if (this.showCriticalIssues) {
        return hasCriticalIssue;
      }
      return false; // Should not be reached if conditions above handle all cases
    });
  }
}