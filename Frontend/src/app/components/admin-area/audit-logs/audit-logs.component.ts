import { Component, OnInit } from '@angular/core';
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
import { Router } from '@angular/router';
import { CityService } from '../../../services/city.service';

(pdfMake as any).vfs = pdfFonts.vfs;
(pdfMake as any).fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  }
};

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
  filteredLogs: any[] = [];
  selectedLog: any | null = null;
  objectKeys = Object.keys;

  logs: AuditLogs[] = [];
  pageSize = 5;
  currentPage = 1;

  selectedRange = '';
  customFromDate: string = '';
  customToDate: string = '';

  problematicOnly: boolean = false;
  filtersCollapsed = false;

  cityMap: { [id: string]: string } = {};




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
  };

  getVehicleFieldLabel(key: string): string {
    return this.vehicleFieldLabels[key] || key;
  }

  getRideAuditRows(oldData: any, newData: any): Array<{label: string, oldValue: any, newValue: any}> {
  return [
    { label: 'מזהה נסיעה', oldValue: oldData.id, newValue: newData.id },
    { 
  label: 'מסלול', 
oldValue: `${this.getCityName(oldData.start_location)} → ${this.getCityName(oldData.stop)} → ${this.getCityName(oldData.destination)}`, 
      newValue: `${this.getCityName(newData.start_location)} → ${this.getCityName(newData.stop)} → ${this.getCityName(newData.destination)}`  
},
    { label: 'סוג נסיעה', oldValue: oldData.ride_type, newValue: newData.ride_type },
    { label: 'סיבת בחירה ברכב 4X4', oldValue: oldData.vehicle_type_reason, newValue: newData.vehicle_type_reason },
    { label: 'משתמש', oldValue: oldData.user_id, newValue: newData.user_id },
    { label: 'משתמש עוקף', oldValue: oldData.override_user_id, newValue: newData.override_user_id },
    { label: 'רכב', oldValue: oldData.vehicle_id, newValue: newData.vehicle_id },
    { label: 'סטטוס', oldValue: oldData.status, newValue: newData.status },
    { label: 'ארכיון', oldValue: oldData.isArchive, newValue: newData.isArchive },
    { label: 'זמן התחלה', oldValue: oldData.start_datetime, newValue: newData.start_datetime },
    { label: 'זמן סיום', oldValue: oldData.end_datetime, newValue: newData.end_datetime },
    { label: 'תאריך שליחה', oldValue: oldData.submitted_at, newValue: newData.submitted_at },
    { label: 'מרחק מוערך (ק"מ)', oldValue: oldData.estimated_distance_km, newValue: newData.estimated_distance_km },
    { label: 'מרחק בפועל (ק"מ)', oldValue: oldData.actual_distance_km, newValue: newData.actual_distance_km },
    { label: 'בדיקת רישיון עברה', oldValue: oldData.license_check_passed, newValue: newData.license_check_passed },
    { label: 'אירוע חירום', oldValue: oldData.emergency_event, newValue: newData.emergency_event }
  ];
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
    estimated_distance_km: 'מרחק משוער (ק"מ)',
    vehicle_type_reason: 'סיבת בחירה ברכב מסוג 4X4',

  };

  constructor(
    private auditLogService: AuditLogsService,
    private socketService: SocketService,
    private router: Router,
    private cityService: CityService

  ) {}

  getCityName(id: string): string {
  return this.cityMap[id] || id;
}


  ngOnInit() {

    this.cityService.getCities().subscribe({
  next: (cities) => {
   this.cityMap = cities.reduce((map: { [key: string]: string }, city) => {
  map[city.id] = city.name;
  return map;
}, {});

    this.onRangeChange();


  },
  error: () => {
    console.error('שגיאה בטעינת רשימת ערים');
  }
});


    this.socketService.auditLogs$.subscribe((newLog) => {
      if (newLog) {
        this.logs = [newLog, ...this.logs];
        this.filteredLogs = [...this.logs];
      }
    });
  }

  onRangeChange() {
    let fromDate: string | undefined;
    let toDate: string | undefined;
    const today = new Date();

    if (this.selectedRange === '7days') {
      fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      toDate = today.toISOString();
    } else if (this.selectedRange === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      fromDate = firstDay.toISOString();
      toDate = today.toISOString();
    } else if (this.selectedRange === '30days') {
      fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      toDate = today.toISOString();
    } else if (this.selectedRange === 'custom') {
      fromDate = this.customFromDate ? new Date(this.customFromDate + 'T00:00:00').toISOString() : undefined;
      toDate = this.customToDate ? new Date(this.customToDate + 'T23:59:59').toISOString() : undefined;
    }
    if (this.selectedRange === '7days') {
      fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      toDate = today.toISOString();
    } else if (this.selectedRange === 'thisMonth') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      fromDate = firstDay.toISOString();
      toDate = today.toISOString();
    } else if (this.selectedRange === '30days') {
      fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      toDate = today.toISOString();
    } else if (this.selectedRange === 'custom') {
      fromDate = this.customFromDate ? new Date(this.customFromDate + 'T00:00:00').toISOString() : undefined;
      toDate = this.customToDate ? new Date(this.customToDate + 'T23:59:59').toISOString() : undefined;
    }

    this.fetchAuditLogs(fromDate, toDate);
  }

  fetchAuditLogs(fromDate?: string, toDate?: string) {
    console.log('problematicOnly:', this.problematicOnly, 'fromDate:', fromDate, 'toDate:', toDate);
    this.auditLogService.getAuditLogs(fromDate, toDate,this.problematicOnly).subscribe((data) => {
      this.logs = data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      this.filteredLogs = [...this.logs];
      this.currentPage = 1;
    });
  }

  filterLogs() {
    const searchLower = this.searchTerm.toLowerCase();
    this.filteredLogs = this.logs.filter(log =>
      log.action?.toLowerCase().includes(searchLower) ||
      log.entity_type?.toLowerCase().includes(searchLower) ||
      log.entity_id?.toLowerCase().includes(searchLower) ||
      log.full_name?.toLowerCase().includes(searchLower)
    );
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



  getRideFieldLabel(key: string): string {
    return this.rideFieldLabels[key] || key;
  }

  private getLogsForThisWeek(): any[] {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return this.filteredLogs.filter(log => {
      const created = new Date(log.created_at);
      return created >= startOfWeek && created <= endOfWeek;
    });
  }

  exportToPDF() {
    const weeklyLogs = this.getLogsForThisWeek();
    const docDefinition: TDocumentDefinitions = {
      content: [
        { text: `Weekly report of system logs`, style: 'header', alignment: 'center' },
        { text: '\n' },
        {
          table: {
            headerRows: 1,
            body: [
              ['Action type', 'Full name', 'Entity type', 'Date created'],
              ...weeklyLogs.map(log => [
                log.action,
                log.full_name,
                log.entity_type,
                new Date(log.created_at).toLocaleString('he-IL')
              ])
            ]
          },
          layout: 'lightHorizontalLines'
        }
      ],
      defaultStyle: {
        font: 'Roboto',
        alignment: 'right'
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true
        }
      }
    };
    pdfMake.createPdf(docDefinition).download('audit_logs_weekly.pdf');
  }

  exportToCSV() {
    const weeklyLogs = this.getLogsForThisWeek();
    const csvData = weeklyLogs.map(log => ({
      actionType: log.action,
      fullName: log.full_name,
      entityType: log.entity_type,
      createdAt: new Date(log.created_at).toLocaleString('he-IL')
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'audit_logs_weekly.csv');
  }

  getUserAuditRows(oldData: any, newData: any): Array<{label: string, oldValue: any, newValue: any}> {
    return [
      { label: 'שם פרטי', oldValue: oldData.first_name, newValue: newData.first_name },
      { label: 'שם משפחה', oldValue: oldData.last_name, newValue: newData.last_name },
      { label: 'שם משתמש', oldValue: oldData.username, newValue: newData.username },
      { label: 'אימייל', oldValue: oldData.email, newValue: newData.email },
      { label: 'תפקיד', oldValue: oldData.role, newValue: newData.role },
      { label: 'מזהה עובד', oldValue: oldData.employee_id, newValue: newData.employee_id },
      { label: 'מזהה מחלקה', oldValue: oldData.department_id, newValue: newData.department_id }
    ];
  }

  getVehicleAuditRows(oldData: any, newData: any): Array<{label: string, oldValue: any, newValue: any}> {
    return [
    { label: 'מספר רכב', oldValue: oldData.plate_number, newValue: newData.plate_number },
    { label: 'סוג רכב', oldValue: oldData.type, newValue: newData.type },
    { label: 'סוג דלק', oldValue: oldData.fuel_type, newValue: newData.fuel_type },
    { label: 'סטטוס', oldValue: oldData.status, newValue: newData.status },
    { label: 'שימוש אחרון', oldValue: oldData.last_used_at, newValue: newData.last_used_at }, // <-- Added this line
    { label: 'סיבת הקפאה', oldValue: oldData.freeze_reason, newValue: newData.freeze_reason },
    { label: 'מיקום נוכחי', oldValue: oldData.current_location, newValue: newData.current_location },
    { label: 'קילומטראז\'', oldValue: oldData.odometer_reading, newValue: newData.odometer_reading },
    { label: 'דגם רכב', oldValue: oldData.vehicle_model, newValue: newData.vehicle_model },
    { label: 'תמונה', oldValue: oldData.image_url, newValue: newData.image_url }
  ];
  }

  vehicleRedirect(vehicleId: string) {
    if (vehicleId) {
      this.router.navigate(['/vehicle-details', vehicleId]);
      // Or: this.router.navigate(['/vehicles', vehicleId]);
    }
  }
}