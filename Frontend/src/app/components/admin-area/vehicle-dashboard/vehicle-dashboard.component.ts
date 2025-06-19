import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../../services/vehicle.service';
import { CardModule } from 'primeng/card';
import { VehicleOutItem } from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { VehicleInItem } from '../../../models/vehicle-dashboard-item/vehicle-in-use-item.module';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';


@Component({
  selector: 'app-vehicle-dashboard',
  imports: [CommonModule, FormsModule, CardModule],
  templateUrl: './vehicle-dashboard.component.html',
  styleUrl: './vehicle-dashboard.component.css'
  
})
export class VehicleDashboardComponent {

  vehicles: VehicleInItem[] = [];
  mostUsedVehicles: VehicleInItem[] = [];
  showingMostUsed: boolean = false;
  statusFilter: string = '';
  showFilters: boolean = false;
  sortBy: string = 'date_and_time';

  constructor(private vehicleService: VehicleService, private router: Router){}

  ngOnInit(): void {
    this.loadVehicles();
  }

  goToVehicleDetails(vehicleId: string): void {
    this.router.navigate(['/vehicle-details', vehicleId]);
  }

  loadVehicles(): void{
    this.vehicleService.getAllVehicles().subscribe(
      (data) => {
        this.vehicles = Array.isArray(data) ? data : [];
        this.showingMostUsed = false;
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
  const baseList = this.showingMostUsed ? this.mostUsedVehicles : this.vehicles;
  console.log('🧮 filteredVehicles baseList:', baseList);
  if (!baseList) {
    return [];
  }

  let filtered = [...baseList];

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
    }
  }
  console.log('🧮 Final filteredVehicles:', filtered);
  return filtered;
}
loadMostUsedVehicles(): void {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  // First, load all vehicles
  this.vehicleService.getAllVehicles().subscribe(
    (allVehicles) => {
      this.vehicles = Array.isArray(allVehicles) ? allVehicles : [];

      // Then fetch the usage stats
      this.vehicleService.getMostUsedVehiclesThisMonth(year, month).subscribe({
        next: (response) => {
          console.log('✅ Most used vehicles:', response);

          const enrichedStats = response.stats
            .map((stat: any) => {
              const match = this.vehicles.find(v => v.id === stat.vehicle_id);
              return match ? { ...match, ride_count: stat.total_rides } : null;
            })
            .filter((v) => v !== null) as VehicleInItem[];

          this.mostUsedVehicles = enrichedStats;
          this.showingMostUsed = true;
        },
        error: (err) => {
          console.error('❌ Error loading most used vehicles:', err);
        }
      });
    },
    (error) => {
      console.error('❌ Error loading all vehicles:', error);
    }
  );
}


  toggleVehicleMode(): void {
  if (this.showingMostUsed) {
    this.loadVehicles();
  } else {
    this.loadMostUsedVehicles();
  }
}


}
