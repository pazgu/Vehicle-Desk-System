import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../../services/vehicle.service';
import { CardModule } from 'primeng/card';
import { VehicleInItem } from '../../../models/vehicle-dashboard-item/vehicle-in-use-item.module';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';
import { Observable } from 'rxjs';
import { Vehicle } from '../../../models/vehicle.model';
@Component({
  selector: 'app-vehicle-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule],
  templateUrl: './vehicle-dashboard.component.html',
  styleUrl: './vehicle-dashboard.component.css'
})
export class VehicleDashboardComponent implements OnInit {

  vehicles: VehicleInItem[] = [];
  mostUsedVehicles: VehicleInItem[] = [];
  showingMostUsed: boolean = false;

  inactiveVehicles: Vehicle[] = []; // vehicles not used in 7+ days
  InactiveFilter: boolean = false; // checkbox state
  showInactive: boolean = false;
  
  selectedType: string = '';
  statusFilter: string = '';
  typeFilter: string = '';
  showFilters: boolean = false;
  sortBy: string = 'date_and_time';
  vehicleTypes: string[] = [];

  topUsedVehiclesMap: Record<string, number> = {};
  vehicleUsageData: { plate_number: string; vehicle_model: string; ride_count: number }[] = [];

  userRole: string | null = null;

  departmentMap: Map<string, string> = new Map();

  constructor(
    private vehicleService: VehicleService,
    private router: Router,
    private http: HttpClient,
    private socketService: SocketService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.getUserRole();
    this.fetchAndMapDepartments().then(() => {
      this.loadVehicles();
      this.fetchVehicleTypes();
      this.loadVehicleUsageData();
    });

    this.socketService.newVehicle$.subscribe((vehicleData) => {
      if (vehicleData && vehicleData.id) {
        console.log('🆕 Vehicle received via socket:', vehicleData);
        const alreadyExists = this.vehicles.some(v => v.id === vehicleData.id);
        if (!alreadyExists) {
          const departmentName = this.departmentMap.get(vehicleData.department_id || '');
          const vehicleWithDepartmentName: VehicleInItem = {
            ...vehicleData,
            department: departmentName || (vehicleData.department_id ? 'מחלקה לא ידועה' : null)
          };
          this.vehicles.unshift(vehicleWithDepartmentName);
        }
      }
    });
  }

  async fetchAndMapDepartments(): Promise<void> {
    try {
      const departments = await this.http.get<{ id: string, name: string }[]>(`${environment.apiUrl}/departments`).toPromise();
      if (departments) {
        departments.forEach(dept => {
          this.departmentMap.set(dept.id, dept.name);
        });
        console.log('Departments mapped:', this.departmentMap);
      }
    } catch (err) {
      console.error('Failed to fetch departments for mapping', err);
      this.toastService.show('שגיאה בטעינת נתוני מחלקות', 'error');
    }
  }

  getUserRole(): void {
    if (typeof localStorage !== 'undefined') {
      this.userRole = localStorage.getItem('role');
      console.log('User role from local storage:', this.userRole);
    }
  }

  navigateToNewVehicle() {
    this.router.navigate(['vehicle-dashboard/new-vehicle']);
  }

  goToVehicleDetails(vehicleId: string): void {
    this.router.navigate(['/vehicle-details', vehicleId]);
  }

  loadVehicles(): void {
    this.vehicleService.getAllVehicles().subscribe(
      (data) => {
        this.vehicles = Array.isArray(data) ? data.map(vehicle => ({
          ...vehicle,
          department: this.departmentMap.get(vehicle.department_id || '') || (vehicle.department_id ? 'מחלקה לא ידועה' : 'לא משוייך למחלקה')
        })) : [];
        this.showingMostUsed = false;
        console.log('Vehicles loaded with department names:', this.vehicles);
      },
      (error) => {
        console.error('Error loading vehicles:', error);
      }
    );
  }

