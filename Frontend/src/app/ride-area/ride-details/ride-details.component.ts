import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RideService } from '../../services/ride.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-ride-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ride-details.component.html',
  styleUrls: ['./ride-details.component.css']
})
export class RideDetailsComponent implements OnInit {
  rideId: string = '';
  ride: any;

  constructor(
    private route: ActivatedRoute,
    private rideService: RideService,
    private toastService: ToastService,
    private router: Router 
  ) {}

  ngOnInit(): void {
    this.rideId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.rideId) {
      this.toastService.show('שגיאה בטעינת פרטי הנסיעה', 'error');
      return;
    }

    this.rideService.getRideById(this.rideId).subscribe({
      next: (res) => {
        this.ride = res;
        console.log('📄 Ride details:', res);
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת פרטי הנסיעה', 'error');
      }
    });
  }

  goBack(): void {
  this.router.navigate(['/home']);
}
}
