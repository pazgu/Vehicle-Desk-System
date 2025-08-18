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
import * as XLSX from 'xlsx-js-style';
import { VehicleService } from '../../../services/vehicle.service';

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

  showExceededQuotaOnly: boolean = false; // <-- NEW
  filtersCollapsed = true;

  cityMap: { [id: string]: string } = {};
  departments: { id: string; name: string }[] = [];
  users: { id: string; first_name: string; last_name: string; user_name: string }[] = [];
  vehicles: { id: string; vehicle_model: string; plate_number: string }[] = [];




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
        oldValue: this.formatRoute(oldData.start_location, oldData.stop, oldData.extra_stops, oldData.destination),
        newValue: this.formatRoute(newData.start_location, newData.stop, newData.extra_stops, newData.destination)
      },
      { label: 'סוג נסיעה', oldValue: this.translateRideType(oldData.ride_type), newValue: this.translateRideType(newData.ride_type) },
      { label: 'סיבת בחירה ברכב 4X4', oldValue: oldData.vehicle_type_reason, newValue: newData.vehicle_type_reason },
      { label: 'שם משתמש', oldValue: this.getUserFullNameById(oldData.user_id), newValue: this.getUserFullNameById(newData.user_id) },
      { label: 'שם משתמש עוקף', oldValue: this.getUserFullNameById(oldData.override_user_id), newValue: this.getUserFullNameById(newData.override_user_id) },
      { label: 'לוחית רישוי', oldValue: this.getPlateNumber(oldData.vehicle_id), newValue: this.getPlateNumber(newData.vehicle_id) },
      { label: 'דגם רכב', oldValue: this.getVehicleModel(oldData.vehicle_id), newValue: this.getVehicleModel(newData.vehicle_id) },
      { label: 'סטטוס', oldValue: this.translateRideStatus(oldData.status), newValue: this.translateRideStatus(newData.status) },
      { label: 'זמן התחלה מושער', oldValue: oldData.start_datetime, newValue: newData.start_datetime },
      { label: 'זמן התחלה אמיתי', oldValue: oldData.actual_pickup_time, newValue: newData.actual_pickup_time },
      { label: 'זמן סיום', oldValue: oldData.end_datetime, newValue: newData.end_datetime },
      { label: 'תאריך שליחה', oldValue: oldData.submitted_at, newValue: newData.submitted_at },
      { label: 'מרחק מוערך (ק"מ)', oldValue: oldData.estimated_distance_km, newValue: newData.estimated_distance_km },
      { label: 'מרחק משוער אחרי סטייה (ק"מ)', oldValue: oldData.actual_distance_km, newValue: newData.actual_distance_km },
      { label: 'בדיקת רישיון עברה', oldValue: oldData.license_check_passed, newValue: newData.license_check_passed },
      { label: 'אירוע חירום', oldValue: oldData.emergency_event, newValue: newData.emergency_event },

    ];
  }

  rideFieldLabels: { [key: string]: string } = {
    id: 'מזהה נסיעה',
    stop: 'עצירה',
    status: 'סטטוס הזמנה',
    user_id: 'מזהה משתמש',
    ride_type: 'סוג נסיעה',
    vehicle_id: 'מזהה רכב',
    destination: 'יעד',
    start_datetime: 'תאריך התחלת נסיעה',
    end_datetime: 'תאריך סיום נסיעה',
    submitted_at: 'תאריך שליחת הזמנה',
    start_location: 'מיקום התחלה',
    emergency_event: 'אירוע חירום',
    override_user_id: 'מזהה משתמש עוקף',
    actual_distance_km: 'מרחק משוער אחרי סטייה (ק"מ)',
    license_check_passed: 'עבר בדיקת רישיון',
    estimated_distance_km: 'מרחק משוער (ק"מ)',
    vehicle_type_reason: 'סיבת בחירה ברכב מסוג 4X4',
    extra_stops: 'עצירות נוספות',
  };
  
  formatRoute(start: string, stop: string, extraStops: string[] | undefined, destination: string): string {
  const allStops = [start, stop, ...(extraStops || []), destination];

  return allStops
    .filter(Boolean) // remove null/undefined
    .map(id => this.getCityName(id))
    .join(' ← ');
}
formatRouteFromChangeData(changeData: any): string {
  const start = changeData.start_location;
  const stop = changeData.stop;
  const destination = changeData.destination;
  const extraStops = changeData.extra_stops; // already an array or undefined

  const allStops = [start, stop, ...(extraStops || []), destination];

  return allStops
    .filter(Boolean)
    .map(id => this.getCityName(id))
    .join(' ← ');
}


  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private socketService: SocketService,
    private cityService: CityService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private auditLogService: AuditLogsService,
    private vehicleService: VehicleService
  ) { }

  getCityName(id: string): string {
    return this.cityMap[id] || id;
  }

  fetchDepartments(): void {
    this.http.get<any[]>('http://localhost:8000/api/departments').subscribe({
      next: (data) => {
        this.departments = data.map(dep => ({
          ...dep,
          name: dep.name
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
          last_name: user.last_name,
          user_name: user.username,
        }));
      },
      error: (err: any) => {
        this.toastService.show('שגיאה בטעינת רשימת משתמשים', 'error');
        this.users = [];
      }
    });
  }
  getUserFullNameById(id: string): string {
    if (!Array.isArray(this.users)) return id;
    const user = this.users.find(u => u.id === id);
    return user ? `${user.first_name} ${user.last_name}` : id;
  }
  getUsernameById(id: string): string {
    if (!Array.isArray(this.users)) return id;
    const user = this.users.find(u => u.id === id);
    return user ? `${user.user_name}` : id;
  }

  // In AuditLogsComponent, inside fetchAuditLogs method
  fetchAuditLogs(fromDate?: string, toDate?: string) {
    this.loading = true;
    this.auditLogService.getAuditLogs(fromDate, toDate).subscribe({
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
    this.fetchVehicles();


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
      const from = this.customFromDate ? new Date(this.customFromDate + 'T00:00:00') : undefined;
      const to = this.customToDate ? new Date(this.customToDate + 'T23:59:59') : undefined;

      if (from && to && from > to) {
        this.toastService.show('תאריך ההתחלה לא יכול להיות אחרי תאריך הסיום.', 'error');
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

  getStatusColor(status: string): string {
    const statusColorMap: { [key: string]: string } = {
      'אושר': '#66BB6A', // green
      'הסתיים': '#66BB6A',
      'פעולה בוצעה בהצלחה': '#66BB6A',
      'מוקפא': '#81D4FA', // light blue
      'פעיל': '#FFD54F', // yellow
      'בתהליך': '#FFD54F',
      'בשימוש': '#FFD54F',
      'בתחזוקה': '#FFF176', // light yellow
      'נדחה': '#EF5350', // red
      'אירוע חירום': '#FFB74D', // orange
      'חריגה מהמחסה החודשית': '#A1887F', // brownish
      'בוטל עקב אי הגעה': '#CE93D8', // purple-pink
      'נמחק': '#F48FB1' // pink
    };

    return statusColorMap[status] || '#FFFFFF'; // fallback to white
  }
  getStatusLabel(status: string): string {
    const statusLabelMap: { [key: string]: string } = {
      'אושר': 'Approved',
      'הסתיים': 'Completed',
      'פעולה בוצעה בהצלחה': 'Success',
      'מוקפא': 'Frozen',
      'פעיל': 'Active',
      'בתהליך': 'In Progress',
      'בשימוש': 'In Use',
      'בתחזוקה': 'Under Maintenance',
      'נדחה': 'Rejected',
      'אירוע חירום': 'Emergency',
      'חריגה מהמחסה החודשית': 'Monthly Limit Exceeded',
      'בוטל עקב אי הגעה': 'Canceled - No Show',
      'נמחק': 'Deleted'
    };

    return statusLabelMap[status] || 'Unknown';
  }


  // Add this helper method to get row background color based on log status
  private getRowBackgroundColor(log: any): string {
    // Check for specific conditions that match your CSS classes

    // Delete operations
    if (log.action === 'DELETE') {
      return '#f8e2e2'; // delete-row color
    }

    // Emergency events
    if (log.action === 'UPDATE' && log.entity_type === 'Ride' &&
      (log.change_data?.new?.emergency_event === true || log.change_data?.new?.emergency_event === 'true')) {
      return '#feaf66'; // emergency-row color
    }

    // Frozen vehicles
    if (log.entity_type === 'Vehicle' && log.change_data?.new?.status === 'frozen') {
      return '#e2f0f8'; // frozen-vehicle-row color
    }

    // Pending rides
    if (log.entity_type === 'Ride' && (
      (log.action === 'UPDATE' && log.change_data?.new?.status === 'pending') ||
      (log.action === 'INSERT' && log.change_data?.status === 'pending')
    )) {
      return '#fbf3da'; // pending-row color
    }

    // Active rides/vehicles (in progress/in use)
    if ((log.entity_type === 'Ride' && log.change_data?.new?.status === 'in_progress') ||
      (log.entity_type === 'Vehicle' && log.change_data?.new?.status === 'in_use')) {
      return '#ffe5b4'; // active-row color
    }

    // Approved/completed rides
    if (log.entity_type === 'Ride' &&
      (log.change_data?.new?.status === 'approved' || log.change_data?.new?.status === 'completed')) {
      return '#60cd79'; // approved-row color
    }

    // Rejected rides
    if (log.entity_type === 'Ride' && log.change_data?.new?.status === 'rejected') {
      return '#dc5b5b'; // rejected-row color
    }

    // Cancelled due to no show
    if (log.entity_type === 'Ride' && log.action === 'UPDATE' &&
      (log.change_data?.new?.status === 'cancelled_due_to_no_show' ||
        log.change_data?.new?.status === 'cancelled-due-to-no-show')) {
      return '#e0d6e8'; // cancelled-due-to-no-show color
    }

    // Exceeded monthly trip quota
    if (log.entity_type === 'User' && log.change_data?.new?.exceeded_monthly_trip_quota === true) {
      return '#cdb69b'; // exceeded-monthly-trip-quota-row color
    }

    // Success operations (User/Department/Vehicle INSERT/UPDATE)
    if ((log.entity_type === 'User' && (log.action === 'INSERT' || log.action === 'UPDATE')) ||
      (log.entity_type === 'Department' && (log.action === 'INSERT' || log.action === 'UPDATE')) ||
      (log.entity_type === 'Vehicle' && (
        (log.action === 'UPDATE' && (log.change_data?.new?.status === 'available' || log.change_data?.new?.status === 'approved')) ||
        log.action === 'INSERT'
      ))) {
      return '#dcf1e1'; // success-row color
    }

    // Default color
    return '#ffffff';
  }

  // Add this helper method to get English status labels
  private getEnglishStatusLabel(log: any): string {
    if (log.action === 'DELETE') {
      return 'Deleted';
    }

    if (log.action === 'UPDATE' && log.entity_type === 'Ride' &&
      (log.change_data?.new?.emergency_event === true || log.change_data?.new?.emergency_event === 'true')) {
      return 'Emergency Event';
    }

    if (log.entity_type === 'Vehicle' && log.change_data?.new?.status === 'frozen') {
      return 'Frozen';
    }

    if (log.entity_type === 'Ride') {
      const status = log.change_data?.new?.status || log.change_data?.status;
      switch (status?.toLowerCase()) {
        case 'pending': return 'Pending';
        case 'approved': return 'Approved';
        case 'completed': return 'Completed';
        case 'rejected': return 'Rejected';
        case 'in_progress': return 'In Progress';
        case 'cancelled_due_to_no_show':
        case 'cancelled-due-to-no-show': return 'Cancelled - No Show';
        default: return status || 'Unknown';
      }
    }

    if (log.entity_type === 'Vehicle') {
      const status = log.change_data?.new?.status || log.change_data?.status;
      switch (status?.toLowerCase()) {
        case 'available': return 'Available';
        case 'in_use': return 'In Use';
        case 'frozen': return 'Frozen';
        default: return status || 'Unknown';
      }
    }

    if (log.entity_type === 'User' && log.change_data?.new?.exceeded_monthly_trip_quota === true) {
      return 'Monthly Limit Exceeded';
    }

    if ((log.entity_type === 'User' || log.entity_type === 'Department') &&
      (log.action === 'INSERT' || log.action === 'UPDATE')) {
      return 'Success';
    }

    return 'Unknown';
  }

  // Updated PDF export method
  exportToPDF() {
    const weeklyLogs = this.getLogsForThisWeek();
    const timestamp = new Date().toLocaleString('en-GB');
    const safeTimestamp = timestamp.replace(/[/:]/g, '-');

    const body: any[] = [
      [
        { text: 'Action Type', style: 'tableHeader' },
        { text: 'Full Name', style: 'tableHeader' },
        { text: 'Entity Type', style: 'tableHeader' },
        { text: 'Status', style: 'tableHeader' },
        { text: 'Date Created', style: 'tableHeader' }
      ]
    ];

    weeklyLogs.forEach(log => {
      const statusLabel = this.getEnglishStatusLabel(log);
      const bgColor = this.getRowBackgroundColor(log);

      body.push([
        { text: log.action, fillColor: bgColor } as any,
        { text: log.full_name || '—', fillColor: bgColor } as any,
        { text: log.entity_type || '—', fillColor: bgColor } as any,
        { text: statusLabel, fillColor: bgColor } as any,
        { text: new Date(log.created_at).toLocaleString('en-GB'), fillColor: bgColor } as any
      ]);
    });

    const docDefinition: TDocumentDefinitions = {
      content: [
        { text: `Audit Logs Report`, style: 'header', alignment: 'center' },
        { text: `Created: ${timestamp}`, style: 'subheader', alignment: 'center' },
        { text: `Color Legend:`, style: 'legendHeader', alignment: 'left', margin: [0, 20, 0, 10] } as any,
        {
          table: {
            headerRows: 0,
            widths: ['auto', '*'],
            body: [
              [
                { text: '', fillColor: '#60cd79', margin: [0, 2] } as any,
                { text: 'Approved / Completed', fontSize: 10 } as any
              ],
              [
                { text: '', fillColor: '#dcf1e1', margin: [0, 2] } as any,
                { text: 'Success Operation', fontSize: 10 } as any
              ],
              [
                { text: '', fillColor: '#e2f0f8', margin: [0, 2] } as any,
                { text: 'Frozen', fontSize: 10 } as any
              ],
              [
                { text: '', fillColor: '#ffe5b4', margin: [0, 2] } as any,
                { text: 'Active (In Progress/In Use)', fontSize: 10 } as any
              ],
              [
                { text: '', fillColor: '#fbf3da', margin: [0, 2] } as any,
                { text: 'Pending', fontSize: 10 } as any
              ],
              [
                { text: '', fillColor: '#dc5b5b', margin: [0, 2] } as any,
                { text: 'Rejected', fontSize: 10 } as any
              ],
              [
                { text: '', fillColor: '#feaf66', margin: [0, 2] } as any,
                { text: 'Emergency Event', fontSize: 10 } as any
              ],
              [
                { text: '', fillColor: '#f8e2e2', margin: [0, 2] } as any,
                { text: 'Deleted', fontSize: 10 } as any
              ],
              [
                { text: '', fillColor: '#e0d6e8', margin: [0, 2] } as any,
                { text: 'Cancelled - No Show', fontSize: 10 } as any
              ],
              [
                { text: '', fillColor: '#cdb69b', margin: [0, 2] } as any,
                { text: 'Monthly Limit Exceeded', fontSize: 10 } as any
              ]
            ]
          },
          layout: 'noBorders',
          margin: [0, 0, 0, 20]
        } as any,
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', '*', '*', 'auto'],
            body: body
          },
          layout: {
            fillColor: (rowIndex: number) => rowIndex === 0 ? '#f2f2f2' : null
          }
        } as any
      ],
      defaultStyle: {
        font: 'Roboto',
        fontSize: 11
      },
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10]
        },
        subheader: {
          fontSize: 12,
          margin: [0, 0, 0, 20]
        },
        legendHeader: {
          fontSize: 14,
          bold: true,
          color: '#942222'
        },
        tableHeader: {
          fontSize: 12,
          bold: true,
          alignment: 'center'
        }
      }
    };

    pdfMake.createPdf(docDefinition).download(`audit_logs_${safeTimestamp}.pdf`);
  } exportToCSV() {
    const weeklyLogs = this.getLogsForThisWeek();
    const timestamp = new Date().toLocaleString('en-GB').replace(/[/:]/g, '-');

    // Color legend section
    const legendRows = [
      ['# Color Legend (Row background colors used in PDF/Excel):'],
      ['Color', 'Meaning'],
      ['#60cd79', 'Approved / Completed'],
      ['#dcf1e1', 'Success Operation'],
      ['#e2f0f8', 'Frozen'],
      ['#ffe5b4', 'Active (In Progress / In Use)'],
      ['#fbf3da', 'Pending'],
      ['#dc5b5b', 'Rejected'],
      ['#feaf66', 'Emergency Event'],
      ['#f8e2e2', 'Deleted'],
      ['#e0d6e8', 'Cancelled - No Show'],
      ['#cdb69b', 'Monthly Limit Exceeded'],
      [''],
    ];

    // Main data headers
    const headers = ['Action', 'Full Name', 'Entity Type', 'Status', 'Date Created', 'Row Color'];

    // Log rows
    const dataRows = weeklyLogs.map(log => {
      const statusLabel = this.getEnglishStatusLabel(log);
      const bgColor = this.getRowBackgroundColor(log);

      return [
        log.action,
        log.full_name || '—',
        log.entity_type || '—',
        statusLabel,
        new Date(log.created_at).toLocaleString('en-GB'),
        bgColor
      ];
    });

    // Combine legend + data
    const csv = Papa.unparse({
      fields: [], // optional since we give full 2D array
      data: [...legendRows, headers, ...dataRows]
    });

    // Save the file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `audit_logs_colored_${timestamp}.csv`);
  }


  exportToExcel() {
    const weeklyLogs = this.getLogsForThisWeek(); // Your real log data
    const timestamp = new Date().toLocaleString('en-GB').replace(/[/:]/g, '-');

    // Define legend rows
    const legendRows = [
      ['Color', 'Meaning'],
      [' ', 'Approved / Completed'],
      [' ', 'Success Operation'],
      [' ', 'Frozen'],
      [' ', 'Active (In Progress/In Use)'],
      [' ', 'Pending'],
      [' ', 'Rejected'],
      [' ', 'Emergency Event'],
      [' ', 'Deleted'],
      [' ', 'Cancelled - No Show'],
      [' ', 'Monthly Limit Exceeded']
    ];

    const legendColors = [
      '', '#60cd79', '#dcf1e1', '#e2f0f8', '#ffe5b4',
      '#fbf3da', '#dc5b5b', '#feaf66', '#f8e2e2', '#e0d6e8', '#cdb69b'
    ];

    const data = [
      ['Action', 'Full Name', 'Entity Type', 'Status', 'Date Created'],
      ...weeklyLogs.map(log => [
        log.action,
        log.full_name || '—',
        log.entity_type || '—',
        this.getEnglishStatusLabel(log),
        new Date(log.created_at).toLocaleString('en-GB')
      ])
    ];

    const bgColors = weeklyLogs.map(log => {
      const color = this.getRowBackgroundColor(log);
      return [color, color, color, color, color];
    });

    // Combine legend + data with spacing row
    const fullSheet: any[][] = [...legendRows, [''], ...data];

    const wsData: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(fullSheet);

    // Style all rows
    const legendLength = legendRows.length;
    fullSheet.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });

        if (!wsData[cellRef]) return;

        // Header styling
        if (rowIndex === legendLength) {
          wsData[cellRef].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: 'E0E0E0' } }
          };
          return;
        }

        // Legend color square
        if (rowIndex > 0 && rowIndex < legendLength && colIndex === 0) {
          wsData[cellRef].s = {
            fill: { fgColor: { rgb: legendColors[rowIndex].replace('#', '') } }
          };
          return;
        }

        // Main table rows
        if (rowIndex > legendLength) {
          const colorIndex = rowIndex - legendLength - 1;
          const bgColor = bgColors[colorIndex]?.[colIndex] || '#FFFFFF';
          wsData[cellRef].s = {
            fill: { fgColor: { rgb: bgColor.replace('#', '') } }
          };
        }
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsData, 'Audit Logs');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `audit_logs_${timestamp}.xlsx`);
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
      { label: 'שם מנהל מחלקה', oldValue: this.getUserFullNameById(oldData?.supervisor_id), newValue: this.getUserFullNameById(newData?.supervisor_id) },
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

  fetchVehicles(): void {
    this.vehicleService.getAllVehicles().subscribe(
      (data) => {
        this.vehicles = Array.isArray(data) ? data.map(vehicle => ({
          ...vehicle,
        })) : [];
      },
      (error) => {
        this.toastService.show('שגיאה בטעינת רכבים', 'error');
      }
    );
  }

  getVehicleById(vehicleId: string): { vehicle_model: string; plate_number: string } | undefined {
    return this.vehicles.find(vehicle => vehicle.id === vehicleId);
  }
  getVehicleModel(vehicleId: string): string {
    const vehicle = this.getVehicleById(vehicleId);
    return vehicle ? `${vehicle.vehicle_model}` : 'לא זמין';
  }
  getPlateNumber(vehicleId: string): string {
    const vehicle = this.getVehicleById(vehicleId);
    return vehicle ? `${vehicle.plate_number}` : 'לא זמין';
  }
}