  loadVehicleUsageData(): void {
    this.http.get<{ plate_number: string; vehicle_model: string; ride_count: number }[]>(
      `${environment.apiUrl}/analytics/top-used-vehicles`
    ).subscribe({
      next: data => {
        this.vehicleUsageData = data;
        this.topUsedVehiclesMap = {};
        data.forEach(vehicle => {
          this.topUsedVehiclesMap[vehicle.plate_number] = vehicle.ride_count;
        });
        console.log('Vehicle usage data loaded:', this.topUsedVehiclesMap);
      },
      error: err => {
        console.error('❌ Error fetching vehicle usage data:', err);
      }
    });
  }

  fetchVehicleTypes() {
    console.log('fetchVehicleTypes called');
    this.vehicleService.getVehicleTypes().subscribe({
      next: (types) => {
        console.log('Fetched vehicle types:', types);
        this.vehicleTypes = types || [];
      },
      error: (err) => {
        console.error('Error fetching vehicle types:', err);
        this.vehicleTypes = [];
      }
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
      case 'high': return '#FF5252';
      case 'medium': return '#FFC107';
      case 'good': return '#42A5F5';
      case 'hide': return 'rgba(255, 255, 255, 0)';
      default: return '#E0E0E0';
    }
  }

  getUsageBarWidth(plateNumber: string): number {
    const count = this.getVehicleUsageCount(plateNumber);
    const maxRides = 15;
    return Math.min((count / maxRides) * 100, 100);
  }

  loadMostUsedVehicles(): void {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    this.vehicleService.getAllVehicles().subscribe(
      (allVehicles) => {
        const vehiclesWithNames = Array.isArray(allVehicles) ? allVehicles.map(vehicle => ({
          ...vehicle,
          department: this.departmentMap.get(vehicle.department_id || '') || (vehicle.department_id ? 'מחלקה לא ידועה' : 'ללא מחלקה')
        })) : [];
        this.vehicles = vehiclesWithNames;

        this.vehicleService.getMostUsedVehiclesThisMonth(year, month).subscribe({
          next: (response) => {
            console.log('✅ Most used vehicles:', response);

            const enrichedStats = response.stats
              .map((stat: any) => {
                const match = vehiclesWithNames.find(v => v.id === stat.vehicle_id);
                if (match) {
                  return {
                    ...match,
                    ride_count: stat.total_rides
                  };
                }
                return null;
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

   goToArchivedOrders() {
    this.router.navigate(['/vehicles/archived']);
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

getInactiveVehicles(): Observable<Vehicle[]> {
  return this.http.get<Vehicle[]>(`${environment.apiUrl}/vehicles/inactive`);
}
  onInactiveFilterChange(): void {
    if (this.InactiveFilter) {
      this.getInactiveVehicles().subscribe({
        next: (data) => {
          this.inactiveVehicles = data;
        },
        error: (err) => {
          console.error('Failed to load inactive vehicles', err);
        },
      });
    } else {
      this.inactiveVehicles = [];
    }

  // New method to check if a vehicle is inactive
  isInactive(lastUsedAt: string | null | undefined): boolean {
    if (!lastUsedAt) {
      return true; // Consider vehicles with no last_used_at as inactive
    }
    const lastUsedDate = new Date(lastUsedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return lastUsedDate < sevenDaysAgo;

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

    if (!baseList) return [];

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

    if (this.typeFilter) {
      filtered = filtered.filter(vehicle => vehicle.type === this.typeFilter);
    }
     if (this.InactiveFilter && this.inactiveVehicles.length > 0) {
      const inactiveIds = new Set(this.inactiveVehicles.map((v) => v.id));
      filtered = filtered.filter((v) => inactiveIds.has(v.id));
    }


  if (this.showInactive) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  filtered = filtered.filter(vehicle => {
    const lastUsed = vehicle.last_used_at ? new Date(vehicle.last_used_at) : null;
    return !lastUsed || lastUsed < oneWeekAgo;
  });
}

    if (this.sortBy) {
      return [...filtered].sort((a, b) => a.status.localeCompare(b.status));
    } else {
      return filtered;
    }
  }
  navigateToArchivedVehicles(): void {
  this.router.navigate(['/archived-vehicles']);
}
}