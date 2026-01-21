import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogsService } from '../../../services/audit-logs.service';
import { AuditLogs } from '../../../models/audit-logs/audit-logs.module';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { SocketService } from '../../../services/socket.service';
import { CityService } from '../../../services/city.service';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastService } from '../../../services/toast.service';
import * as XLSX from 'xlsx-js-style';
import { VehicleService } from '../../../services/vehicle.service';
import { userFieldLabels } from './audit-logs-utils/entities-fields';
import { vehicleFieldLabels } from './audit-logs-utils/entities-fields';
import { departmentFieldLabels } from './audit-logs-utils/entities-fields';
import { rideFieldLabels } from './audit-logs-utils/entities-fields';
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
} from './audit-logs-utils/exports';
import {
  translateFreezeReason,
  translateFuelType,
  translateRideStatus,
  translateRideType,
  translateUserRole,
  translateVehicleStatus,
  getVehicleAuditRows,
  getUsernameById,
  getDepartmentNameById,
} from './audit-logs-utils/helpers';
import { InsertLogComponent } from './audit-log-details/insert-log/insert-log.component';
import { UpdateLogComponent } from './audit-log-details/update-log/update-log.component';
import { DeleteDataDisplayComponent } from './audit-log-details/delete-log/delete-log.component';
import { buildAuditLegendCssVars } from './audit-logs-utils/status-colors';
import { Subject, takeUntil } from 'rxjs';

(pdfMake as any).vfs = pdfFonts.vfs;
(pdfMake as any).fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InsertLogComponent,
    UpdateLogComponent,
    DeleteDataDisplayComponent,
  ],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.css'],
})
export class AuditLogsComponent implements OnInit {
  showFilters = false;
  searchTerm = '';
  filteredLogs: any[] = [];
  selectedLog: any | null = null;
  objectKeys = Object.keys;

  logs: AuditLogs[] = [];
  pageSize = 5;
  currentPage = 1;

  selectedRange = '';
  customFromDate: string = '';
  customToDate: string = '';

  showExceededQuotaOnly: boolean = false;
  filtersCollapsed = true;
  auditLegendCssVars = buildAuditLegendCssVars();


  cityMap: { [id: string]: string } = {};
  departments: { id: string; name: string }[] = [];
  users: {
    id: string;
    first_name: string;
    last_name: string;
    user_name: string;
  }[] = [];
  vehicles: { id: string; vehicle_model: string; plate_number: string }[] = [];
  private destroy$ = new Subject<void>();

  loading = true;
  highlighted = false;
  private lastInspectionId: string | null = null;
  translateFuelType = translateFuelType;
  translateVehicleStatus = translateVehicleStatus;
  translateRideStatus = translateRideStatus;
  translateUserRole = translateUserRole;
  translateFreezeReason = translateFreezeReason;
  translateRideType = translateRideType;

  getUserFieldLabel(key: string): string {
    return userFieldLabels[key] || key;
  }

  getDepartmentFieldLabel(key: string): string {
    return departmentFieldLabels[key] || key;
  }

  getVehicleFieldLabel(key: string): string {
    return vehicleFieldLabels[key] || key;
  }

  getRideFieldLabel(key: string): string {
    return rideFieldLabels[key] || key;
  }

  constructor(
    private route: ActivatedRoute,
    private socketService: SocketService,
    private cityService: CityService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private auditLogService: AuditLogsService,
    private vehicleService: VehicleService
  ) {}

  getCityName(id: string): string {
    return this.cityMap[id] || id;
  }

  fetchDepartments(): void {
    
    this.auditLogService.getDepartments().subscribe({
      next: (data) => {
        
        if (!Array.isArray(data)) {
          console.error('❌ Data is not an array!', data);
          this.departments = [];
          return;
        }
        
        this.departments = data.map((dep) => ({
          id: dep.id,
          name: dep.name,
        }));
        
      },
      error: (err: any) => {
        this.toastService.show('שגיאה בטעינת רשימת מחלקות', 'error');
        this.departments = [];
      },
    });
  }

  DepartmentNameById(id: string | null | undefined): string {
    return getDepartmentNameById(id, this.departments);
  }

  UsernameById(id: string): string {
    return getUsernameById(id, this.users);
  }

  fetchUsers(): void {
    this.auditLogService.getUsers().subscribe({
      next: (data) => {
        const usersArr = Array.isArray(data.users) ? data.users : [];
        this.users = usersArr.map((user: any) => ({
          id: user.employee_id,
          first_name: user.first_name,
          last_name: user.last_name,
          user_name: user.username,
        }));
      },
      error: (err: any) => {
        this.toastService.show('שגיאה בטעינת רשימת משתמשים', 'error');
        this.users = [];
      },
    });
  }

