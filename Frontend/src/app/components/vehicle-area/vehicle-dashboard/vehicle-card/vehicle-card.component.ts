import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { VehicleUsageStatsComponent } from '../vehicle-usage-stats/vehicle-usage-stats.component';

@Component({
  selector: 'app-vehicle-card',
  standalone: true,
  imports: [CommonModule, CardModule, VehicleUsageStatsComponent],
  templateUrl: './vehicle-card.component.html',
  styleUrl: './vehicle-card.component.css',
})
export class VehicleCardComponent {
  @Input() vehicle!: any;
  @Input() showingMostUsed: boolean = false;
  @Output() cardClick = new EventEmitter<string>();

  @ViewChild(VehicleUsageStatsComponent)
  usageStats!: VehicleUsageStatsComponent;

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
    return this.usageStats?.getVehicleUsageCount(plateNumber) || 0;
  }

  getUsageLevel(plateNumber: string): 'high' | 'medium' | 'good' | 'hide' {
    return this.usageStats?.getUsageLevel(plateNumber) || 'hide';
  }

  getUsageBarColor(plateNumber: string): string {
    return this.usageStats?.getUsageBarColor(plateNumber) || '#E0E0E0';
  }
}
