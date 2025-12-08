import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { VehicleService } from '../../../../services/vehicle.service';

@Component({
  selector: 'app-vehicle-usage-stats',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vehicle-usage-stats.component.html',
  styleUrl: './vehicle-usage-stats.component.css',
})
export class VehicleUsageStatsComponent implements OnInit {
  topUsedVehiclesMap: Record<string, number> = {};

  constructor(private http: HttpClient,private vehicleService:VehicleService) {}

  ngOnInit(): void {
    this.loadVehicleUsageData();
  }

 
loadVehicleUsageData(): void {
  this.vehicleService.getCurrentMonthVehicleUsage().subscribe({
    next: (data) => {
      this.topUsedVehiclesMap = {};

      data.forEach((vehicle) => {
        this.topUsedVehiclesMap[vehicle.plate_number] = vehicle.total_rides;
      });
    },
    error: (err) => {
      console.error('Error fetching vehicle usage stats:', err);
    },
  });
}

  getVehicleUsageCount(plateNumber: string): number {
    return this.topUsedVehiclesMap[plateNumber] || 0;
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
