import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../../services/vehicle.service';
import { VehicleInItem } from '../../../models/vehicle-dashboard-item/vehicle-in-use-item.module';
import { Router, ActivatedRoute } from '@angular/router';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';
import { FilterPanelComponent } from './filter-panel/filter-panel.component';
import { MileageUploadComponent } from './mileage-upload/mileage-upload.component';
import { VehicleCardComponent } from './vehicle-card/vehicle-card.component';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
@Component({
  selector: 'app-vehicle-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FilterPanelComponent,
    MileageUploadComponent,
    VehicleCardComponent,
  ],
  templateUrl: './vehicle-dashboard.component.html',
  styleUrl: './vehicle-dashboard.component.css',
})
export class VehicleDashboardComponent implements OnInit {
  @ViewChild(FilterPanelComponent) filterPanel!: FilterPanelComponent;

  vehicles: VehicleInItem[] = [];
  filteredVehicles: VehicleInItem[] = [];
  showMileageUpload: boolean = false;
  userRole: string | null = null;
  departmentMap: Map<string, string> = new Map();
  private destroy$ = new Subject<void>();

  constructor(
    private vehicleService: VehicleService,
    private router: Router,
    private route: ActivatedRoute,
    private socketService: SocketService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.getUserRole();
    this.fetchAndMapDepartments().then(() => {
      this.loadVehicles();
    });

  this.socketService.newVehicle$
  .pipe(takeUntil(this.destroy$))
  .subscribe((vehicleData) => {
    if (vehicleData && vehicleData.id) {
      const alreadyExists = this.vehicles.some(
        (v) => v.id === vehicleData.id
      );

      if (!alreadyExists) {
        const vehicleWithDepartmentName =
          this.mapVehicleDepartment(vehicleData);
        this.vehicles.unshift(vehicleWithDepartmentName);
      }
    }
  });

this.socketService.vehicleMileageUpdated$
  .pipe(takeUntil(this.destroy$))
  .subscribe((data) => {
    if (!data || !data.vehicle_id) return;

    const vehicleId = data.vehicle_id;
    const newMileage = data.new_mileage;

    this.vehicles = this.vehicles.map((v: any) =>
      v.id === vehicleId
        ? {
            ...v,
            mileage: newMileage,
            mileage_last_updated:
              data.mileage_last_updated || v.mileage_last_updated,
          }
        : v
    );

    this.filteredVehicles = this.filteredVehicles.map((v: any) =>
      v.id === vehicleId
        ? {
            ...v,
            mileage: newMileage,
            mileage_last_updated:
              data.mileage_last_updated || v.mileage_last_updated,
          }
        : v
    );
  });

    
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  async fetchAndMapDepartments(): Promise<void> {
    try {
      const departments = await firstValueFrom(
        this.vehicleService.getAllDepartments()
      );
      if (departments) {
        departments.forEach((dept) => {
          this.departmentMap.set(dept.id, dept.name);
        });
      }
    } catch (err) {
      console.error('Failed to fetch departments for mapping', err);
      this.toastService.show('שגיאה בטעינת נתוני מחלקות', 'error');
    }
  }

  getUserRole(): void {
    if (typeof localStorage !== 'undefined') {
      this.userRole = localStorage.getItem('role');
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
        this.vehicles = Array.isArray(data)
          ? data.map((vehicle) => this.mapVehicleDepartment(vehicle))
          : [];
        this.loadQueryParams();
      },
      (error) => {
        console.error('Error loading vehicles:', error);
      }
    );
  }

  private mapVehicleDepartment(vehicle: any): any {
    return {
      ...vehicle,
      department:
        this.departmentMap.get(vehicle.department_id || '') ||
        (vehicle.department_id ? 'מחלקה לא ידועה' : 'לא משוייך למחלקה'),
    };
  }

  onFilteredVehiclesChange(filtered: VehicleInItem[]): void {
    this.filteredVehicles = filtered;
  }

  navigateToArchivedVehicles(): void {
    this.router.navigate(['/archived-vehicles']);
  }

  loadQueryParams(): void {
   this.route.queryParams
  .pipe(takeUntil(this.destroy$))
  .subscribe((params) => {
    const statusFilter = this.translate(
      params['status'] || '',
      'status',
      'toHebrew'
    );

    const typeFilter = this.translate(
      params['type'] || '',
      'type',
      'toHebrew'
    );

    const departmentFilter = params['department'] || '';
    const showInactive = params['showInactive'] === 'true';
    const sortOption = params['sortOption'] || '';


    if (this.filterPanel) {
      this.filterPanel.setFiltersFromParams(
  statusFilter,
  typeFilter,
  showInactive,
  sortOption,
  departmentFilter
);

    }
  });

  }

  updateQueryParams(): void {
    if (!this.filterPanel) return;

    const queryParams: any = {};

    const statusFilter = this.filterPanel.getStatusFilter();
    const typeFilter = this.filterPanel.getTypeFilter();
    const departmentFilter = this.filterPanel.getDepartmentFilter();
    const showInactive = this.filterPanel.getShowInactive();
    const sortOption = this.filterPanel.getSortOption();

    if (statusFilter)
      queryParams['status'] = this.translate(
        statusFilter,
        'status',
        'toEnglish'
      );
    if (typeFilter)
      queryParams['type'] = this.translate(typeFilter, 'type', 'toEnglish');
    if (departmentFilter) queryParams['department'] = departmentFilter;
    if (showInactive) queryParams['showInactive'] = 'true';
    if (sortOption) queryParams['sortOption'] = sortOption;


    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'replace',
    });
  }

  translate(
    value: string,
    type: 'status' | 'type',
    direction: 'toEnglish' | 'toHebrew'
  ): string {
    if (type === 'status') {
      const statusMap: { [key: string]: string } = {
        available: 'זמין',
        in_use: 'בשימוש',
        frozen: 'מוקפא',
      };

      if (direction === 'toHebrew') {
        return statusMap[value] || value;
      } else {
        return (
          Object.keys(statusMap).find((k) => statusMap[k] === value) || value
        );
      }
    }

    return value;
  }
}
