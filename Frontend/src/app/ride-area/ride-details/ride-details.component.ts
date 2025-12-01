import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { RideService } from '../../services/ride.service';
import { ToastService } from '../../services/toast.service';
import { CityService } from '../../services/city.service';

@Component({
  selector: 'app-ride-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ride-details.component.html',
  styleUrls: ['./ride-details.component.css'],
})
export class RideDetailsComponent implements OnInit {
  ride: any;
  cityMap: { [id: string]: string } = {};
  loading: boolean = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { rideId: string },
    private dialogRef: MatDialogRef<RideDetailsComponent>,
    private rideService: RideService,
    private toastService: ToastService,
    private cityService: CityService
  ) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadRideDetails();
  }

  private loadCities(): void {
    this.cityService.getCities().subscribe({
      next: (cities) => {
        this.cityMap = cities.reduce((map, city) => {
          map[city.id] = city.name;
          return map;
        }, {} as { [id: string]: string });
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת רשימת ערים', 'error');
      },
    });
  }

  private loadRideDetails(): void {
    this.rideService.getRideById(this.data.rideId).subscribe({
      next: (res) => {
        this.ride = res;
        this.loading = false;
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת פרטי הנסיעה', 'error');
        this.loading = false;
        this.dialogRef.close();
      },
    });
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

    const startDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    );
    const endDay = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    );

    return endDay > startDay;
  }

  isExtendedRide(): boolean {
    if (!this.ride?.start_datetime || !this.ride?.end_datetime) return false;

    const startDate = new Date(this.ride.start_datetime);
    const endDate = new Date(this.ride.end_datetime);

    const startDay = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate()
    );
    const endDay = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate()
    );
    const diffInMs = endDay.getTime() - startDay.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24) + 1;

    return diffInDays >= 4;
  }

  isSpecialVehicle(): boolean {
    if (!this.ride?.vehicle_type) return false;

    const vehicleType = this.ride.vehicle_type.toLowerCase();
    return (
      vehicleType.includes('4x4') ||
      vehicleType.includes('jeep') ||
      vehicleType.includes('van')
    );
  }

  startRide(): void {
    if (!this.ride) return;

    this.rideService.startRide(this.ride.ride_id).subscribe({
      next: (updatedRide) => {
        this.ride = updatedRide;
        this.toastService.show('הנסיעה החלה בהצלחה! 🚗', 'success');
      },
      error: (err) => {
        console.error('Error starting ride:', err);
        this.toastService.show('שגיאה בהתחלת הנסיעה ❌', 'error');
      },
    });
  }

  getCityName(cityId: string): string {
    return this.cityMap[cityId] || 'תל אביב';
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'ממתין',
      approved: 'מאושר',
      completed: 'הושלם',
      in_progress: 'בתהליך',
      rejected: 'נדחה',
      cancelled_due_to_no_show: 'בוטלה - נסיעה לא יצאה',
      cancelled_vehicle_unavailable:'בוטלה - רכב לא זמין'
    };
    return statusMap[status] || status;
  }

  closeModal(): void {
    this.dialogRef.close();
  }
}
