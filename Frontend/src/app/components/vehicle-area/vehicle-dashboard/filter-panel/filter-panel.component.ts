import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../../../services/vehicle.service';
import { VehicleInItem } from '../../../../models/vehicle-dashboard-item/vehicle-in-use-item.module';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Vehicle } from '../../../../models/vehicle.model';

@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.css',
})
export class FilterPanelComponent implements OnInit, OnChanges {
  @Input() allVehicles: VehicleInItem[] = [];
  @Input() userRole: string | null = null;
  @Input() departmentMap: Map<string, string> = new Map();

  @Output() filteredVehiclesChange = new EventEmitter<VehicleInItem[]>();
  @Output() updateQueryParams = new EventEmitter<void>();

  statusFilter: string = '';
  typeFilter: string = '';
  departmentFilter: string = '';
  showFilters: boolean = false;
  showSort: boolean = false;
  showInactive: boolean = false;

  vehicleTypes: { original: string; translated: string }[] = [];
  inactiveVehicles: Vehicle[] = [];
  vehicleUsageData: Map<string, number> = new Map();
  vehicleUsageDataAllTime: Map<string, number> = new Map();
  sortOption = ''; 


  constructor(
    private vehicleService: VehicleService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.fetchVehicleTypes();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allVehicles']) {
      this.applyFilters();
    }
  }

  get departmentList(): string[] {
    const departments = Array.from(this.departmentMap.values())
      .filter((dept) => dept.toLowerCase() !== 'unassigned')
      .sort((a, b) => a.localeCompare(b, 'he'));
    return departments;
  }

  fetchVehicleTypes() {
    this.vehicleService.getVehicleTypes().subscribe({
      next: (types) => {
        this.vehicleTypes = (types || []).map((type) => ({
          original: type,
          translated: '',
        }));
      },
      error: (err) => {
        console.error('Error fetching vehicle types:', err);
        this.vehicleTypes = [];
      },
    });
  }

  onStatusFilterChange() {
    this.applyFilters();
    this.updateQueryParams.emit();
  }

  onTypeFilterChange() {
    this.applyFilters();
    this.updateQueryParams.emit();
  }

  onDepartmentFilterChange() {
    this.applyFilters();
    this.updateQueryParams.emit();
  }

  isFilterActive(): boolean {
  return this.statusFilter !== '' || 
         this.typeFilter !== '' || 
         this.departmentFilter !== '' || 
         this.showInactive === true;
}

isSortActive(): boolean {
  return this.sortOption !== '';
}

