import { Component, OnInit, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartModule } from 'primeng/chart';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { DropdownModule } from 'primeng/dropdown';
import { SocketService } from '../../../services/socket.service';
import * as Papa from 'papaparse';
import { saveAs } from 'file-saver';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import * as XLSX from 'xlsx-js-style';
import { cloneDeep } from 'lodash';
import { VehicleService } from '../../../services/vehicle.service';
import {
  FreezeReason,
  VehicleOutItem,
} from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { ToastService } from '../../../services/toast.service';
import { TopNoShowUser } from '../../../models/no-show-stats.model';
import { ActivatedRoute, Router } from '@angular/router';
import { UserOrdersExportComponent } from '../user-orders-export/user-orders-export.component';
import { NoShowsComponent } from '../no-shows/no-shows.component';
import { VehicleUsageComponent } from '../vehicle-usage/vehicle-usage.component';
pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ChartModule,
    TabViewModule,
    DropdownModule,
    UserOrdersExportComponent,
    NoShowsComponent,
    VehicleUsageComponent
  ],
  templateUrl: './admin-analytics.component.html',
  styleUrls: ['./admin-analytics.component.css'],
})
export class AdminAnalyticsComponent implements OnInit {
  @ViewChild(NoShowsComponent) noShowsComponent!: NoShowsComponent;
  @ViewChild(VehicleUsageComponent) vehicleUsageComponent!: VehicleUsageComponent;

  vehicleChartData: any;
  vehicleChartOptions: any;
  rideChartData: any;
  rideChartOptions: any;
  selectedSortOption = 'countDesc';
  noShowSortOption = 'countDesc';
  activeTabIndex = 0;
  frozenVehicles = <VehicleOutItem[]>[];
  selectedVehicleType: string = '';
  selectedRideStatus: string = '';
  vehicleChartInitialized = false;
  rideChartInitialized = false;
  selectedMonth = (new Date().getMonth() + 1).toString();
  selectedYear = new Date().getFullYear().toString();
  private departmentsMap = new Map<string, string>();
  filterOnePlus: boolean = false;
  filterCritical: boolean = false;
  noShowExportWarningVisible: boolean = false;
  vehicleTypes: string[] = [];
  rideStatuses: string[] = [];


  years = Array.from({ length: 5 }, (_, i) =>
    (new Date().getFullYear() - i).toString()
  );

  constructor(
    private http: HttpClient,
    private socketService: SocketService,
    private vehicleService: VehicleService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadVehicleChart();
    this.loadRideChart();
    this.loadFrozenVehicles();
    this.noShowsComponent.filteredNoShowUsers = [] as TopNoShowUser[];
    this.loadVehicleTypes();
    this.loadRideStatuses();
    this.vehicleUsageComponent.loadAllTimeTopUsedVehiclesChart();
    this.socketService.rideStatusUpdated$.subscribe(() => {
      this.loadRideChart();
    });

    this.socketService.vehicleStatusUpdated$.subscribe(() => {
      this.loadVehicleChart();
      this.loadFrozenVehicles();
    });

    this.socketService.deleteRequests$.subscribe(() => {
      this.loadRideChart();
      this.loadVehicleChart();
      this.loadFrozenVehicles();
    });
  }

  loadVehicleTypes() {
    this.http
      .get<{ vehicle_types: string[] }>(`${environment.apiUrl}/vehicles/types`)
      .subscribe({
        next: (res) => {
          this.vehicleTypes = res.vehicle_types;
        },
        error: (err) => {
          this.toastService.show('אירעה שגיאה בטעינת סוגי רכבים', 'error');
        },
      });
  }

  onMonthOrYearChange() {
    this.updateQueryParams({
      month: this.selectedMonth,
      year: this.selectedYear,
    });
  }
  loadRideStatuses() {
    this.http
      .get<{ ride_statuses: string[] }>(`${environment.apiUrl}/ride/statuses`)
      .subscribe({
        next: (res) => {
          this.rideStatuses = res.ride_statuses;
        },
        error: (err) => {
          this.toastService.show('אירעה שגיאה בטעינת סטטוסי נסיעות', 'error');
        },
      });
  }

