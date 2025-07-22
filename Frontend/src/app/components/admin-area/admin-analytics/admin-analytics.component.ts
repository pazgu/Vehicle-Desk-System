import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartModule } from 'primeng/chart';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { SocketService } from '../../../services/socket.service';
import * as Papa from 'papaparse';
import { saveAs } from 'file-saver';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import * as XLSX from 'xlsx-js-style';
import { cloneDeep } from 'lodash';

import { VehicleService } from '../../../services/vehicle.service';
import { FreezeReason, VehicleOutItem } from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { ToastService } from '../../../services/toast.service';
import { TopNoShowUser } from '../../../models/no-show-stats.model';
import { StatisticsService } from '../../../services/statistics.service';
import { UserService } from '../../../services/user_service';
import { Router } from '@angular/router';


pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    TabViewModule
  ],
  templateUrl: './admin-analytics.component.html',
  styleUrls: ['./admin-analytics.component.css'],
})

export class AdminAnalyticsComponent implements OnInit {

  vehicleChartData: any;
  vehicleChartOptions: any;
  rideChartData: any;
  rideChartOptions: any; 
  selectedSortOption = 'default';
  activeTabIndex = 0;
  frozenVehicles=<VehicleOutItem[]>[];
  // Initialization flags
  vehicleChartInitialized = false;
  rideChartInitialized = false;
  isMonthlyView = true; // monthly = default
showChart = true;

selectedMonth = (new Date().getMonth() + 1).toString(); // default = current month
selectedYear = new Date().getFullYear().toString(); // default = current year

monthlyChartData: any;
monthlyChartOptions: any;
allTimeChartData: any;
allTimeChartOptions: any;

 // 🆕 No-show chart + summary + table

  totalNoShows: number = 0;
  topNoShowUsers: TopNoShowUser[] = [];

  noShowFromDate?: string;
  noShowToDate?: string; 


topUsedVehiclesData: any;
topUsedVehiclesOptions: any;
monthlyStatsChartData: any;
monthlyStatsChartOptions: any;

allTimeStatsChartData: any;
allTimeStatsChartOptions: any;
uniqueNoShowUsers: number = 0;


 // 🆕 ADD these two properties for department caching
  private departmentsMap = new Map<string, string>(); // To store department ID -> Name
  private departmentsLoaded: boolean = false;        // To track if departments are loaded


months = [
  { value: '1', label: 'ינואר' },
  { value: '2', label: 'פברואר' },
  { value: '3', label: 'מרץ' },
  { value: '4', label: 'אפריל' },
  { value: '5', label: 'מאי' },
  { value: '6', label: 'יוני' },
  { value: '7', label: 'יולי' },
  { value: '8', label: 'אוגוסט' },
  { value: '9', label: 'ספטמבר' },
  { value: '10', label: 'אוקטובר' },
  { value: '11', label: 'נובמבר' },
  { value: '12', label: 'דצמבר' },
];

years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

 
  constructor(private http: HttpClient, private socketService: SocketService,private vehicleService:VehicleService,  private toastService: ToastService
   ,private statisticsService: StatisticsService, private userService: UserService, private router: Router) {}

  ngOnInit() {
  this.loadVehicleChart();
  this.loadRideChart();
  this.loadFrozenVehicles();
  this.loadNoShowStatistics();
  this.loadDepartments(); // <--- Call this to load departments and then no-show stats




  // 👇 Only load monthly chart at start (do NOT override with all-time yet)
  // if (this.isMonthlyView) {
  //   this.loadTopUsedVehiclesChart();
  // } else {
  //   this.loadAllTimeTopUsedVehiclesChart();
  // }

    this.loadTopUsedVehiclesChart();
    this.loadAllTimeTopUsedVehiclesChart();
    this.socketService.rideStatusUpdated$.subscribe(() => {
      console.log('🔔 rideStatusUpdated$ triggered');
      this.loadRideChart();

    });

    this.socketService.vehicleStatusUpdated$.subscribe(() => {
      console.log('🔔 vehicleStatusUpdated$ triggered');
      this.loadVehicleChart();
      this.loadFrozenVehicles();
    });

    this.socketService.deleteRequests$.subscribe(() => {
      console.log('🔔 deleteRequest$ triggered');
      this.loadRideChart();
      this.loadVehicleChart();
     this.loadFrozenVehicles();

    });
  }

toggleUsageView() {
  this.isMonthlyView = !this.isMonthlyView;
  console.log('isMonthlyView:', this.isMonthlyView);
  if (this.isMonthlyView) {
    console.log('Loading monthly chart');
    this.loadTopUsedVehiclesChart();
    this.reloadChart();
  } else {
    console.log('Loading all-time chart');
    this.loadAllTimeTopUsedVehiclesChart();
    this.reloadChart();
  }
}