  getVehicleAuditRows(oldData: any, newData: any) {
    return getVehicleAuditRows(
      oldData,
      newData,
      this.DepartmentNameById.bind(this)
    );
  }

  fetchAuditLogs(fromDate?: string, toDate?: string) {
    this.loading = true;
    this.auditLogService.getAuditLogs(fromDate, toDate).subscribe({
      next: (data) => {
        this.logs = Array.isArray(data)
          ? data.sort(
              (a, b) =>
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            )
          : [];
        this.loading = false;
        this.filterLogs();
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת יומני ביקורת', 'error');
        this.logs = [];
        this.filteredLogs = [];
        this.loading = false;
      },
    });
  }

  ngOnInit(): void {
    this.cityService.getCities().subscribe({
      next: (cities) => {
        this.cityMap = cities.reduce((map: { [key: string]: string }, city) => {
          map[city.id] = city.name;
          return map;
        }, {});
        this.onRangeChange();
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת רשימת ערים', 'error');
      },
    });

   this.route.queryParams
  .pipe(takeUntil(this.destroy$))
  .subscribe(params => {
    this.highlighted = params['highlight'] === '1';
  });


    this.fetchDepartments();
    this.fetchUsers();
    this.fetchVehicles();
  }

    ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  resetFilters() {
    this.selectedRange = '';
    this.customFromDate = '';
    this.customToDate = '';
    this.fetchAuditLogs();
  }

  onRangeChange() {
    let fromDate: string | undefined;
    let toDate: string | undefined;
    const today = new Date();

    if (this.selectedRange === '7days') {
      fromDate = new Date(
        today.getTime() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      toDate = today.toISOString();
    } else if (this.selectedRange === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      fromDate = firstDay.toISOString();
      toDate = today.toISOString();
    } else if (this.selectedRange === '30days') {
      fromDate = new Date(
        today.getTime() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      toDate = today.toISOString();
    } else if (this.selectedRange === 'custom') {
      const from = this.customFromDate
        ? new Date(this.customFromDate + 'T00:00:00')
        : undefined;
      const to = this.customToDate
        ? new Date(this.customToDate + 'T23:59:59')
        : undefined;

      if (from && to && from > to) {
        this.toastService.show(
          'תאריך ההתחלה לא יכול להיות אחרי תאריך הסיום.',
          'error'
        );
        return;
      }

      fromDate = from?.toISOString();
      toDate = to?.toISOString();
    }

    this.fetchAuditLogs(fromDate, toDate);
  }

  filterLogs() {
    const searchLower = this.searchTerm.toLowerCase();
    let tempLogs = [...this.logs];

    if (this.showExceededQuotaOnly) {
      tempLogs = tempLogs.filter(
        (log) =>
          log.entity_type === 'User' &&
          log.action === 'UPDATE' &&
          log.change_data &&
          log.change_data.new &&
          log.change_data.new.exceeded_monthly_trip_quota === true
      );
    }

    this.filteredLogs = tempLogs.filter(
      (log) =>
        log.action?.toLowerCase().includes(searchLower) ||
        log.entity_type?.toLowerCase().includes(searchLower) ||
        log.entity_id?.toLowerCase().includes(searchLower) ||
        log.full_name?.toLowerCase().includes(searchLower)
    );

    this.currentPage = 1;
  }

  showDetails(log: AuditLogs) {
    this.selectedLog = log;
  }

  closeDetails() {
    this.selectedLog = null;
  }

  get totalPages(): number {
    return Math.ceil(this.filteredLogs.length / this.pageSize) || 1;
  }

  get pagedLogs() {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLogs.slice(start, start + this.pageSize);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  async exportPDF() {
    const logs = await this.filteredLogs;
    exportToPDF(logs);
  }

  async exportCSV() {
    const logs = await this.filteredLogs;
    exportToCSV(logs);
  }

  async exportExcel() {
    const logs = await this.filteredLogs;
    exportToExcel(logs);
  }

  fetchVehicles(): void {
    this.vehicleService.getAllVehicles().subscribe(
      (data) => {
        this.vehicles = Array.isArray(data)
          ? data.map((vehicle) => ({
              ...vehicle,
            }))
          : [];
      },
      (error) => {
        this.toastService.show('שגיאה בטעינת רכבים', 'error');
      }
    );
  }
}
