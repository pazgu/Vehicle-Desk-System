import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { VehicleInspection } from '../../../models/vehicle-inspections.model';
import { OrderCardItem } from '../../../models/order-card-item.module';
import { CityService } from '../../../services/city.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-admin-inspections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-inspections.component.html',
  styleUrls: ['./admin-inspections.component.css']
})
export class AdminInspectionsComponent implements OnInit {
  inspections: VehicleInspection[] = [];
  rides: OrderCardItem[] = [];
  loading = true;
  showProblematicFilters = false;
  showMediumIssues = false;
  showCriticalIssues = false;
  filteredInspections: VehicleInspection[] = [];
  users: { id: string; user_name: string }[] = [];
  currentPage = 1;
  inspectionsPerPage = 4;
  activeTable: 'inspections' | 'rides' = 'inspections';
  showVehicleNotesColumn: boolean = false;
  showRideNotesColumn: boolean = false;
  hasCriticalIssues: boolean = false;
  cityMap: { [id: string]: string } = {};



  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private router: Router ,
    private cityService: CityService,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.fetchUsers();
    this.loadData();
      this.cityService.getCities().subscribe({
      next: (cities) => {
        this.cityMap = cities.reduce((map: { [id: string]: string }, city) => {
          map[city.id] = city.name;
          return map;
        }, {});
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת ערים', 'error');
      }
    });
  }

  loadData(): void {
    this.loading = true;
    const apiUrl = 'http://localhost:8000/api';
    const url = `${apiUrl}/critical-issues`;
    let params = new HttpParams();

    if (this.showProblematicFilters && (this.showMediumIssues || this.showCriticalIssues)) {
      if (this.showMediumIssues && !this.showCriticalIssues) {
        params = params.set('problem_type', 'medium');
      } else if (!this.showMediumIssues && this.showCriticalIssues) {
        params = params.set('problem_type', 'critical');
      } else if (this.showMediumIssues && this.showCriticalIssues) {
        params = params.set('problem_type', 'medium,critical');
      }
    }

    this.http.get<{ inspections: VehicleInspection[]; rides: OrderCardItem[] }>(url, { params }).subscribe({
      next: (data) => {
        this.inspections = data.inspections || [];
        this.rides = data.rides || [];
        this.applyInspectionFilters();
        this.hasCriticalIssues = this.inspections.some(insp => insp.critical_issue_bool);

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        // this.toastService.show('❌ שגיאה בטעינת נתונים', 'error');
      }
    });
  }

  handleFilterChange(filterType: 'medium' | 'critical'): void {
    if (filterType === 'medium') {
      if (this.showMediumIssues) {
        this.showCriticalIssues = false;
      }
    } else if (filterType === 'critical') {
      if (this.showCriticalIssues) {
        this.showMediumIssues = false;
      }
    }
    this.loadData();
  }

  applyInspectionFilters(): void {
    this.filteredInspections = [...this.inspections];
  }

  fetchUsers(): void {
    const apiUrl = 'http://localhost:8000/api';
    this.http.get<any>(`${apiUrl}/users`).subscribe({
      next: (data) => {
        const usersArr = Array.isArray(data.users) ? data.users : [];
        this.users = usersArr.map((user: any) => ({
          id: user.employee_id,
          user_name: user.username,
        }));
      },
      error: (err: any) => {
        // this.toastService.show('שגיאה בטעינת רשימת משתמשים', 'error');
        this.users = [];
      }
    });
  }

  getCityName(id: string): string {
    return this.cityMap[id] || 'לא ידוע';
  }

  getFormattedStops(firstStopId: string, extraStopsRaw?: string[] | null): string {
    let extraStopIds: string[] = [];

    if (Array.isArray(extraStopsRaw)) {
      extraStopIds = extraStopsRaw;
    }

    const allStops = [firstStopId, ...extraStopIds];

    return allStops
      .filter(Boolean)
      .map(id => this.getCityName(id))
      .join(' ← ');
  }
  

  getUserNameById(id: string): string {
    if (!this.users || this.users.length === 0) {
      return id;
    }
    const user = this.users.find(u => u.id === id);
    return user ? `${user.user_name}` : id;
  }

  get pagedInspections() {
    const start = (this.currentPage - 1) * this.inspectionsPerPage;
    return this.filteredInspections.slice(start, start + this.inspectionsPerPage);
  }

  get totalPages() {
    return this.filteredInspections.length > 0 ? Math.ceil(this.filteredInspections.length / this.inspectionsPerPage) : 1;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  setActiveTable(table: 'inspections' | 'rides'): void {
    this.activeTable = table;
    this.currentPage = 1;

  }

  toggleVehicleNotesColumn(): void {
    this.currentPage = 1;
    this.showVehicleNotesColumn = !this.showVehicleNotesColumn;
  }

  toggleRideNotesColumn(): void {
    this.showRideNotesColumn = !this.showRideNotesColumn;
  }
}