 private countFreezeReasons(frozenVehicles: VehicleOutItem[]) {
  const freezeReasonCounts: Record<FreezeReason, number> = {
    [FreezeReason.accident]: 0,
    [FreezeReason.maintenance]: 0,
    [FreezeReason.personal]: 0,
  };

  frozenVehicles.forEach(vehicle => {
    if (vehicle.freeze_reason) {
      const reason = vehicle.freeze_reason as FreezeReason;
      freezeReasonCounts[reason]++;
    }
  });

  return freezeReasonCounts;
}
private loadFrozenVehicles():void{
     this.vehicleService.getAllVehiclesByStatus('frozen').subscribe((vehicles) => {
  this.frozenVehicles = vehicles;
});
}
getFreezeReasonHebrew(reason: FreezeReason): string {
  const reasonMap: { [key in FreezeReason]: string } = {
    accident: 'תאונה',
    maintenance: 'תחזוקה',
    personal: 'שימוש אישי'
  };
  return reasonMap[reason] || reason;
}


  private loadVehicleChart() {
    this.http.get<{ status: string; count: number }[]>(`${environment.apiUrl}/analytics/vehicle-status-summary`)
      .subscribe(data => {
        console.log('🚗 Vehicle Status Data:', data);
        this.updateVehicleChart(data);
        this.vehicleChartInitialized = true;
      });
  }
  

  private loadRideChart() {
    this.http.get<{ status: string; count: number }[]>(`${environment.apiUrl}/analytics/ride-status-summary`)
      .subscribe({
        next: (data) => {
          console.log('🚌 Ride Status Data:', data);
          console.log('🚌 Data length:', data?.length);
          console.log('🚌 Data structure:', JSON.stringify(data, null, 2));
          
          if (!data || data.length === 0) {
            console.warn('⚠️ No ride data received');
            this.rideChartData = {
              labels: ['אין נתונים'],
              datasets: [{
                data: [1],
                backgroundColor: ['#E0E0E0'],
                hoverBackgroundColor: ['#F0F0F0']
              }]
            };
          } else {
            this.updateRideChart(data);
          }
          this.rideChartInitialized = true;
        },
        error: (error) => {
          console.error('❌ Error loading ride data:', error);
          this.rideChartInitialized = true;
          this.rideChartData = {
            labels: ['שגיאה בטעינת נתונים'],
            datasets: [{
              data: [1],
              backgroundColor: ['#FF5252'],
              hoverBackgroundColor: ['#FF7777']
            }]
          };
        }
      });
  }


