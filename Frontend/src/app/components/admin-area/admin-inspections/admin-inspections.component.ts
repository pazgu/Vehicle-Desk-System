import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-admin-inspections',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-inspections.component.html',
  styleUrls: ['./admin-inspections.component.css']
})
export class AdminInspectionsComponent implements OnInit {
  inspections: any[] = [];
  loading = true;
  highlighted = false;

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private socketService: SocketService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Highlight row if query param exists
    this.route.queryParams.subscribe(params => {
      this.highlighted = params['highlight'] === '1';
    });

    // 🔁 Load inspections on component mount
    this.loadInspections();

    // 🔔 Listen for critical notifications via socket
    this.socketService.notifications$.subscribe((notif) => {
      if (notif?.message?.includes('בעיה חמורה')) {
        this.toastService.show('📢 בדיקה חדשה עם בעיה חמורה התקבלה', 'error');
        new Audio('assets/sounds/notif.mp3').play();
        this.loadInspections(); // Re-fetch
      }
    });

      // ✅ 🔌 Listen for new inspections (no refresh needed)
      this.socketService.newInspection$.subscribe((newInspection) => {
        if (newInspection) {
          console.log('🆕 Received inspection via socket:', newInspection);
          this.inspections.unshift(newInspection);
          this.cdr.detectChanges();
          this.toastService.show('📢 התקבלה בדיקה חדשה');
          new Audio('assets/sounds/notif.mp3').play();
        }
    });
  }

  private loadInspections(): void {
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
}
