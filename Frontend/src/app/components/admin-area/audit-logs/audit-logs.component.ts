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
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../services/toast.service';

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
  showExceededQuotaOnly: boolean = false; // <-- NEW
  filtersCollapsed = true;

  cityMap: { [id: string]: string } = {};
  departments: { id: string; name: string }[] = [];
  users: { id: string; first_name: string; last_name: string }[] = [];



  loading = true;
  highlighted = false;
  private lastInspectionId: string | null = null;

  userFieldLabels: { [key: string]: string } = {
    role: 'תפקיד',
    email: 'אימייל',
    phone: 'מספר טלפון',
    username: 'שם משתמש',
    first_name: 'שם פרטי',
    last_name: 'שם משפחה',
    employee_id: 'מזהה עובד',
    department_id: 'מזהה מחלקה',
    license_file_url: 'קובץ רישיון',
    license_expiry_date: 'תוקף רישיון',
    has_government_license: 'רישיון ממשלתי',
    exceeded_monthly_trip_quota: 'חריגה מהמכסה החודשית',
  };

  getUserFieldLabel(key: string): string {
    return this.userFieldLabels[key] || key;
  }

  departmentFieldLabels: { [key: string]: string } = {
    id: 'מזהה מחלקה',
    name: 'שם מחלקה',
    supervisior_id: 'שם מנהל מחלקה',
  };

  getDepartmentFieldLabel(key: string): string {
    return this.departmentFieldLabels[key] || key;
  }


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
    department_id: 'מחלקה',
    mileage: 'מד מרחק',
  };

  getVehicleFieldLabel(key: string): string {
    return this.vehicleFieldLabels[key] || key;
  }

  private playAlertSound(): void {
    const audio = new Audio('assets/sounds/notif.mp3');
    audio.play().catch(err => {
      // Chrome may block this if user hasn't interacted yet (expected behavior)
      console.warn('🔇 Audio failed to play (autoplay policy):', err);
    });
  }

  getRideAuditRows(oldData: any, newData: any): Array<{ label: string, oldValue: any, newValue: any }> {
    return [
      { label: 'מזהה נסיעה', oldValue: oldData.id, newValue: newData.id },
      {
        label: 'מסלול',
        oldValue: `${this.getCityName(oldData.start_location)} → ${this.getCityName(oldData.stop)} → ${this.getCityName(oldData.destination)}`,
        newValue: `${this.getCityName(newData.start_location)} → ${this.getCityName(newData.stop)} → ${this.getCityName(newData.destination)}`
      },
      { label: 'סוג נסיעה', oldValue: this.translateRideType(oldData.ride_type), newValue: this.translateRideType(newData.ride_type) },
      { label: 'סיבת בחירה ברכב 4X4', oldValue: oldData.vehicle_type_reason, newValue: newData.vehicle_type_reason },
      { label: 'משתמש', oldValue: oldData.user_id, newValue: newData.user_id },
      { label: 'משתמש עוקף', oldValue: oldData.override_user_id, newValue: newData.override_user_id },
      { label: 'רכב', oldValue: oldData.vehicle_id, newValue: newData.vehicle_id },
      { label: 'סטטוס', oldValue: this.translateRideStatus(oldData.status), newValue: this.translateRideStatus(newData.status) },
      { label: 'זמן התחלה מושער', oldValue: oldData.start_datetime, newValue: newData.start_datetime },
      { label: 'זמן התחלה אמיתי', oldValue: oldData.actual_pickup_time, newValue: newData.actual_pickup_time },
      { label: 'זמן סיום', oldValue: oldData.end_datetime, newValue: newData.end_datetime },
      { label: 'תאריך שליחה', oldValue: oldData.submitted_at, newValue: newData.submitted_at },
      { label: 'מרחק מוערך (ק"מ)', oldValue: oldData.estimated_distance_km, newValue: newData.estimated_distance_km },
      { label: 'מרחק בפועל (ק"מ)', oldValue: oldData.actual_distance_km, newValue: newData.actual_distance_km },
      { label: 'בדיקת רישיון עברה', oldValue: oldData.license_check_passed, newValue: newData.license_check_passed },
      { label: 'אירוע חירום', oldValue: oldData.emergency_event, newValue: newData.emergency_event },

    ];
  }

  rideFieldLabels: { [key: string]: string } = {
    id: 'מזהה נסיעה',
    stop: 'עצירה',
    status: 'סטטוס',
    user_id: 'מזהה משתמש',
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

  private departmentHebrewMap: { [key: string]: string } = {
    Engineering: 'הנדסה',
    HR: 'משאבי אנוש',
    'IT Department': 'טכנולוגיות מידע',
    Finance: 'כספים',
    Security: 'ביטחון'
  };

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private socketService: SocketService,
    private cityService: CityService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private auditLogService: AuditLogsService
  ) { }

  getCityName(id: string): string {
    return this.cityMap[id] || id;
  }

  fetchDepartments(): void {
    this.http.get<any[]>('http://localhost:8000/api/departments').subscribe({
      next: (data) => {
        this.departments = data.map(dep => ({
          ...dep,
          name: this.departmentHebrewMap[dep.name] || dep.name
        }));
      },
      error: (err: any) => {
        this.toastService.show('שגיאה בטעינת רשימת מחלקות', 'error');

        this.departments = [];
      }
    });
  }

  getDepartmentNameById(id: string): string {
    const dep = this.departments.find(d => d.id === id);
    return dep ? dep.name : 'לא משוייך למחלקה';
  }

  fetchUsers(): void {
  this.http.get<any>('http://localhost:8000/api/users').subscribe({
    next: (data) => {
      const usersArr = Array.isArray(data.users) ? data.users : [];
      this.users = usersArr.map((user: any) => ({
        id: user.employee_id,
        first_name: user.first_name,
        last_name: user.last_name
      }));
    },
    error: (err: any) => {
      this.toastService.show('שגיאה בטעינת רשימת משתמשים', 'error');
      this.users = [];
    }
  });
}
  getUserNameById(id: string): string {
    if (!Array.isArray(this.users)) return id;
    const user = this.users.find(u => u.id === id);
    return user ? `${user.first_name} ${user.last_name}` : id;
  }

  // In AuditLogsComponent, inside fetchAuditLogs method
  fetchAuditLogs(fromDate?: string, toDate?: string) {
    this.loading = true;
    this.auditLogService.getAuditLogs(fromDate, toDate, this.problematicOnly).subscribe({
      next: (data) => {
        // Ensure data is an array before sorting/spreading
        this.logs = Array.isArray(data) ? data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [];
        this.loading = false;
        this.filterLogs();

        
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת יומני ביקורת', 'error');
        this.logs = [];
        this.filteredLogs = [];
        this.loading = false; 
      }
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

      }
    });

    this.route.queryParams.subscribe(params => {
      this.highlighted = params['highlight'] === '1';
    });

    this.fetchDepartments();
    this.fetchUsers();


    this.socketService.notifications$.subscribe((notif) => {
      if (notif?.message?.includes('בעיה חמורה')) {
        this.toastService.show('📢 בדיקה חדשה עם בעיה חמורה התקבלה', 'error');
        this.playAlertSound();
      }
    });

    this.socketService.newInspection$.subscribe((newInspection) => {
      if (
        newInspection &&
        newInspection.inspection_id !== this.lastInspectionId
      ) {

        this.lastInspectionId = newInspection.inspection_id;
        this.cdr.detectChanges();

        this.toastService.show('📢 התקבלה בדיקה חדשה');
        this.playAlertSound();
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


  filterLogs() {
    const searchLower = this.searchTerm.toLowerCase();
    let tempLogs = [...this.logs];

    if (this.showExceededQuotaOnly) { // <-- NEW FILTER LOGIC
      tempLogs = tempLogs.filter(log =>
        log.entity_type === 'User' &&
        log.action === 'UPDATE' &&
        log.change_data && // Ensure change_data exists
        log.change_data.new && // Ensure new data exists
        log.change_data.new.exceeded_monthly_trip_quota === true
      );
    }

    this.filteredLogs = tempLogs.filter(log =>
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

  getUserAuditRows(oldData: any, newData: any): Array<{ label: string, oldValue: any, newValue: any }> {
    return [
      { label: 'שם פרטי', oldValue: oldData.first_name, newValue: newData.first_name },
      { label: 'שם משפחה', oldValue: oldData.last_name, newValue: newData.last_name },
      { label: 'שם משתמש', oldValue: oldData.username, newValue: newData.username },
      { label: 'אימייל', oldValue: oldData.email, newValue: newData.email },
      { label: 'מספר טלפון', oldValue: oldData.phone, newValue: newData.phone },
      { label: 'תפקיד', oldValue: this.translateUserRole(oldData.role), newValue: this.translateUserRole(newData.role) },
      { label: 'מזהה עובד', oldValue: oldData.employee_id, newValue: newData.employee_id },
      { label: 'מחלקה', oldValue: this.getDepartmentNameById(oldData.department_id), newValue: this.getDepartmentNameById(newData.department_id) },
      { label: 'רישיון ממשלתי', oldValue: oldData.has_government_license, newValue: newData.has_government_license },
      { label: 'תוקף רישיון', oldValue: oldData.license_expiry_date, newValue: newData.license_expiry_date },
      { label: 'קובץ רישיון', oldValue: oldData.license_file_url, newValue: newData.license_file_url },
      { label: 'חריגה מהמכסה החודשית', oldValue: oldData.exceeded_monthly_trip_quota, newValue: newData.exceeded_monthly_trip_quota }
    ];
  }

  getDepartmentAuditRows(oldData: any, newData: any): Array<{ label: string, oldValue: any, newValue: any }> {
    return [
      { label: 'שם מחלקה', oldValue: oldData?.name, newValue: newData?.name },
      { label: 'שם מנהל מחלקה', oldValue: this.getUserNameById(oldData?.supervisor_id), newValue: this.getUserNameById(newData?.supervisor_id) },
    ];
  }

  getVehicleAuditRows(oldData: any, newData: any): Array<{ label: string, oldValue: any, newValue: any }> {
    return [
      { label: 'מספר רכב', oldValue: oldData.plate_number, newValue: newData.plate_number },
      { label: 'סוג רכב', oldValue: oldData.type, newValue: newData.type },
      { label: 'סוג דלק', oldValue: this.translateFuelType(oldData.fuel_type), newValue: this.translateFuelType(newData.fuel_type) },
      { label: 'סטטוס', oldValue: this.translateVehicleStatus(oldData.status), newValue: this.translateVehicleStatus(newData.status) },
      { label: 'שימוש אחרון', oldValue: oldData.last_used_at, newValue: newData.last_used_at }, // <-- Added this line
      { label: 'סיבת הקפאה', oldValue: this.translateFreezeReason(oldData.freeze_reason), newValue: this.translateFreezeReason(newData.freeze_reason) },
      { label: 'פרטי הקפאה', oldValue: oldData.freeze_details, newValue: newData.freeze_details },
      { label: 'מיקום נוכחי', oldValue: oldData.current_location, newValue: newData.current_location },
      { label: 'מחלקה', oldValue: this.getDepartmentNameById(oldData.department_id), newValue: this.getDepartmentNameById(newData.department_id) },
      { label: 'קילומטראז\'', oldValue: oldData.mileage, newValue: newData.mileage },
      { label: 'תאריך סיום ליסינג', oldValue: oldData.lease_expiry, newValue: newData.lease_expiry },
      { label: 'דגם רכב', oldValue: oldData.vehicle_model, newValue: newData.vehicle_model },
      { label: 'תמונה', oldValue: oldData.image_url, newValue: newData.image_url }
    ];
  }

  vehicleRedirect(vehicleId: string) {
    if (vehicleId) {
      this.router.navigate(['/vehicle-details', vehicleId]);
    }
  }
  translateFuelType(fuelType: string | null | undefined): string {
    if (!fuelType) return '';
    switch (fuelType.toLowerCase()) {
      case 'electric':
        return 'חשמלי';
      case 'hybrid':
        return 'היברידי';
      case 'gasoline':
        return 'בנזין';
      default:
        return fuelType;
    }
  }

  translateVehicleStatus(status: string | null | undefined): string {
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
  translateRideStatus(status: string | null | undefined): string {
    if (!status) return '';
    switch (status.toLowerCase()) {
      case 'pending':
        return 'ממתין';
      case 'approved':
        return 'מאושר';
      case 'rejected':
        return 'נדחה';
      case 'in_progress':
        return 'בתהליך';
      case 'completed':
        return 'הושלם';
      case 'cancelled_due_to_no_show':
        return 'בוטל עקב אי הגעה';
      default:
        return status;
    }
  }

  translateUserRole(userRole: string | null | undefined): string {
    if (!userRole) return '';
    switch (userRole.toLowerCase()) {
      case 'admin':
        return 'מנהל';
      case 'employee':
        return 'עובד';
      case 'superuser':
        return 'מנהל ישיר';
      case 'inspector':
        return 'בודק';
      default:
        return userRole;
    }
  }

  translateFreezeReason(freezeReason: string | null | undefined): string {
    if (!freezeReason) return '';
    switch (freezeReason.toLowerCase()) {
      case 'accident':
        return 'תאונה';
      case 'maintenance':
        return 'תחזוקה';
      case 'personal':
        return 'אישי';
      default:
        return freezeReason;
    }
  }

  translateRideType(rideType: string | null | undefined): string {
    if (!rideType) return '';
    switch (rideType.toLowerCase()) {
      case 'administrative':
        return 'מנהלתית';
      case 'operational':
        return 'מבצעית';
      default:
        return rideType;
    }
  }
}