  private updateVehicleChart(data: { status: string; count: number }[]) {
    const labels = data.map(d => this.getHebrewLabel(d.status));
    const values = data.map(d => d.count);
    const total = values.reduce((sum, val) => sum + val, 0);
const updatedLabels = labels.map((label, i) => {
  const count = values[i];
  const percent = ((count / total) * 100).toFixed(1);
  return `${label} – ${count} רכבים (${percent}%)`;
});

    
const newVehicleChartData = {
labels: updatedLabels,
      datasets: [{
        data: [...values],
        backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726'],
        hoverBackgroundColor: ['#64B5F6', '#81C784', '#FFB74D']
      }]
    };
    
    this.vehicleChartData = { ...newVehicleChartData };

  this.vehicleChartOptions = {
  plugins: {
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const label = context.label || '';

          if (label.toLowerCase().includes('מוקפא')) {
            const freezeReasonCounts = this.countFreezeReasons(this.frozenVehicles);

            const reasonsText = Object.entries(freezeReasonCounts)
              .filter(([_, count]) => count > 0)
              .map(([reason, count]) => `${this.getFreezeReasonHebrew(reason as FreezeReason)}: ${count}`)
              .join(', ');

            return `${label}:\nסיבות הקפאה: ${reasonsText}`;
          }

          return `${label}:`;
        }
      }
    },
    legend: {
      position: 'top',
      labels: { color: '#495057',
        font: {
          size: 14,    
          family: 'Arial, sans-serif'
        },
        usePointStyle: true  
       }
    }
  },
  responsive: true,
  maintainAspectRatio: false,
  locale: 'he-IL'
};

  }

  private updateRideChart(data: { status: string; count: number }[]) {
    console.log('🔄 Updating ride chart with data:', data);
    
    
    const labels = data.map(d => {
      const hebrewLabel = this.getRideStatusHebrew(d.status);
      console.log(`Status: ${d.status} -> Hebrew: ${hebrewLabel}`);
      return hebrewLabel;
    });
    const values = data.map(d => d.count);
    const total = values.reduce((sum, val) => sum + val, 0);
const updatedLabels = labels.map((label, i) => {
  const count = values[i];
  const percent = ((count / total) * 100).toFixed(1);
  return `${label} – ${count} רכבים (${percent}%)`;
});

    
    console.log('📊 Chart labels:', labels);
    console.log('📊 Chart values:', values);

    const newrideChartData = {
labels: updatedLabels,
      datasets: [{
        data: [...values],
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
        hoverBackgroundColor: ['#FF6384CC', '#36A2EBCC', '#FFCE56CC', '#4BC0C0CC', '#9966FFCC', '#FF9F40CC']
      }]
    };
    
    this.rideChartData = { ...newrideChartData };

    this.rideChartOptions = {
      plugins: {
        legend: { 
          labels: { 
            color: '#495057',
            font: {
              size: 14,
              family: 'Arial, sans-serif'
            },
            usePointStyle: true
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      locale: 'he-IL' // Hebrew locale
    };
    
    console.log('✅ Final rideChartData:', this.rideChartData);
  }

  onSortChange() {
    const sortFunctions = {
      countAsc: (a: { status: string; count: number }, b: { status: string; count: number }) => a.count - b.count,
      countDesc: (a: { status: string; count: number }, b: { status: string; count: number }) => b.count - a.count,
      alphabetical: (a: { status: string; count: number }, b: { status: string; count: number }) => a.status.localeCompare(b.status),
      default: () => 0
    };

    const sortFn = sortFunctions[this.selectedSortOption as keyof typeof sortFunctions];

    if (this.activeTabIndex === 0) {
      this.http.get<{ status: string; count: number }[]>(`${environment.apiUrl}/analytics/vehicle-status-summary`)
        .subscribe(data => {
          const sortedData = this.selectedSortOption === 'default' ? data : [...data].sort(sortFn);
          this.updateVehicleChart(sortedData);
        });
    } else {
      this.http.get<{ status: string; count: number }[]>(`${environment.apiUrl}/analytics/ride-status-summary`)
        .subscribe(data => {
          const sortedData = this.selectedSortOption === 'default' ? data : [...data].sort(sortFn);
          this.updateRideChart(sortedData);
        });
    }
  }

  onTabChange(index: number) {
    this.activeTabIndex = index;
  }

  public loadNoShowStatistics(): void {
  const formattedFromDate = this.noShowFromDate || undefined;
  const formattedToDate = this.noShowToDate || undefined;


  this.statisticsService.getTopNoShowUsers(formattedFromDate, formattedToDate).subscribe({
    next: (noShowData) => {
      this.totalNoShows = noShowData.total_no_show_events;
      this.uniqueNoShowUsers = noShowData.unique_no_show_users;
      this.topNoShowUsers = noShowData.top_no_show_users;
      console.log("👀 Top No-Show Users:", this.topNoShowUsers);

    },
    error: (err) => {
      console.error('❌ Failed to load no-show statistics:', err);
      this.toastService.show('אירעה שגיאה בטעינת נתוני אי-הגעה.', 'error');

      // Reset values on error
      this.topNoShowUsers = [];
      this.totalNoShows = 0;
      this.uniqueNoShowUsers = 0;
    }
  });
}

  getHebrewLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      'available': 'זמין',
      'in_use': 'בשימוש',
      'frozen': 'מוקפא'
    };
    return statusMap[status] || status;
  }

  getRideStatusHebrew(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'ממתין',
      'approved': 'מאושר',
      'rejected': 'נדחה',
      'in_progress': 'בתהליך',
      'completed': 'הושלם',
      'cancelled_due_to_no_show': 'בוטלה-נסיעה לא בוצעה'
    };
    return statusMap[status] || status;
  }

  // 🆕 ADD this new method to load departments
  private loadDepartments(): void {
    this.userService.getDepartments().subscribe({
      next: (departments) => {
        departments.forEach(dep => this.departmentsMap.set(dep.id, dep.name));
        this.departmentsLoaded = true; // Mark departments as loaded
        console.log('AdminAnalyticsComponent: Departments loaded and cached.');
        // Call loadNoShowStatistics ONLY after departments are successfully loaded
        this.loadNoShowStatistics();
      },
      error: (err) => {
        console.error('❌ Failed to load departments from UserService:', err);
        this.toastService.show('אירעה שגיאה בטעינת נתוני מחלקות.', 'error');
        this.departmentsLoaded = false; // Mark as failed to load
        // If departments fail to load, still try to load no-show stats
        // Department names in the table will then default to "מחלקה לא ידועה"
        this.loadNoShowStatistics();
      }
    });
  }


