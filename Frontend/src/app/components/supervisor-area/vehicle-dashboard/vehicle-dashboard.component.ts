import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../../services/vehicle.service';
import { CardModule } from 'primeng/card';
import { VehicleOutItem } from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { VehicleInItem } from '../../../models/vehicle-dashboard-item/vehicle-in-use-item.module';


@Component({
  selector: 'app-vehicle-dashboard',
  imports: [CommonModule, FormsModule, CardModule],
  templateUrl: './vehicle-dashboard.component.html',
  styleUrl: './vehicle-dashboard.component.css'
})
export class VehicleDashboardComponent {

  vehicles: VehicleInItem[] = [];
  statusFilter: string = '';
  showFilters: boolean = false;
  sortBy: string = 'date_and_time';

  constructor(private vehicleService: VehicleService){}

  ngOnInit(): void {
    this.loadVehicles();
  }

  loadVehicles(): void{
    this.vehicleService.getAllVehicles().subscribe(
      (data) => {
        this.vehicles = Array.isArray(data) ? data : [];
        console.log('Vehicles loaded:', this.vehicles);
      },
      (error) => {
        console.error('Error loading vehicles:', error);
      }
    );
  }

  getCardClass(status: string | null | undefined): string {
  if (!status) return '';
  switch (status) {
    case 'available':
      return 'card-available';
    case 'in_use':
      return 'card-inuse';
    case 'frozen':
      return 'card-frozen';
    default:
      return '';
  }
}

  translateStatus(status: string | null | undefined): string {
    if (!status) return '';
    switch (status.toLowerCase()) {
      case 'available':
        return 'זמין';
      case 'in_use':
        return 'בשימוש';
      case 'frozen':
        return 'מוקפא';
      default:
        return status;
    }
  }


  get filteredVehicles() {

    if (!this.vehicles) {
        return [];
    }
    let filtered = [...this.vehicles];

    if (this.statusFilter) {
      switch (this.statusFilter) {
        case 'זמין':
          filtered = filtered.filter(vehicle => vehicle.status === 'available');
          break;
        case 'בשימוש':
          filtered = filtered.filter(vehicle => vehicle.status === 'in_use');
          break;
        case 'מוקפא':
          filtered = filtered.filter(vehicle => vehicle.status === 'frozen');
          break;
        default:
          break;
      }
    }


    if (this.sortBy){
      return [...filtered].sort((a, b) => a.status.localeCompare(b.status));
    }
    else{
      return;
    }
    
  }


}
