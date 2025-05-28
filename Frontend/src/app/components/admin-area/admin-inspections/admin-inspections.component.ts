import { Component, OnInit } from '@angular/core';
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

  constructor(private http: HttpClient, private route: ActivatedRoute ,   private socketService: SocketService,
  private toastService: ToastService
) {}

highlighted = false;

ngOnInit(): void {
  this.route.queryParams.subscribe(params => {
    this.highlighted = params['highlight'] === '1';
  });

  // 🔹 1. Initial load of inspections on page entry
  this.http.get<any[]>(`${environment.apiUrl}/inspections/today`).subscribe({
    next: (data) => {
      this.inspections = data;
      this.loading = false;
    },
    error: () => {
      this.loading = false;
      alert('שגיאה בטעינת בדיקות רכבים להיום');
    }
  });

  // 🔹 2. Listen for critical inspections via socket
  this.socketService.notifications$.subscribe((notif) => {
    if (notif && notif.message.includes('בעיה חמורה')) {
this.toastService.show('📢 בדיקה חדשה עם בעיה חמורה התקבלה', 'error'); // <-- changed from 'warning'

      const audio = new Audio('assets/sounds/notif.mp3');
      audio.play();

      // Re-fetch inspections from backend
      this.http.get<any[]>(`${environment.apiUrl}/inspections/today`).subscribe({
        next: (data) => {
          this.inspections = data;
          console.log('🔁 Inspections updated from socket event');
        },
        error: () => {
          this.toastService.show('❌ שגיאה ברענון הבדיקות', 'error');
        }
      });
    }
  });
}
}