goToUserDetails(userId: string) {
  this.router.navigate(['/user-card', userId]);
}
 // 🆕 MODIFY: Use the component's internal departmentsMap
  resolveDepartment(departmentId: string): string {
    return this.departmentsMap.get(departmentId) || 'מחלקה לא ידועה';
  }


 public exportPDF(): void {
  const isVehicleTab = this.activeTabIndex === 0;
  const isRideTab = this.activeTabIndex === 1;
  const isTopUsedTab = this.activeTabIndex === 2;

  const chartData = isVehicleTab
    ? this.vehicleChartData
    : isRideTab
      ? this.rideChartData
      : this.topUsedVehiclesData;

 const title = isVehicleTab
  ? 'Vehicle Status Summary'
  : isRideTab
    ? 'Ride Status Summary'
    : this.isMonthlyView
      ? 'Monthly Vehicle Usage'
      : 'Top Used Vehicles';


  const timestamp = new Date().toLocaleString();
  const safeTimestamp = timestamp.replace(/[/:]/g, '-');

  let body: any[] = [];

  if (isTopUsedTab) {
    const labels = chartData.labels;
    const data = chartData.datasets[0].data;

    body.push([
      { text: 'Vehicle', style: 'tableHeader' },
      { text: 'Ride Count', style: 'tableHeader' },
      { text: 'Usage Level', style: 'tableHeader' }
    ]);

    for (let i = 0; i < labels.length; i++) {
      const count = data[i];
      let usageLabel = '';
      let bgColor = '';

      if (count > 10) {
        usageLabel = 'High Usage';
        bgColor = '#FFCDD2'; // light red
      } else if (count >= 5) {
        usageLabel = 'Medium';
        bgColor = '#FFF9C4'; // light yellow
      } else {
        usageLabel = 'Good';
        bgColor = '#BBDEFB'; // light blue
      }

      body.push([
        { text: labels[i], fillColor: bgColor },
        { text: count.toString(), fillColor: bgColor },
        { text: usageLabel, fillColor: bgColor }
      ]);
    }
  } else {
    const statusKeys = chartData.labels.map((label: string) => {
      const match = label.split('–')[0].trim();
      return match;
    });

    body.push([
      { text: 'Status', style: 'tableHeader' },
      { text: 'Count', style: 'tableHeader' }
    ]);

    for (let i = 0; i < statusKeys.length; i++) {
      const hebrew = statusKeys[i];
      const eng = this.getEnglishLabel(this.reverseHebrewLabel(hebrew));
      const value = chartData.datasets[0].data[i];
      let bgColor = '';

      if (isVehicleTab) {
        if (hebrew.includes('זמין')) bgColor = '#C8E6C9';     // light green
        else if (hebrew.includes('מוקפא')) bgColor = '#FFCDD2'; // light red
        else if (hebrew.includes('בשימוש')) bgColor = '#FFE0B2'; // light orange
      }

      if (isRideTab) {
        if (hebrew.includes('ממתין')) bgColor = '#FFF9C4';    // yellow
        else if (hebrew.includes('מאושר')) bgColor = '#C8E6C9';  // green
        else if (hebrew.includes('הושלם')) bgColor = '#BBDEFB';  // blue
        else if (hebrew.includes('בוטל')) bgColor = '#F8BBD0';    // pink
        else if (hebrew.includes('נדחה')) bgColor = '#FFCDD2';    // red
        else if (hebrew.includes('בתהליך')) bgColor = '#D1C4E9';  // purple
      }

      body.push([
        { text: eng, fillColor: bgColor },
        { text: value.toString(), fillColor: bgColor }
      ]);
    }
  }

  const docDefinition: any = {
    content: [
      { text: title, style: 'header' },
      { text: `Created: ${timestamp}`, style: 'subheader' },
      {
        table: {
          headerRows: 1,
          widths: isTopUsedTab ? ['*', '*', '*'] : ['*', '*'],
          body: body
        },
        layout: {
          fillColor: (rowIndex: number) => rowIndex === 0 ? '#f2f2f2' : null
        }
      }
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 0, 0, 10],
        alignment: 'center'
      },
      subheader: {
        fontSize: 12,
        margin: [0, 0, 0, 20],
        alignment: 'center'
      },
      tableHeader: {
        fontSize: 12,
        bold: true,
        alignment: 'center'
      }
    },
    defaultStyle: {
      fontSize: 11
    }
  };

  pdfMake.createPdf(docDefinition).download(`${title}-${safeTimestamp}.pdf`);
}

