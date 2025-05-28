import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RideService } from '../../services/ride.service';
import { ToastService } from '../../services/toast.service';
import { Router, RouterModule } from '@angular/router';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-archived-orders',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './archived-orders.component.html',
  styleUrls: ['./archived-orders.component.css']
})
export class ArchivedOrdersComponent implements OnInit {
  archivedOrders: any[] = [];
  loading = true;

  constructor(
    private rideService: RideService,
    private toastService: ToastService,
    private router: Router,
    private socketService: SocketService 
  ) {}

  ngOnInit(): void {
  const userId = localStorage.getItem('employee_id');

  if (!userId) {
    this.toastService.show('משתמש לא נמצא', 'error');
    this.loading = false;
    return;
  }

  this.rideService.getArchivedOrders(userId).subscribe({
    next: (data: any[]) => {
      this.archivedOrders = data;
      this.loading = false;
    },
    error: () => {
      this.toastService.show('שגיאה בטעינת ההזמנות מהארכיון', 'error');
      this.loading = false;
    }
  });

   // ✅ Listen for new ride requests
    this.socketService.rideRequests$.subscribe((rideData) => {
      if (rideData) {
        this.toastService.show('🚗 התקבלה הזמנת נסיעה חדשה', 'success');

        // Optional sound effect
        const audio = new Audio('assets/sounds/notif.mp3');
        audio.play();

        // Optional: Re-fetch data if needed (not always relevant for archived view)
        // this.rideService.getArchivedOrders(userId).subscribe(...);
      }
    });
  
}


  viewRide(order: any) {
    this.router.navigate(['/ride-details', order.ride_id]);
  }


  goBack() {
  this.router.navigate(['/home']);
}

}
