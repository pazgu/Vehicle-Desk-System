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
  showingMostUsed: boolean = false;
  sortByMostUsed: boolean = false;
  showInactive: boolean = false;

  vehicleTypes: { original: string; translated: string }[] = [];
  mostUsedVehicles: VehicleInItem[] = [];
  inactiveVehicles: Vehicle[] = [];
  vehicleUsageData: Map<string, number> = new Map();

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
  }

  onMostUsedChange() {
    if (this.showingMostUsed) {
      this.showInactive = false;
      this.mostUsedVehicles = [];
      this.loadMostUsedVehicles();
    } else {
      this.mostUsedVehicles = [];
      this.applyFilters();
    }
    this.updateQueryParams.emit();
  }

  onInactiveChange() {
    if (this.showInactive) {
      this.showingMostUsed = false;
      this.mostUsedVehicles = [];
      this.loadInactiveVehicles();
    } else {
      this.inactiveVehicles = [];
      this.applyFilters();
    }
    this.updateQueryParams.emit();
  }

  onSortByMostUsedChange() {
    if (this.sortByMostUsed) {
      this.loadVehicleUsageData();
    } else {
      this.applyFilters();
    }
    this.updateQueryParams.emit();
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
        console.error('❌ Error loading vehicle usage data:', err);
      },
    });
  }

  loadMostUsedVehicles(): void {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    // Step 1: ensure we have all vehicles first
    this.vehicleService.getAllVehicles().subscribe(
      (allVehicles) => {
        // Step 2: map departments for all vehicles
        const vehiclesWithDepts = Array.isArray(allVehicles)
          ? allVehicles.map((v) => ({
              ...v,
              department:
                this.departmentMap.get(v.department_id || '') ||
                (v.department_id ? 'מחלקה לא ידועה' : 'לא משוייך למחלקה'),
            }))
          : [];

        // Step 3: fetch most used stats and enrich with full vehicle data
        this.vehicleService
          .getMostUsedVehiclesThisMonth(year, month)
          .subscribe({
            next: (response) => {
              const enrichedStats = response.stats
                .map((stat: any) => {
                  const match = vehiclesWithDepts.find(
                    (v) => v.id === stat.vehicle_id
                  );
                  if (match) {
                    return {
                      ...match,
                      ride_count: stat.total_rides,
                    };
                  }
                  return null;
                })
                .filter((v) => v !== null) as VehicleInItem[];

              this.mostUsedVehicles = enrichedStats;
              this.applyFilters();
            },
            error: (err) => {
              console.error('❌ Error loading most used vehicles:', err);
            },
          });
      },
      (error) => {
        console.error('❌ Error loading all vehicles:', error);
      }
    );
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
    const baseList = this.showingMostUsed
      ? this.mostUsedVehicles
      : this.allVehicles;

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

    if (this.sortByMostUsed) {
      // Sort by ride count (most used first - descending order)
      sorted = [...filtered].sort((a, b) => {
        const countA = this.vehicleUsageData.get(a.id) || 0;
        const countB = this.vehicleUsageData.get(b.id) || 0;
        return countB - countA; // Descending: highest count (most used) appears first
      });
    } else {
      // Default sort by status
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

  getShowingMostUsed(): boolean {
    return this.showingMostUsed;
  }

  getSortByMostUsed(): boolean {
    return this.sortByMostUsed;
  }

  setFiltersFromParams(
    status: string,
    type: string,
    inactive: boolean,
    mostUsed: boolean,
    sortByMostUsed: boolean = false
  ): void {
    this.statusFilter = status;
    this.typeFilter = type;
    this.showInactive = inactive;
    this.showingMostUsed = mostUsed;
    this.sortByMostUsed = sortByMostUsed;

    if (this.showingMostUsed) {
      this.loadMostUsedVehicles();
    } else if (this.showInactive) {
      this.loadInactiveVehicles();
    } else if (this.sortByMostUsed) {
      this.loadVehicleUsageData();
    } else {
      this.applyFilters();
    }
  }
}