// Add this method to your component for better performance with *ngFor
trackByUserId(index: number, user: any): any {
  return user.user_id;
}

// Optional: Add loading state for better UX
isTableLoading = false;

// Optional: Add method to handle keyboard navigation
onTableKeydown(event: KeyboardEvent, user: any): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    this.goToUserDetails(user.user_id);
  }
}

public exportExcel(): void {
  const isVehicleTab = this.activeTabIndex === 0;
  const isRideTab = this.activeTabIndex === 1;
  const isTopUsedTab = this.activeTabIndex === 2;

  const chartData = isVehicleTab
    ? this.vehicleChartData
    : isRideTab
      ? this.rideChartData
      : this.topUsedVehiclesData;

  const title = isVehicleTab
    ? 'Vehicle Status Summary'
    : isRideTab
      ? 'Ride Status Summary'
      : 'Top Used Vehicles';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  let data: any[] = [];

  if (isTopUsedTab) {
    const labels = chartData.labels;
    const counts = chartData.datasets[0].data;

    data = labels.map((label: string, i: number) => {
      const count = counts[i];
      let usageLevel = '';

      if (count > 10) usageLevel = 'High Usage';
      else if (count >= 5) usageLevel = 'Medium';
      else usageLevel = 'Good';

      return {
        Vehicle: label,
        'Ride Count': count,
        'Usage Level': usageLevel
      };
    });
  } else {
    data = chartData.labels.map((label: string, i: number) => ({
      'Formatted Status': label,
      'Count': chartData.datasets[0].data[i]
    }));
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const range = XLSX.utils.decode_range(worksheet['!ref']!);

  if (isTopUsedTab) {
    for (let row = 1; row <= range.e.r; row++) {
      const rideCount = Number(worksheet[`B${row + 1}`]?.v);
      let fillColor = rideCount > 10 ? 'FFFFCDD2' : rideCount >= 5 ? 'FFFFFFCC' : 'FFBBDEFB';

      ['A', 'B', 'C'].forEach(col => {
        const cell = worksheet[`${col}${row + 1}`];
        if (cell) {
          cell.s = {
            fill: {
              patternType: 'solid',
              fgColor: { rgb: fillColor }
            }
          };
        }
      });
    }
  } else {
    for (let row = 1; row <= range.e.r; row++) {
      const label = worksheet[`A${row + 1}`]?.v as string;
      let fillColor = 'FFFFFFFF';

      // Vehicle Status tab
      if (label.includes('זמין')) fillColor = 'FFC8E6C9'; // light green
      else if (label.includes('מוקפא')) fillColor = 'FFFFCDD2'; // light red
      else if (label.includes('בשימוש')) fillColor = 'FFFFE0B2'; // light orange

      // Ride Status tab
      if (label.includes('ממתין')) fillColor = 'FFFFF9C4';      // yellow
      else if (label.includes('מאושר')) fillColor = 'FFC8E6C9';  // green
      else if (label.includes('הושלם')) fillColor = 'FFBBDEFB';  // blue
      else if (label.includes('בוטל')) fillColor = 'FFF8BBD0';    // pink
      else if (label.includes('נדחה')) fillColor = 'FFFFCDD2';    // red
      else if (label.includes('בתהליך')) fillColor = 'FFD1C4E9';  // purple

      ['A', 'B'].forEach(col => {
        const cell = worksheet[`${col}${row + 1}`];
        if (cell) {
          cell.s = {
            fill: {
              patternType: 'solid',
              fgColor: { rgb: fillColor }
            }
          };
        }
      });
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics');

  const excelBuffer: any = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    cellStyles: true
  });

  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
  });

  saveAs(blob, `${title}-${timestamp}.xlsx`);
}




 public exportCSV(): void {
  const isVehicleTab = this.activeTabIndex === 0;
  const isRideTab = this.activeTabIndex === 1;
  const isTopUsedTab = this.activeTabIndex === 2;

  

  const chartData = isVehicleTab
    ? this.vehicleChartData
    : isRideTab
      ? this.rideChartData
      : this.topUsedVehiclesData;

const title = isVehicleTab
  ? 'סטטוס רכבים'
  : isRideTab
    ? 'סטטוס נסיעות'
    : this.isMonthlyView
      ? 'שימוש חודשי ברכבים'
      : 'רכבים בשימוש גבוה';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  let data: any[] = [];

  if (isTopUsedTab) {
    const labels = chartData.labels;
    const counts = chartData.datasets[0].data;

    data = labels.map((label: string, i: number) => {
      const count = counts[i];
      let usageLevel = '';

      if (count > 10) {
        usageLevel = 'שימוש גבוה'; // 🔴
      } else if (count >= 5) {
        usageLevel = 'בינוני'; // 🟡
      } else {
        usageLevel = 'טוב'; // 🔵
      }

      return {
        'רכב': label,
        'כמות נסיעות': count,
        'רמת שימוש': usageLevel
      };
    });
  } else {
    data = chartData.labels.map((label: string, i: number) => ({
      'סטטוס': label,
      'כמות': chartData.datasets[0].data[i]
    }));
  }

  // Add BOM for proper UTF-8 encoding (for Hebrew support)
  const csv = '\uFEFF' + Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${title}-${timestamp}.csv`);
}

  private getEnglishLabel(status: string): string {
  const statusMap: { [key: string]: string } = {
    'available': 'Available',
    'in_use': 'In Use',
    'frozen': 'Frozen',
    'pending': 'Pending',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'cancelled_due_to_no_show': 'Cancelled - No Show' // Add this line

  };
  return statusMap[status] || status;
}



private reloadChart() {
  this.showChart = false;
  setTimeout(() => {
    this.showChart = true;
  }, 0);
}


private reverseHebrewLabel(hebrewLabel: string): string {
  const reverseMap: { [key: string]: string } = {
    'זמין': 'available',
    'בשימוש': 'in_use',
    'מוקפא': 'frozen',
    'ממתין': 'pending',
    'מאושר': 'approved',
    'נדחה': 'rejected',
    'בתהליך': 'in_progress',
    'הושלם': 'completed',
    'בוטל': 'cancelled',

  };
  return reverseMap[hebrewLabel] || hebrewLabel;
}

public loadTopUsedVehiclesChart() {
  this.http.get<{
  month: number;
  stats: { plate_number: string; vehicle_model: string; total_rides: number }[];
  year: number;
}>(
    `${environment.apiUrl}/vehicles/usage-stats?range=month&year=${this.selectedYear}&month=${this.selectedMonth}`
  ).subscribe({
    next: data => {
      console.log('data for usage-stat',data)
      const labels = data.stats.map(v => ` ${v.plate_number} – ${v.vehicle_model}`);
const counts = data.stats.map(v => Number.isFinite(v.total_rides) ? v.total_rides : 0);

      const backgroundColors = counts.map(count => {
        if (count > 10) return '#FF5252';
        if (count >= 5) return '#FFC107';
        return '#42A5F5';
      });

      const hoverColors = backgroundColors.map(color => color + 'CC');

      const usageLevels = counts.map(count => {
        if (count > 10) return 'שימוש גבוה';
        if (count >= 5) return 'שימוש בינוני';
        return 'שימוש טוב';
      });

      this.monthlyChartData = {
        labels,
        datasets: [{
          label: 'מספר נסיעות',
          data: counts,
          backgroundColor: backgroundColors,
          hoverBackgroundColor: hoverColors
        }]
      };

      this.monthlyChartOptions = {
        type: 'bar',
        indexAxis: 'y',
        plugins: {
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const label = context.chart.data.labels[context.dataIndex];
                const value = context.raw;
                const usage = usageLevels[context.dataIndex];
                return `${label}: ${value} נסיעות (${usage})`;
              }
            }
          },
          legend: { display: false }
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: 'כמות נסיעות' },
            ticks: {
              stepSize: 1,
              beginAtZero: true,
              precision: 0
            }
          },
          y: {
            title: { display: true, text: 'רכב' },
            ticks: {
              beginAtZero: true,
              stepSize: 1,
              precision: 0,
              callback: function (value: any) {
                return Number.isInteger(value) ? value : '';
              }
            }
          }
        }
      };

      // ✅ Assign final chart config
      this.topUsedVehiclesData = { ...cloneDeep(this.monthlyChartData) };
this.topUsedVehiclesOptions = { ...cloneDeep(this.monthlyChartOptions) };
this.monthlyStatsChartData= {...this.monthlyChartData};
this.monthlyStatsChartOptions={ ...this.monthlyChartOptions };
console.log('monthly stats data:',this.monthlyStatsChartData)



    },
    error: err => {
      console.error('❌ Error fetching top used vehicles:', err);
    }
  });
}


private loadAllTimeTopUsedVehiclesChart() {
 this.http.get(`${environment.apiUrl}/vehicles/usage-stats?range=all`).subscribe({
  next: (res: any) => {
    console.log('all stats data',res)
    const stats = res?.stats || [];

    if (!stats.length) {
      this.allTimeChartData = {
        labels: ['אין נתונים'],
        datasets: [{ data: [1], backgroundColor: ['#E0E0E0'] }]
      };
      this.allTimeChartOptions = {
        plugins: { legend: { display: false } },
        scales: {
          x: {
            title: { display: true, text: 'כמות נסיעות' },
            ticks: { stepSize: 1, beginAtZero: true, precision: 0 }
          },
          y: {
            title: { display: true, text: 'רכב' },
            ticks: {
              beginAtZero: true,
              stepSize: 1,
              precision: 0,
              callback: function (value: any) {
                return Number.isInteger(value) ? value : '';
              }
            }
          }
        },
        locale: 'he-IL'
      };
     
      this.topUsedVehiclesData = { ...cloneDeep(this.allTimeChartData) };
this.topUsedVehiclesOptions = { ...cloneDeep(this.allTimeChartOptions) };
this.allTimeStatsChartData={ ...cloneDeep(this.allTimeChartData) };
this.allTimeStatsChartOptions={ ...cloneDeep(this.allTimeChartOptions) };

      return;
    }

    const labels = stats.map((s: any) => `${s.plate_number} ${s.vehicle_model}`);
    const data = stats.map((s: any) => s.total_rides);

    this.allTimeChartData = {
      labels,
      datasets: [{
        label: 'Total Rides',
        data,
        backgroundColor: '#42A5F5'
      }]
    };

    this.allTimeChartOptions = {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${ctx.parsed.x} נסיעות`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'כמות הנסיעות' },
          ticks: { beginAtZero: true, stepSize: 1, precision: 0 }
        },
        y: {
          title: { display: true, text: 'רכב' },
          ticks: {
            beginAtZero: true,
            stepSize: 1,
            precision: 0,
            callback: function (value: any) {
              return Number.isInteger(value) ? value : '';
            }
          }
        }
      },
      locale: 'he-IL'
    };

      this.topUsedVehiclesData = { ...cloneDeep(this.allTimeChartData) };
this.topUsedVehiclesOptions = { ...cloneDeep(this.allTimeChartOptions) };
this.allTimeStatsChartData={ ...cloneDeep(this.allTimeChartData) };
this.allTimeStatsChartOptions={ ...cloneDeep(this.allTimeChartOptions) };
  },

  error: (err: any) => {
    console.error("❌ Error fetching all-time used vehicles:", err);
  }
});


  }

}

