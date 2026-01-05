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
  showFilters: boolean = false;
  showSort: boolean = false;
  sortByMostUsed: boolean = false;
  sortByMostUsedAllTime: boolean = false;
  showInactive: boolean = false;

  vehicleTypes: { original: string; translated: string }[] = [];
  inactiveVehicles: Vehicle[] = [];
  vehicleUsageData: Map<string, number> = new Map();
  vehicleUsageDataAllTime: Map<string, number> = new Map();

  constructor(
    private vehicleService: VehicleService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.fetchVehicleTypes();
    this.loadVehicleUsageData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['allVehicles']) {
      this.applyFilters();
    }
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

  onSortByMostUsedChange() {
    if (this.sortByMostUsed) {
      this.sortByMostUsed = false;
      this.sortByMostUsedAllTime = false;
      this.applyFilters();
    } else {
      this.sortByMostUsed = true;
      this.sortByMostUsedAllTime = false;
      this.loadVehicleUsageData();
    }
    this.updateQueryParams.emit();
  }

  onSortByMostUsedAllTimeChange() {
    if (this.sortByMostUsedAllTime) {
      this.sortByMostUsedAllTime = false;
      this.sortByMostUsed = false;
      this.applyFilters();
    } else {
      this.sortByMostUsedAllTime = true;
      this.sortByMostUsed = false;
      this.loadVehicleUsageDataAllTime();
    }
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

  loadVehicleUsageAllTimeData(): void {
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
            (vehicle) => vehicle.status === 'available'
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

    if (this.sortByMostUsedAllTime) {
      sorted = [...filtered].sort((a, b) => {
        const countA = this.vehicleUsageDataAllTime.get(a.id) || 0;
        const countB = this.vehicleUsageDataAllTime.get(b.id) || 0;
        return countB - countA;
      });
    } else if (this.sortByMostUsed) {
      sorted = [...filtered].sort((a, b) => {
        const countA = this.vehicleUsageData.get(a.id) || 0;
        const countB = this.vehicleUsageData.get(b.id) || 0;
        return countB - countA;
      });
    } else {
      sorted = [...filtered].sort((a, b) => a.status.localeCompare(b.status));
    }
    this.filteredVehiclesChange.emit(sorted);
  }

  getStatusFilter(): string {
    return this.statusFilter;
  }

  getTypeFilter(): string {
    return this.typeFilter;
  }

  getShowInactive(): boolean {
    return this.showInactive;
  }

  getSortByMostUsed(): boolean {
    return this.sortByMostUsed;
  }

  getSortByMostUsedAllTime(): boolean {
    return this.sortByMostUsedAllTime;
  }

  setFiltersFromParams(
    status: string,
    type: string,
    inactive: boolean,
    sortByMostUsed: boolean = false,
    sortByMostUsedAllTime: boolean = false
  ): void {
    this.statusFilter = status;
    this.typeFilter = type;
    this.showInactive = inactive;
    this.sortByMostUsed = sortByMostUsed;
    this.sortByMostUsedAllTime = sortByMostUsedAllTime;

    if (this.showInactive) {
      this.loadInactiveVehicles();
    } else if (this.sortByMostUsedAllTime) {
      this.loadVehicleUsageDataAllTime();
    } else if (this.sortByMostUsed) {
      this.loadVehicleUsageData();
    } else {
      this.applyFilters();
    }
  }
}
