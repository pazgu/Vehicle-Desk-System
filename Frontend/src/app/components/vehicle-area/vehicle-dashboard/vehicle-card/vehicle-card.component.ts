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
    return this.usageStats?.getVehicleUsageCount(plateNumber) ?? 0;
  }

  getUsageLevel(plateNumber: string): 'high' | 'medium' | 'good' | 'hide' {
    const count = this.getVehicleUsageCount(plateNumber);
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