  onVehicleTypeFilterChange() {
    this.loadVehicleChart();
  }

  onRideStatusFilterChange() {
    this.loadRideChart();
  }

  getVehicleTypeOptions() {
    const options = [{ label: 'כל הסוגים', value: '' }];

    this.vehicleTypes.forEach((type) => {
      if (type && type.trim() !== '') {
        options.push({ label: type, value: type });
      }
    });

    return options;
  }

 
  private countFreezeReasons(frozenVehicles: VehicleOutItem[]) {
    const freezeReasonCounts: Record<FreezeReason, number> = {
      [FreezeReason.accident]: 0,
      [FreezeReason.maintenance]: 0,
      [FreezeReason.personal]: 0,
    };

    frozenVehicles.forEach((vehicle) => {
      if (vehicle.freeze_reason) {
        const reason = vehicle.freeze_reason as FreezeReason;
        freezeReasonCounts[reason]++;
      }
    });

    return freezeReasonCounts;
  }
  private loadFrozenVehicles(): void {
    this.vehicleService
      .getAllVehiclesByStatus('frozen')
      .subscribe((vehicles) => {
        this.frozenVehicles = vehicles;
      });
  }
  getFreezeReasonHebrew(reason: FreezeReason): string {
    const reasonMap: { [key in FreezeReason]: string } = {
      accident: 'תאונה',
      maintenance: 'תחזוקה',
      personal: 'שימוש אישי',
    };
    return reasonMap[reason] || reason;
  }

  private loadVehicleChart() {
    let url = `${environment.apiUrl}/analytics/vehicle-status-summary`;
    if (this.selectedVehicleType && this.selectedVehicleType.trim() !== '') {
      url += `?type=${encodeURIComponent(this.selectedVehicleType)}`;
    }

    this.http.get<{ status: string; count: number }[]>(url).subscribe({
      next: (data) => {
        this.updateVehicleChart(data);
        this.vehicleChartInitialized = true;
      },
      error: (error) => {
        this.toastService.show('אירעה שגיאה בטעינת נתוני רכבים', 'error');
        this.vehicleChartInitialized = true;
      },
    });
  }

  get isNoData(): boolean {
    return (
      this.rideChartData?.labels?.length === 1 &&
      this.rideChartData.labels[0] === 'אין נתונים'
    );
  }
  get isVehicleNoData(): boolean {
    return (
      this.vehicleChartData?.labels?.length === 1 &&
      this.vehicleChartData.labels[0] === 'אין נתונים'
    );
  }

  private loadRideChart() {
    let url = `${environment.apiUrl}/analytics/ride-status-summary`;
    if (this.selectedRideStatus && this.selectedRideStatus.trim() !== '') {
      url += `?status=${encodeURIComponent(this.selectedRideStatus)}`;
    }
    this.http.get<{ status: string; count: number }[]>(url).subscribe({
      next: (data) => {
        if (!data || data.length === 0) {
          this.rideChartData = {
            labels: ['אין נתונים'],
            datasets: [
              {
                data: [1],
                backgroundColor: ['#E0E0E0'],
                hoverBackgroundColor: ['#F0F0F0'],
              },
            ],
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
          datasets: [
            {
              data: [1],
              backgroundColor: ['#FF5252'],
              hoverBackgroundColor: ['#FF7777'],
            },
          ],
        };
      },
    });
  }

  private updateVehicleChart(data: { status: string; count: number }[]) {
    const labels = data.map((d) => this.getHebrewLabel(d.status));
    const values = data.map((d) => d.count);
    const total = values.reduce((sum, val) => sum + val, 0);

    const updatedLabels = labels.map((label, i) => {
      const count = values[i];
      const percent = ((count / total) * 100).toFixed(1);
      return `${label} – ${count} רכבים (${percent}%)`;
    });

    const backgroundColors = data.map((d) => {
      switch (d.status) {
        case 'available':
          return '#66BB6A'; // green
        case 'frozen':
          return '#42A5F5'; // blue
        case 'in_use':
          return '#FFA726'; // orange
        default:
          return '#BDBDBD'; // gray
      }
    });

    const hoverColors = data.map((d) => {
      switch (d.status) {
        case 'available':
          return '#81C784'; // lighter green
        case 'frozen':
          return '#64B5F6'; // lighter blue
        case 'in_use':
          return '#FFB74D'; // lighter orange
        default:
          return '#E0E0E0'; // lighter gray
      }
    });

    const newVehicleChartData = {
      labels: updatedLabels,
      datasets: [
        {
          data: [...values],
          backgroundColor: backgroundColors,
          hoverBackgroundColor: hoverColors,
        },
      ],
    };

    this.vehicleChartData = { ...newVehicleChartData };

    this.vehicleChartOptions = {
      plugins: {
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.label || '';

              if (label.toLowerCase().includes('מוקפא')) {
                const freezeReasonCounts = this.countFreezeReasons(
                  this.frozenVehicles
                );

                const reasonsText = Object.entries(freezeReasonCounts)
                  .filter(([_, count]) => count > 0)
                  .map(
                    ([reason, count]) =>
                      `${this.getFreezeReasonHebrew(
                        reason as FreezeReason
                      )}: ${count}`
                  )
                  .join(', ');

                return `${label}:\nסיבות הקפאה: ${reasonsText}`;
              }

              return `${label}:`;
            },
          },
        },
        legend: {
          position: 'right',
          labels: {
            color: '#495057',
            font: {
              size: 14,
              family: 'Arial, sans-serif',
            },
            usePointStyle: true,
          },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
      locale: 'he-IL',
    };
  }

