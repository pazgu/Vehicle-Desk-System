// import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { HttpClient, HttpParams } from '@angular/common/http';
// import { FormsModule } from '@angular/forms';
// import { Router } from '@angular/router';
// import { ActivatedRoute } from '@angular/router';
// import { VehicleInspection } from '../../../models/vehicle-inspections.model';
// import { OrderCardItem } from '../../../models/order-card-item.module';

// @Component({
//   selector: 'app-admin-inspections',
//   standalone: true,
//   imports: [CommonModule, FormsModule],
//   templateUrl: './admin-inspections.component.html',
//   styleUrls: ['./admin-inspections.component.css']
// })
// export class AdminInspectionsComponent implements OnInit {
//   inspections: VehicleInspection[] = [];
//   rides: OrderCardItem[] = [];
//   loading = true;
//   showProblematicFilters = false;
//   showMediumIssues = false;
//   showCriticalIssues = false;
//   filteredInspections: VehicleInspection[] = [];
//   users: { id: string; user_name: string }[] = [];
//   currentPage = 1;
//   inspectionsPerPage = 4;
//   activeTable: 'inspections' | 'rides' = 'inspections';

//   constructor(
//     private http: HttpClient,
//     private route: ActivatedRoute,
//     private cdr: ChangeDetectorRef,
//     private router: Router
//   ) {}

//   ngOnInit(): void {
//     this.fetchUsers();
//     this.loadData();
//     // Assuming socketService and toastService exist and are imported
//     // this.socketService.newInspection$.subscribe((data) => {
//     //   this.loadData();
//     // });
//   }

//   loadData(): void {
//     this.loading = true;
//     const apiUrl = 'http://localhost:8000/api';
//     const url = `${apiUrl}/critical-issues`;
//     let params = new HttpParams();

//     if (this.showProblematicFilters && (this.showMediumIssues || this.showCriticalIssues)) {
//       if (this.showMediumIssues && !this.showCriticalIssues) {
//         params = params.set('problem_type', 'medium');
//       } else if (!this.showMediumIssues && this.showCriticalIssues) {
//         params = params.set('problem_type', 'critical');
//       } else if (this.showMediumIssues && this.showCriticalIssues) {
//         params = params.set('problem_type', 'medium,critical');
//       }
//     }

//     this.http.get<{ inspections: VehicleInspection[]; rides: OrderCardItem[] }>(url, { params }).subscribe({
//       next: (data) => {
//         this.inspections = data.inspections || [];
//         this.rides = data.rides || [];
//         this.applyInspectionFilters();
//         this.loading = false;
//         this.cdr.detectChanges();
//       },
//       error: () => {
//         this.loading = false;
//         // this.toastService.show('❌ שגיאה בטעינת נתונים', 'error');
//       }
//     });
//   }

//   applyInspectionFilters(): void {
//     this.filteredInspections = [...this.inspections];
//     this.currentPage = 1;
//   }

//   fetchUsers(): void {
//     const apiUrl = 'http://localhost:8000/api';
//     this.http.get<any>(`${apiUrl}/users`).subscribe({
//       next: (data) => {
//         const usersArr = Array.isArray(data.users) ? data.users : [];
//         this.users = usersArr.map((user: any) => ({
//           id: user.employee_id,
//           user_name: user.username,
//         }));
//       },
//       error: (err: any) => {
//         // this.toastService.show('שגיאה בטעינת רשימת משתמשים', 'error');
//         this.users = [];
//       }
//     });
//   }

//   getUserNameById(id: string): string {
//     if (!this.users || this.users.length === 0) {
//       return id;
//     }
//     const user = this.users.find(u => u.id === id);
//     return user ? `${user.user_name}` : id;
//   }

//   get pagedInspections() {
//     const start = (this.currentPage - 1) * this.inspectionsPerPage;
//     return this.filteredInspections.slice(start, start + this.inspectionsPerPage);
//   }

//   get totalPages() {
//     return this.filteredInspections.length > 0 ? Math.ceil(this.filteredInspections.length / this.inspectionsPerPage) : 1;
//   }

//   nextPage() {
//     if (this.currentPage < this.totalPages) this.currentPage++;
//   }

//   prevPage() {
//     if (this.currentPage > 1) this.currentPage--;
//   }

//   setActiveTable(table: 'inspections' | 'rides'): void {
//     this.activeTable = table;
//   }
// }

import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { VehicleInspection } from '../../../models/vehicle-inspections.model';
import { OrderCardItem } from '../../../models/order-card-item.module';

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

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.fetchUsers();
    this.loadData();
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
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        // this.toastService.show('❌ שגיאה בטעינת נתונים', 'error');
      }
    });
  }

  // New function to handle the exclusive checkbox logic
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
    this.currentPage = 1;
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
  }
}
