import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RideService } from '../../services/ride.service';
import { ToastService } from '../../services/toast.service';
import { SocketService } from '../../services/socket.service';
import { CityService } from '../../services/city.service';

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
  cityMap: { [id: string]: string } = {};


  constructor(
    private route: ActivatedRoute,
    private rideService: RideService,
    private toastService: ToastService,
    private router: Router,
    private socketService: SocketService,
    private cityService: CityService  
  ) {}

  ngOnInit(): void {
    this.rideId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.rideId) {
      this.toastService.show('שגיאה בטעינת פרטי הנסיעה', 'error');
      return;
    }

  // 👇 Load cities and build ID → Name map
  this.cityService.getCities().subscribe({
    next: (cities) => {
      this.cityMap = cities.reduce((map, city) => {
        map[city.id] = city.name;
        return map;
      }, {} as { [id: string]: string });
    },
    error: () => {
      this.toastService.show('שגיאה בטעינת רשימת ערים', 'error');
    }
  });

  // ✅ Load ride details
  this.rideService.getRideById(this.rideId).subscribe({
    next: (res) => {
      this.ride = res;
    },
    error: () => {
      this.toastService.show('שגיאה בטעינת פרטי הנסיעה', 'error');
    }
  });
     // ✅ Socket: react to new ride request while on this page
   
  
  }
canStartRide(): boolean {
  if (!this.ride) return false;

  const now = new Date();
  const startTime = new Date(this.ride.start_datetime);

  return this.ride.status === 'approved' && startTime <= now;
}
isRideLongerThanOneDay(): boolean {
  if (!this.ride?.start_datetime || !this.ride?.end_datetime) return false;
  
  const startDate = new Date(this.ride.start_datetime);
  const endDate = new Date(this.ride.end_datetime);
  
  // Compare only the date part (ignore time)
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  
  return endDay > startDay;
}

  startRide() {
  if (!this.ride) return;

  this.rideService.startRide(this.ride.ride_id).subscribe({
    next: (updatedRide) => {
      this.ride = updatedRide;
      this.toastService.show('הנסיעה החלה בהצלחה! 🚗', 'success');
    },
    error: (err) => {
      console.error('Error starting ride:', err);
      this.toastService.show('שגיאה בהתחלת הנסיעה ❌', 'error');
    }
  });
}

  getCityName(cityId: string): string {
  return this.cityMap[cityId] || 'לא ידוע';
}


  goBack(): void {
  this.router.navigate(['/all-rides']);
}
}
