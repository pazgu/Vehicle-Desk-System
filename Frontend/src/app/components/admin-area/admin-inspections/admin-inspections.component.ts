import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-admin-inspections',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
        this.inspections.unshift(newInspection);
        this.cdr.detectChanges();

        this.toastService.show('📢 התקבלה בדיקה חדשה');
        this.playAlertSound();
      }
    });
  }

  loadInspections(): void {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/inspections/today`).subscribe({
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

  // ✅ Notification sound for new inspections
  private playAlertSound(): void {
    const audio = new Audio('assets/sounds/notif.mp3');
    audio.play().catch(err => {
      // Chrome may block this if user hasn't interacted yet (expected behavior)
      console.warn('🔇 Audio failed to play (autoplay policy):', err);
    });
  }
}
