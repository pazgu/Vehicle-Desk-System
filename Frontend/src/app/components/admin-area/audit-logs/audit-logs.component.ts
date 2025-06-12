// src/app/audit-logs/audit-logs.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogsService } from '../../../services/audit-logs.service';
import { AuditLogs } from '../../../models/audit-logs/audit-logs.module'; // Ensure this path is correct

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.css']
})
export class AuditLogsComponent implements OnInit {
  showFilters = false;
  searchTerm = '';
  objectKeys = Object.keys; // Still useful if you need to iterate over object keys dynamically

  constructor(private auditLogService: AuditLogsService) { }
  logs: AuditLogs[] = [];
  filteredLogs: AuditLogs[] = []; // Type this correctly
  selectedLog: AuditLogs | null = null; // Property to hold the selected log for detailed view

  pageSize = 5;
  currentPage = 1;

  vehicleFieldLabels: { [key: string]: string } = {
  id: 'מזהה רכב',
  type: 'סוג רכב',
  status: 'סטטוס',
  fuel_type: 'סוג דלק',
  image_url: 'תמונה',
  last_used_at: 'שימוש אחרון',
  plate_number: 'מספר רישוי',
  freeze_reason: 'סיבת הקפאה',
  vehicle_model: 'דגם רכב',
  freeze_details: 'פרטי הקפאה',
  current_location: 'מיקום נוכחי',
  odometer_reading: 'מד מרחק',
  // add more as needed
};

getVehicleFieldLabel(key: string): string {
  return this.vehicleFieldLabels[key] || key;
}

  rideFieldLabels: { [key: string]: string } = {
    id: 'מזהה נסיעה',
    stop: 'עצירה',
    status: 'סטטוס',
    user_id: 'מזהה משתמש',
    isArchive: 'ארכיון',
    ride_type: 'סוג נסיעה',
    vehicle_id: 'מזהה רכב',
    destination: 'יעד',
    end_datetime: 'תאריך סיום',
    submitted_at: 'תאריך שליחה',
    start_datetime: 'תאריך התחלה',
    start_location: 'מיקום התחלה',
    emergency_event: 'אירוע חירום',
    override_user_id: 'מזהה משתמש עוקף',
    actual_distance_km: 'מרחק בפועל (ק"מ)',
    license_check_passed: 'עבר בדיקת רישיון',
    estimated_distance_km: 'מרחק משוער (ק"מ)'
  };

  ngOnInit() {
    this.loadLogs();
  }

  loadLogs() {
    this.auditLogService.getAuditLogs().subscribe(
      (data) => {
        this.logs = data.map(log => ({
          ...log,
          // 'createdAt' property was not used in the provided JSON,
          // sticking to 'created_at' as per your API response for consistency
          // If you need a Date object, you can add it:
          // createdAt: new Date(log.created_at)
        }));
        this.filteredLogs = [...this.logs]; // Initialize filtered logs
      });
  }

  filterLogs() {
    if (!this.searchTerm.trim()) {
      this.filteredLogs = [...this.logs];
      return;
    }

    const searchLower = this.searchTerm.toLowerCase();
    this.filteredLogs = this.logs.filter(log =>
      log.action?.toLowerCase().includes(searchLower) ||
      log.entity_type?.toLowerCase().includes(searchLower) || // Added entity_type to search
      log.entity_id?.toLowerCase().includes(searchLower) || // Added entity_id to search
      log.full_name?.toString().toLowerCase().includes(searchLower)
    );
  }

  // Method to show details of a selected log
  showDetails(log: AuditLogs) { // Type the 'log' parameter
    this.selectedLog = log;
  }

  // Method to close the details card
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

  // nextPage() {
  //   if (this.currentPage < this.totalPages) {
  //     this.currentPage++;
  //   }
  // }

  // prevPage() {
  //   if (this.currentPage > 1) {
  //     this.currentPage--;
  //   }
  // }

  onPageChange(event: any) {
    this.currentPage = event.page + 1;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  getRideFieldLabel(key: string): string {
    return this.rideFieldLabels[key] || key;
  }
}