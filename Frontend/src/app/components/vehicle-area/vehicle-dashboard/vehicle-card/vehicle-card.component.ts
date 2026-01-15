import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { VehicleService } from '../../../../services/vehicle.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-vehicle-card',
  standalone: true,
  imports: [CommonModule, CardModule],
  templateUrl: './vehicle-card.component.html',
  styleUrl: './vehicle-card.component.css',
})
export class VehicleCardComponent implements OnInit, OnDestroy {
  @Input() vehicle!: any;
  @Input() showingMostUsed: boolean = false;
  @Output() cardClick = new EventEmitter<string>();

  // Current month ride count - replaces VehicleUsageStatsComponent
  currentVehicleRideCount: number = 0;
  private destroy$ = new Subject<void>();

  constructor(private vehicleService: VehicleService) {}

  ngOnInit(): void {
    if (this.vehicle?.id) {
      this.getAllRidesForCurrentVehicle(this.vehicle.id);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * EXACT SAME LOGIC as VehicleCardItemComponent.getAllRidesForCurrentVehicle()
   * Gets current month ride count for this vehicle
   */
  getAllRidesForCurrentVehicle(vehicleId: string): void {
    this.vehicleService
      .getAllOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rides) => {
          const count = rides.filter((ride) => {
            if (ride.vehicle_id !== vehicleId) return false;
            if (!ride.date_and_time) return false;
            const rideDate = new Date(ride.date_and_time);
            const currentDate = new Date();
            return (
              rideDate.getMonth() === currentDate.getMonth() &&
              rideDate.getFullYear() === currentDate.getFullYear()
            );
          }).length;
          this.currentVehicleRideCount = count;
        },
        error: (err) => {
          console.error('Error fetching rides:', err);
          this.currentVehicleRideCount = 0;
        },
      });
  }

  getCardClass(): string {
    const statusClass = this.vehicle?.status
      ? `card-${this.vehicle.status}`
      : 'card-available';
    return `vehicle-card ${statusClass}`;
  }

  isInactive(lastUsedAt: string | null | undefined): boolean {
    if (!lastUsedAt) {
      return true;
    }

    const lastUsedDate = new Date(lastUsedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return lastUsedDate < sevenDaysAgo;
  }

  isLeaseExpired(expiry: string): boolean {
    return new Date(expiry) < new Date();
  }

  onCardClick() {
    this.cardClick.emit(this.vehicle?.id);
  }

  getVehicleUsageCount(plateNumber: string): number {
    return this.currentVehicleRideCount;
  }

  getUsageLevel(plateNumber: string): 'high' | 'medium' | 'good' | 'hide' {
    const count = this.currentVehicleRideCount;
    if (count > 10) return 'high';
    if (count >= 5) return 'medium';
    if (count == 0) return 'hide';
    return 'good';
  }

  getUsageBarColor(plateNumber: string): string {
    const level = this.getUsageLevel(plateNumber);
    switch (level) {
      case 'high':
        return '#FF5252';
      case 'medium':
        return '#FFC107';
      case 'good':
        return '#42A5F5';
      case 'hide':
        return 'rgba(255, 255, 255, 0)';
      default:
        return '#E0E0E0';
    }
  }
}