onSortOptionChange(): void {
  if (this.sortOption === 'monthly') {
    this.loadVehicleUsageData();
  } else if (this.sortOption === 'alltime') {
    this.loadVehicleUsageDataAllTime();
  } else {
    this.applyFilters();
  }

  this.updateQueryParams.emit();
}


  toggleFilters() {
    this.showFilters = !this.showFilters;
    if (this.showFilters) {
      this.showSort = false;
    }
  }

  toggleSort() {
    this.showSort = !this.showSort;
    if (this.showSort) {
      this.showFilters = false;
    }
  }

  onInactiveChange() {
    if (this.showInactive) {
      this.loadInactiveVehicles();
    } else {
      this.inactiveVehicles = [];
      this.applyFilters();
    }
    this.updateQueryParams.emit();
  }

  clearFilters(): void {
    this.showFilters = false;
    this.statusFilter = '';
    this.typeFilter = '';
    this.departmentFilter = '';
    this.showInactive = false;
    this.inactiveVehicles = [];
    this.applyFilters();
    this.updateQueryParams.emit();
  }

  clearSorting(): void {
  this.showSort = false;
  this.sortOption = '';
  this.applyFilters();
  this.updateQueryParams.emit();
}



  loadVehicleUsageDataAllTime(): void {
    this.vehicleService.getMostUsedVehiclesAllTime().subscribe({
      next: (response) => {
        this.vehicleUsageDataAllTime.clear();
        response.stats.forEach((stat: any) => {
          this.vehicleUsageDataAllTime.set(stat.vehicle_id, stat.total_rides);
        });
        this.applyFilters();
      },
      error: (err) => {
        console.error(' Error loading all-time vehicle usage data:', err);
      },
    });
  }

  loadVehicleUsageData(): void {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    this.vehicleService.getMostUsedVehiclesThisMonth(year, month).subscribe({
      next: (response) => {
        this.vehicleUsageData.clear();
        response.stats.forEach((stat: any) => {
          this.vehicleUsageData.set(stat.vehicle_id, stat.total_rides);
        });

        this.applyFilters();
      },
      error: (err) => {
        console.error(' Error loading vehicle usage data:', err);
      },
    });
  }


  loadInactiveVehicles(): void {
    this.http
      .get<Vehicle[]>(`${environment.apiUrl}/vehicles/inactive`)
      .subscribe({
        next: (data) => {
          this.inactiveVehicles = data;
          this.applyFilters();
        },
        error: (err) => {
          console.error('Failed to load inactive vehicles', err);
        },
      });
  }

  applyFilters(): void {
    const baseList = this.allVehicles;

    if (!baseList || baseList.length === 0) {
      this.filteredVehiclesChange.emit([]);
      return;
    }

    let filtered = [...baseList];

    if (this.statusFilter) {
      switch (this.statusFilter) {
        case 'זמין':
          filtered = filtered.filter(
            (vehicle) => vehicle.status === 'available',
          );
          break;
        case 'בשימוש':
          filtered = filtered.filter((vehicle) => vehicle.status === 'in_use');
          break;
        case 'מוקפא':
          filtered = filtered.filter((vehicle) => vehicle.status === 'frozen');
          break;
      }
    }

    if (this.typeFilter) {
      filtered = filtered.filter((vehicle) => vehicle.type === this.typeFilter);
    }
    if (this.departmentFilter) {
      if (this.departmentFilter === 'לא משוייך למחלקה') {
        filtered = filtered.filter(
          (vehicle) => vehicle.department === 'לא משוייך למחלקה',
        );
      } else {
        filtered = filtered.filter(
          (vehicle) => vehicle.department === this.departmentFilter,
        );
      }
    }

    if (this.showInactive) {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      filtered = filtered.filter((vehicle) => {
        const lastUsed = vehicle.last_used_at
          ? new Date(vehicle.last_used_at)
          : null;
        return !lastUsed || lastUsed < oneWeekAgo;
      });
    }

    let sorted: VehicleInItem[];

    if (this.sortOption === 'alltime') {
  sorted = [...filtered].sort((a, b) => {
    const countA = this.vehicleUsageDataAllTime.get(a.id) || 0;
    const countB = this.vehicleUsageDataAllTime.get(b.id) || 0;
    return countB - countA;
  });
} else if (this.sortOption === 'monthly') {
  sorted = [...filtered].sort((a, b) => {
    const countA = this.vehicleUsageData.get(a.id) || 0;
    const countB = this.vehicleUsageData.get(b.id) || 0;
    return countB - countA;
  });
} else {
  sorted = [...filtered].sort((a, b) =>
    a.status.localeCompare(b.status)
  );
}

    this.filteredVehiclesChange.emit(sorted);
  }

  getStatusFilter(): string {
    return this.statusFilter;
  }

  getTypeFilter(): string {
    return this.typeFilter;
  }

  getDepartmentFilter(): string {
    return this.departmentFilter;
  }

  getShowInactive(): boolean {
    return this.showInactive;
  }

setFiltersFromParams(
  status: string,
  type: string,
  inactive: boolean,
  sortOption: string = '',
  department: string = '',
): void {
  this.statusFilter = status;
  this.typeFilter = type;
  this.departmentFilter = department;
  this.showInactive = inactive;
  this.sortOption = sortOption;

  if (this.showInactive) {
    this.loadInactiveVehicles();
  } else if (this.sortOption === 'alltime') {
    this.loadVehicleUsageDataAllTime();
  } else if (this.sortOption === 'monthly') {
    this.loadVehicleUsageData();
  } else {
    this.applyFilters();
  }
}

getSortOption(): string {
  return this.sortOption;
}



}