  private updateRideChart(data: { status: string; count: number }[]) {
    const labels = data.map((d) => {
      const hebrewLabel = this.getRideStatusHebrew(d.status);
      return hebrewLabel;
    });
    const values = data.map((d) => d.count);
    const total = values.reduce((sum, val) => sum + val, 0);
    const updatedLabels = labels.map((label, i) => {
      const count = values[i];
      const percent = ((count / total) * 100).toFixed(1);
      return `${label} – ${count} נסיעות (${percent}%)`;
    });

    const newrideChartData = {
      labels: updatedLabels,
      datasets: [
        {
          data: [...values],
          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40',
          ],
          hoverBackgroundColor: [
            '#FF6384CC',
            '#36A2EBCC',
            '#FFCE56CC',
            '#4BC0C0CC',
            '#9966FFCC',
            '#FF9F40CC',
          ],
        },
      ],
    };

    this.rideChartData = { ...newrideChartData };

    this.rideChartOptions = {
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#495057',
            font: {
              size: 14,
              family: 'Arial, sans-serif',
            },
            usePointStyle: true,
          },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
      locale: 'he-IL', // Hebrew locale
    };
  }

  onSortChange() {
    const sortFunctionsR = {
      countAsc: (
        a: { status: string; count: number },
        b: { status: string; count: number }
      ) => a.count - b.count,
      countDesc: (
        a: { status: string; count: number },
        b: { status: string; count: number }
      ) => b.count - a.count,
      alphabetical: (
        a: { status: string; count: number },
        b: { status: string; count: number }
      ) => a.status.localeCompare(b.status),
      default: () => 0,
    };

    const sortFunctionsV = {
      countAsc: (
        a: { status: string; count: number },
        b: { status: string; count: number }
      ) => a.count - b.count,
      countDesc: (
        a: { status: string; count: number },
        b: { status: string; count: number }
      ) => b.count - a.count,
      alphabetical: (
        a: { status: string; count: number },
        b: { status: string; count: number }
      ) => a.status.localeCompare(b.status),
      default: () => 0,
    };

    const sortFnR =
      sortFunctionsR[this.selectedSortOption as keyof typeof sortFunctionsR];
    const sortFnV =
      sortFunctionsV[this.selectedSortOption as keyof typeof sortFunctionsV];

    if (this.activeTabIndex === 0) {
      // עדכון עם פילטר הרכב
      let url = `${environment.apiUrl}/analytics/vehicle-status-summary`;
      if (this.selectedVehicleType && this.selectedVehicleType.trim() !== '') {
        url += `?type=${encodeURIComponent(this.selectedVehicleType)}`;
      }
      this.http
        .get<{ status: string; count: number }[]>(url)
        .subscribe((data) => {
          const sortedDataV =
            this.selectedSortOption === 'default'
              ? data
              : [...data].sort(sortFnV);
          this.updateVehicleChart(sortedDataV);
        });
    } else {
      this.http
        .get<{ status: string; count: number }[]>(
          `${environment.apiUrl}/analytics/ride-status-summary`
        )
        .subscribe((data) => {
          const sortedDataR =
            this.selectedSortOption === 'default'
              ? data
              : [...data].sort(sortFnR);
          this.updateRideChart(sortedDataR);
        });
    }
    this.updateQueryParams({ selectedSort: this.selectedSortOption });
  }
  updateQueryParams(params: any) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge', // keeps the other params
    });
  }

  onTabChange(index: number) {
    this.activeTabIndex = index;
  }

  getHebrewLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      available: 'זמין',
      in_use: 'בשימוש',
      frozen: 'מוקפא',
    };
    return statusMap[status] || status;
  }

  getRideStatusHebrew(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'ממתין',
      approved: 'מאושר',
      rejected: 'נדחה',
      in_progress: 'בתהליך',
      completed: 'הושלם',
      cancelled_due_to_no_show: 'בוטלה-נסיעה לא בוצעה',
    };
    return statusMap[status] || status;
  }

  resolveDepartment(departmentId: string): string {
    return this.departmentsMap.get(departmentId) || 'מחלקה לא ידועה';
  }

  public exportPDF(): void {
    const isVehicleTab = this.activeTabIndex === 0;
    const isRideTab = this.activeTabIndex === 1;
    const isTopUsedTab = this.activeTabIndex === 2;
    const isNoShowTab = this.activeTabIndex === 4;

    if (isNoShowTab && this.noShowsComponent.filteredNoShowUsers.length === 0) {
      this.showExportWarningTemporarily();
      return;
    }

    let chartData: any;
    let title: string;

    if (isNoShowTab) {
      title = 'No-Show Users Report';
    } else {
      chartData = isVehicleTab
        ? this.vehicleChartData
        : isRideTab
        ? this.rideChartData
        : this.vehicleUsageComponent.topUsedVehiclesData;

      title = isVehicleTab
        ? 'Vehicle Status Summary'
        : isRideTab
        ? 'Ride Status Summary'
        : this.vehicleUsageComponent.isMonthlyView
        ? 'Monthly Vehicle Usage'
        : 'Top Used Vehicles';
    }

    const timestamp = new Date().toLocaleString();
    const safeTimestamp = timestamp.replace(/[/:]/g, '-');

    let body: any[] = [];

    if (isNoShowTab) {
      // Create no-show users table
      body.push([
        { text: 'User Name', style: 'tableHeader' },
        { text: 'Email', style: 'tableHeader' },
        { text: 'Employee ID', style: 'tableHeader' },
        { text: 'Department', style: 'tableHeader' },
        { text: 'Role', style: 'tableHeader' },
        { text: 'No-Show Count', style: 'tableHeader' },
        { text: 'Status', style: 'tableHeader' },
      ]);

      this.noShowsComponent.filteredNoShowUsers.forEach((user) => {
        const count = user.no_show_count ?? 0;
        let status = '';
        let bgColor = '';

        if (count >= 3) {
          status = 'Critical';
          bgColor = '#FFCDD2'; // light red
        } else if (count >= 1) {
          status = 'Warning';
          bgColor = '#FFF9C4'; // light yellow
        } else {
          status = 'Good';
          bgColor = '#BBDEFB'; // light blue
        }

        body.push([
          { text: user.name || 'Unknown', fillColor: bgColor },
          { text: user.email || 'unknown@example.com', fillColor: bgColor },
          {
            text: user.employee_id || user.user_id || 'N/A',
            fillColor: bgColor,
          },
          {
            text: this.resolveDepartment(user.department_id || ''),
            fillColor: bgColor,
          },
          { text: user.role || 'לא ידוע', fillColor: bgColor },
          { text: count.toString(), fillColor: bgColor },
          { text: status, fillColor: bgColor },
        ]);
      });
    } else if (isTopUsedTab) {
      const labels = chartData.labels;
      const data = chartData.datasets[0].data;

      body.push([
        { text: 'Vehicle', style: 'tableHeader' },
        { text: 'Ride Count', style: 'tableHeader' },
        { text: 'Usage Level', style: 'tableHeader' },
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
          { text: usageLabel, fillColor: bgColor },
        ]);
      }
    } else {
      const statusKeys = chartData.labels.map((label: string) => {
        const match = label.split('–')[0].trim();
        return match;
      });

      body.push([
        { text: 'Status', style: 'tableHeader' },
        { text: 'Count', style: 'tableHeader' },
      ]);

      for (let i = 0; i < statusKeys.length; i++) {
        const hebrew = statusKeys[i];
        const eng = this.getEnglishLabel(this.reverseHebrewLabel(hebrew));
        const value = chartData.datasets[0].data[i];
        let bgColor = '';

        if (isVehicleTab) {
          if (hebrew.includes('זמין')) bgColor = '#C8E6C9'; // light green
          else if (hebrew.includes('מוקפא')) bgColor = '#FFCDD2'; // light red
          else if (hebrew.includes('בשימוש')) bgColor = '#FFE0B2'; // light orange
        }

        if (isRideTab) {
          if (hebrew.includes('ממתין')) bgColor = '#FFF9C4'; // yellow
          else if (hebrew.includes('מאושר')) bgColor = '#C8E6C9'; // green
          else if (hebrew.includes('הושלם')) bgColor = '#BBDEFB'; // blue
          else if (hebrew.includes('בוטל')) bgColor = '#F8BBD0'; // pink
          else if (hebrew.includes('נדחה')) bgColor = '#FFCDD2'; // red
          else if (hebrew.includes('בתהליך')) bgColor = '#D1C4E9'; // purple
        }

        body.push([
          { text: eng, fillColor: bgColor },
          { text: value.toString(), fillColor: bgColor },
        ]);
      }
    }

    const docDefinition: any = {
      pageOrientation: isNoShowTab ? 'landscape' : 'portrait',
      pageSize: 'A4',

      content: [
        { text: title, style: 'header' },
        { text: `Created: ${timestamp}`, style: 'subheader' },
        ...(isVehicleTab
          ? [
              {
                text: `Vehicle Types: ${
                  this.selectedVehicleType === ''
                    ? 'All'
                    : this.selectedVehicleType
                }`,
                style: 'summaryHeader',
              },
            ]
          : []),
        {
          table: {
            headerRows: 1,
            // Better column sizing for No-Show table
            widths: isNoShowTab
              ? ['auto', '*', 'auto', '*', 'auto', 'auto', 'auto']
              : isTopUsedTab
              ? ['*', '*', '*']
              : ['*', '*'],
            body: body,
          },
          layout: {
            fillColor: (rowIndex: number) =>
              rowIndex === 0 ? '#f2f2f2' : null,
            // Add light horizontal lines for clarity
            hLineWidth: (i: number, node: any) =>
              i === 0 || i === node.table.body.length ? 1 : 0.5,
            vLineWidth: (i: number, node: any) =>
              i === 0 || i === node.table.widths.length ? 1 : 0.5,
            hLineColor: () => '#ccc',
            vLineColor: () => '#ccc',
          },
        },
      ],

      styles: {
        header: {
          fontSize: 18,
          bold: true,
          margin: [0, 0, 0, 10],
          alignment: 'center',
        },
        subheader: {
          fontSize: 11,
          margin: [0, 0, 0, 15],
          alignment: 'center',
        },
        summaryHeader: {
          fontSize: 13,
          bold: true,
          margin: [0, 10, 0, 8],
        },
        tableHeader: {
          fontSize: 10,
          bold: true,
          alignment: 'center',
        },
        tableCell: {
          fontSize: 9,
          margin: [2, 2, 2, 2],
          alignment: 'center',
        },
      },

      defaultStyle: {
        fontSize: 9,
        alignment: 'center',
      },
    };

    pdfMake.createPdf(docDefinition).download(`${title}-${safeTimestamp}.pdf`);
  }

  trackByUserId(index: number, user: any): any {
    return user.user_id;
  }

  isTableLoading = false;

  public exportExcel(): void {
    const isVehicleTab = this.activeTabIndex === 0;
    const isRideTab = this.activeTabIndex === 1;
    const isTopUsedTab = this.activeTabIndex === 2;
    const isNoShowTab = this.activeTabIndex === 4;

    const chartData = isVehicleTab
      ? this.vehicleChartData
      : isRideTab
      ? this.rideChartData
      : this.vehicleUsageComponent.topUsedVehiclesData;

    const title = isNoShowTab
      ? 'טבלת אי-הגעות'
      : isVehicleTab
      ? this.selectedVehicleType !== ''
        ? `סטטוס רכבים (${this.selectedVehicleType})`
        : 'סטטוס רכבים (כל הסוגים)'
      : isRideTab
      ? 'סטטוס נסיעות'
      : 'רכבים בשימוש גבוה';

    const timestamp = new Date().toISOString().substring(0, 10);
    let data: any[] = [];

    if (isNoShowTab) {
      data = this.noShowsComponent.filteredNoShowUsers.map((user) => {
        const count = user.no_show_count ?? 0;
        let status = '';
        if (count >= 3) status = 'Critical';
        else if (count >= 1) status = 'Warning';
        else status = 'Good';

        return {
          'User Name': user.name || 'Unknown',
          Email: user.email || 'unknown@example.com',
          'Employee ID': user.employee_id || user.user_id || 'N/A',
          Department: this.resolveDepartment(user.department_id || ''),
          Role: user.role || 'לא ידוע',
          'No-Show Count': count,
          Status: status,
        };
      });
    } else if (isTopUsedTab) {
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
          'Usage Level': usageLevel,
        };
      });
    } else {
      data = chartData.labels.map((label: string, i: number) => ({
        'Formatted Status': label,
        Count: chartData.datasets[0].data[i],
      }));
    }

    if (isNoShowTab && this.noShowsComponent.filteredNoShowUsers.length === 0) {
      this.showExportWarningTemporarily();
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const range = XLSX.utils.decode_range(worksheet['!ref']!);

    if (isNoShowTab) {
      for (let row = 1; row <= range.e.r; row++) {
        const count = Number(worksheet[`F${row + 1}`]?.v);
        let fillColor = 'FFFFFFFF';

        if (count >= 3) fillColor = 'FFFFCDD2'; // Critical = red
        else if (count >= 1) fillColor = 'FFFFFFCC'; // Warning = yellow
        else fillColor = 'FFBBDEFB'; // Good = blue

        ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((col) => {
          const cell = worksheet[`${col}${row + 1}`];
          if (cell) {
            cell.s = {
              fill: {
                patternType: 'solid',
                fgColor: { rgb: fillColor },
              },
            };
          }
        });
      }
    } else if (isTopUsedTab) {
      for (let row = 1; row <= range.e.r; row++) {
        const rideCount = Number(worksheet[`B${row + 1}`]?.v);
        let fillColor =
          rideCount > 10
            ? 'FFFFCDD2'
            : rideCount >= 5
            ? 'FFFFFFCC'
            : 'FFBBDEFB';

        ['A', 'B', 'C'].forEach((col) => {
          const cell = worksheet[`${col}${row + 1}`];
          if (cell) {
            cell.s = {
              fill: {
                patternType: 'solid',
                fgColor: { rgb: fillColor },
              },
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
        if (label.includes('ממתין')) fillColor = 'FFFFF9C4'; // yellow
        else if (label.includes('מאושר')) fillColor = 'FFC8E6C9'; // green
        else if (label.includes('הושלם')) fillColor = 'FFBBDEFB'; // blue
        else if (label.includes('בוטל')) fillColor = 'FFF8BBD0'; // pink
        else if (label.includes('נדחה')) fillColor = 'FFFFCDD2'; // red
        else if (label.includes('בתהליך')) fillColor = 'FFD1C4E9'; // purple

        ['A', 'B'].forEach((col) => {
          const cell = worksheet[`${col}${row + 1}`];
          if (cell) {
            cell.s = {
              fill: {
                patternType: 'solid',
                fgColor: { rgb: fillColor },
              },
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
      cellStyles: true,
    });

    const blob = new Blob([excelBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8',
    });

    saveAs(blob, `${title}__${timestamp}.xlsx`);
  }

  public exportCSV(): void {
    const isVehicleTab = this.activeTabIndex === 0;
    const isRideTab = this.activeTabIndex === 1;
    const isTopUsedTab = this.activeTabIndex === 2;
    const isNoShowTab = this.activeTabIndex === 4;

    if (isNoShowTab && this.noShowsComponent.filteredNoShowUsers.length === 0) {
      this.showExportWarningTemporarily();
      return;
    }

    let chartData: any;
    if (!isNoShowTab) {
      chartData = isVehicleTab
        ? this.vehicleChartData
        : isRideTab
        ? this.rideChartData
        : this.vehicleUsageComponent.topUsedVehiclesData;
    }
    const title = isNoShowTab
      ? 'טבלת אי-הגעות'
      : isVehicleTab
      ? this.selectedVehicleType !== ''
        ? `סטטוס רכבים (${this.selectedVehicleType})`
        : 'סטטוס רכבים (כל הסוגים)'
      : isRideTab
      ? 'סטטוס נסיעות'
      : this.vehicleUsageComponent.isMonthlyView
      ? 'שימוש חודשי ברכבים'
      : 'רכבים בשימוש גבוה';

    const timestamp = new Date().toISOString().substring(0, 10);
    let data: any[] = [];

    if (isNoShowTab) {
      data = this.noShowsComponent.filteredNoShowUsers.map((user) => {
        const count = user.no_show_count ?? 0;
        let status = '';

        if (count >= 3) status = 'קריטי';
        else if (count >= 1) status = 'אזהרה';
        else status = 'תקין';

        return {
          שם: user.name || 'לא ידוע',
          אימייל: user.email || 'unknown@example.com',
          'מזהה עובד': user.employee_id || user.user_id || 'N/A',
          מחלקה: this.resolveDepartment(user.department_id || ''),
          תפקיד: user.role || 'לא ידוע',
          'כמות אי-הגעות': count,
          סטטוס: status,
        };
      });
    } else if (isTopUsedTab) {
      const labels = chartData.labels;
      const counts = chartData.datasets[0].data;

      data = labels.map((label: string, i: number) => {
        const count = counts[i];
        let usageLevel = '';

        if (count > 10) usageLevel = 'שימוש גבוה';
        else if (count >= 5) usageLevel = 'בינוני';
        else usageLevel = 'טוב';

        return {
          רכב: label,
          'כמות נסיעות': count,
          'רמת שימוש': usageLevel,
        };
      });
    } else {
      data = chartData.labels.map((label: string, i: number) => ({
        סטטוס: label,
        כמות: chartData.datasets[0].data[i],
      }));
    }

    const csv = '\uFEFF' + Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${title}-${timestamp}.csv`);
  }

  private getEnglishLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      available: 'Available',
      in_use: 'In Use',
      frozen: 'Frozen',
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      cancelled_due_to_no_show: 'Cancelled - No Show',
    };
    return statusMap[status] || status;
  }

  private showExportWarningTemporarily(): void {
    this.noShowExportWarningVisible = true;
    setTimeout(() => {
      this.noShowExportWarningVisible = false;
    }, 4000);
  }

  private reverseHebrewLabel(hebrewLabel: string): string {
    const reverseMap: { [key: string]: string } = {
      זמין: 'available',
      בשימוש: 'in_use',
      מוקפא: 'frozen',
      ממתין: 'pending',
      מאושר: 'approved',
      נדחה: 'rejected',
      בתהליך: 'in_progress',
      הושלם: 'completed',
      'בוטלה-נסיעה לא בוצעה': 'cancelled_due_to_no_show',
    };
    return reverseMap[hebrewLabel] || hebrewLabel;
  }
  
}