import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { DropdownModule } from 'primeng/dropdown';
import * as Papa from 'papaparse';
import { saveAs } from 'file-saver';
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import * as XLSX from 'xlsx-js-style';
import { ActivatedRoute, Router } from '@angular/router';
import { UserOrdersExportComponent } from '../user-orders-export/user-orders-export.component';
import { NoShowsComponent } from '../no-shows/no-shows.component';
import { VehicleUsageComponent } from '../vehicle-usage/vehicle-usage.component';
import { RideStatusComponent } from '../ride-status/ride-status.component';
import { VehicleStatusComponent } from '../vehicle-status/vehicle-status.component';
import { StatisticsService } from '../../../services/statistics.service';
import { RideStartTimeStatsResponse } from '../../../models/ride-start-time-stats.model';
import { ChartModule } from 'primeng/chart';
import { PurposeOfTravelStatsResponse } from '../../../models/purpose-of-travel-stats.model';
import { ToastService } from '../../../services/toast.service';
pdfMake.vfs = pdfFonts.vfs;

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TabViewModule,
    DropdownModule,
    UserOrdersExportComponent,
    NoShowsComponent,
    VehicleUsageComponent,
    RideStatusComponent,
    VehicleStatusComponent,
    ChartModule,
  ],
  templateUrl: './admin-analytics.component.html',
  styleUrls: ['./admin-analytics.component.css'],
})
export class AdminAnalyticsComponent implements OnInit {
  constructor(
    private statisticsService: StatisticsService,
    private toastService: ToastService
  ) {}
  @ViewChild(NoShowsComponent) noShowsComponent!: NoShowsComponent;
  @ViewChild(VehicleUsageComponent)
  vehicleUsageComponent!: VehicleUsageComponent;
  @ViewChild(RideStatusComponent) rideStatusComponent!: RideStatusComponent;
  @ViewChild(VehicleStatusComponent)
  vehicleStatusComponent!: VehicleStatusComponent;

  selectedSortOption = 'countDesc';
  activeTabIndex = 0;
  selectedMonth = (new Date().getMonth() + 1).toString();
  selectedYear = new Date().getFullYear().toString();
  private departmentsMap = new Map<string, string>();
  noShowExportWarningVisible: boolean = false;
  rideStartTimeChartData: any;
  rideStartTimeChartOptions: any;
  rideStartTimeLoading = false;

  rideStartFilterMode: 'last4' | 'single' | 'range' = 'last4';

  rideStartSingleMonth: string = (new Date().getMonth() + 1).toString();
  rideStartSingleYear: string = new Date().getFullYear().toString();

  rideStartRangeYear: string = new Date().getFullYear().toString();
  rideStartRangeStartDate: string = '';
  rideStartRangeEndDate: string = '';
  purposeStats: PurposeOfTravelStatsResponse | null = null;
  purposeChartData: any;
  purposeChartOptions: any;
  purposeLoading = false;

  purposeFilterMode: 'last4' | 'custom' | 'range' = 'last4';
  purposeYear: string = new Date().getFullYear().toString();
  purposeStartMonth: string = '1';
  purposeRangeStartDate: string = '';
  purposeRangeEndDate: string = '';

  years = Array.from({ length: 5 }, (_, i) =>
    (new Date().getFullYear() - i).toString()
  );

  ngOnInit() {
    this.loadDefaultRideStartTimeStats();
    this.loadDefaultPurposeStats();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.activeTabIndex = 0;
    });
  }

  resolveDepartment(departmentId: string): string {
    return this.departmentsMap.get(departmentId) || 'מחלקה לא ידועה';
  }

  public exportPDF(): void {
    const isVehicleTab = this.activeTabIndex === 0;
    const isRideTab = this.activeTabIndex === 1;
    const isTopUsedTab = this.activeTabIndex === 2;
    const isNoShowTab = this.activeTabIndex === 4;
    const isRideStartTimeTab = this.activeTabIndex === 5;
    const isPurposeTab = this.activeTabIndex === 6;

    if (isNoShowTab && this.noShowsComponent.filteredNoShowUsers.length === 0) {
      this.showExportWarningTemporarily();
      return;
    }

    let chartData: any;

    if (isRideStartTimeTab) {
      chartData = this.rideStartTimeChartData;
    } else if (isPurposeTab) {
      chartData = this.purposeChartData;
    } else if (!isNoShowTab) {
      chartData = isVehicleTab
        ? this.vehicleStatusComponent.vehicleChartData
        : isRideTab
        ? this.rideStatusComponent.rideChartData
        : this.vehicleUsageComponent.topUsedVehiclesData;
    }

    const englishTitle = this.getEnglishTitle();
    const fileBaseName = this.getHebrewFileBaseName();

    const timestamp = new Date().toLocaleString();
    const safeTimestamp = timestamp.replace(/[/:]/g, '-');

    let body: any[] = [];

    if (isPurposeTab) {
      body.push([
        { text: 'Month', style: 'tableHeader' },
        { text: 'Administrative', style: 'tableHeader' },
        { text: 'Operational', style: 'tableHeader' },
        { text: 'Total', style: 'tableHeader' },
      ]);

      if (this.purposeStats && this.purposeStats.months) {
        this.purposeStats.months.forEach((month) => {
          body.push([
            { text: month.month_label, style: 'tableCell' },
            {
              text: `${month.administrative_count} (${month.administrative_percentage}%)`,
              style: 'tableCell',
            },
            {
              text: `${month.operational_count} (${month.operational_percentage}%)`,
              style: 'tableCell',
            },
            { text: month.total_rides.toString(), style: 'tableCell' },
          ]);
        });
      }
    } else if (isNoShowTab) {
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
          bgColor = '#FFCDD2';
        } else if (count >= 1) {
          status = 'Warning';
          bgColor = '#FFF9C4';
        } else {
          status = 'Good';
          bgColor = '#BBDEFB';
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
    } else if (isRideStartTimeTab) {
      body.push([
        { text: 'Hour', style: 'tableHeader' },
        { text: 'Ride Count', style: 'tableHeader' },
      ]);

      if (chartData && chartData.labels && chartData.datasets?.[0]?.data) {
        const labels = chartData.labels;
        const counts = chartData.datasets[0].data;

        for (let i = 0; i < labels.length; i++) {
          body.push([
            { text: labels[i].toString(), style: 'tableCell' },
            { text: counts[i]?.toString() ?? '0', style: 'tableCell' },
          ]);
        }
      }
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
          bgColor = '#FFCDD2';
        } else if (count >= 5) {
          usageLabel = 'Medium';
          bgColor = '#FFF9C4';
        } else {
          usageLabel = 'Good';
          bgColor = '#BBDEFB';
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
          if (hebrew.includes('זמין')) bgColor = '#C8E6C9';
          else if (hebrew.includes('מוקפא')) bgColor = '#FFCDD2';
          else if (hebrew.includes('בשימוש')) bgColor = '#FFE0B2';
        }

        if (isRideTab) {
          if (hebrew.includes('ממתין לאישור')) bgColor = '#FFF9C4';
          else if (hebrew.includes('אושר')) bgColor = '#C8E6C9';
          else if (hebrew.includes('הושלם')) bgColor = '#BBDEFB';
          else if (hebrew.includes('בוטל')) bgColor = '#F8BBD0';
          else if (hebrew.includes('נדחה')) bgColor = '#FFCDD2';
          else if (hebrew.includes('בנסיעה')) bgColor = '#D1C4E9';
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
        { text: englishTitle, style: 'header' },
        { text: `Created: ${timestamp}`, style: 'subheader' },
        ...(isVehicleTab
          ? [
              {
                text: `Vehicle Types: ${
                  this.vehicleStatusComponent.selectedVehicleType === ''
                    ? 'All'
                    : this.vehicleStatusComponent.selectedVehicleType
                }`,
                style: 'summaryHeader',
              },
            ]
          : []),
        {
          table: {
            headerRows: 1,
            widths: isNoShowTab
              ? ['auto', '*', 'auto', '*', 'auto', 'auto', 'auto']
              : isTopUsedTab
              ? ['*', '*', '*']
              : isPurposeTab
              ? ['*', '*', '*', '*']
              : ['*', '*'],
            body: body,
          },
          layout: {
            fillColor: (rowIndex: number) =>
              rowIndex === 0 ? '#f2f2f2' : null,
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

    pdfMake
      .createPdf(docDefinition)
      .download(`${fileBaseName}-${safeTimestamp}.pdf`);
  }

  trackByUserId(index: number, user: any): any {
    return user.user_id;
  }

  isTableLoading = false;
  onApplySingleMonthFilter(): void {
    const year = parseInt(this.rideStartSingleYear, 10);
    const month = parseInt(this.rideStartSingleMonth, 10);

    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0);

    const fromStr = from.toISOString().substring(0, 10);
    const toStr = to.toISOString().substring(0, 10);

    this.fetchRideStartTimeStats(fromStr, toStr);
  }
  onApplyRangeFilter(): void {
    const year = parseInt(this.rideStartRangeYear, 10);
    let startMonth = parseInt(this.rideStartRangeStartDate, 10);
    let endMonth = parseInt(this.rideStartRangeEndDate, 10);

    if (startMonth > endMonth) {
      const tmp = startMonth;
      startMonth = endMonth;
      endMonth = tmp;
    }

    if (endMonth - startMonth > 3) {
      endMonth = startMonth + 3;
    }
    if (!this.rideStartRangeStartDate || !this.rideStartRangeEndDate) {
      return;
    }

    const startDate = new Date(this.rideStartRangeStartDate);
    const endDate = new Date(this.rideStartRangeEndDate);

    if (endDate < startDate) {
      this.toastService.show(
        'תאריך הסיום חייב להיות אחרי תאריך ההתחלה',
        'error'
      );
      return;
    }

    const monthsDiff =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    if (monthsDiff > 3) {
      this.toastService.show('ניתן לבחור טווח של עד 4 חודשים בלבד', 'error');
      return;
    }

    const fromStr = this.rideStartRangeStartDate;
    const toStr = this.rideStartRangeEndDate;

    this.fetchRideStartTimeStats(fromStr, toStr);
  }
  onRideStartFilterModeChange(mode: 'last4' | 'single' | 'range'): void {
    this.rideStartFilterMode = mode;

    if (mode === 'last4') {
      this.loadDefaultRideStartTimeStats();
    }
  }

  public exportExcel(): void {
    const isVehicleTab = this.activeTabIndex === 0;
    const isRideTab = this.activeTabIndex === 1;
    const isTopUsedTab = this.activeTabIndex === 2;
    const isNoShowTab = this.activeTabIndex === 4;
    const isRideStartTimeTab = this.activeTabIndex === 5;
    const isPurposeTab = this.activeTabIndex === 6;

    let chartData: any;
    let title: string;

    if (isNoShowTab) {
      title = 'טבלת אי-הגעות';
    } else if (isRideStartTimeTab) {
      title = 'זמני התחלת נסיעות';
      chartData = this.rideStartTimeChartData;
    } else if (isPurposeTab) {
      title = 'מטרת נסיעה';
      chartData = this.purposeChartData;
    } else {
      chartData = isVehicleTab
        ? this.vehicleStatusComponent.vehicleChartData
        : isRideTab
        ? this.rideStatusComponent.rideChartData
        : this.vehicleUsageComponent.topUsedVehiclesData;

      title = isVehicleTab
        ? this.vehicleStatusComponent.selectedVehicleType !== ''
          ? `סטטוס רכבים (${this.vehicleStatusComponent.selectedVehicleType})`
          : 'סטטוס רכבים (כל הסוגים)'
        : isRideTab
        ? 'סטטוס נסיעות'
        : 'רכבים בשימוש גבוה';
    }

    const timestamp = new Date().toISOString().substring(0, 10);
    let data: any[] = [];

    if (isPurposeTab) {
      if (!this.purposeStats || !this.purposeStats.months) {
        return;
      }

      data = this.purposeStats.months.map((month) => ({
        חודש: month.month_label,
        מנהלי: `${month.administrative_count} (${month.administrative_percentage}%)`,
        מבצעי: `${month.operational_count} (${month.operational_percentage}%)`,
        'סה"כ': month.total_rides,
      }));
    }

    if (isNoShowTab) {
      if (this.noShowsComponent.filteredNoShowUsers.length === 0) {
        this.showExportWarningTemporarily();
        return;
      }

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
    } else if (isRideStartTimeTab) {
      if (!this.rideStartTimeChartData) {
        return;
      }

      const labels = this.rideStartTimeChartData.labels || [];
      const counts = this.rideStartTimeChartData.datasets?.[0]?.data || [];

      data = labels.map((label: string, i: number) => ({
        שעה: label,
        'מספר נסיעות': counts[i] ?? 0,
      }));
    } else {
      data = chartData.labels.map((label: string, i: number) => ({
        'Formatted Status': label,
        Count: chartData.datasets[0].data[i],
      }));
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const range = XLSX.utils.decode_range(worksheet['!ref']!);

    if (isNoShowTab) {
      for (let row = 1; row <= range.e.r; row++) {
        const count = Number(worksheet[`F${row + 1}`]?.v);
        let fillColor = 'FFFFFFFF';

        if (count >= 3) fillColor = 'FFFFCDD2';
        else if (count >= 1) fillColor = 'FFFFFFCC';
        else fillColor = 'FFBBDEFB';

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
    } else if (!isRideStartTimeTab) {
      for (let row = 1; row <= range.e.r; row++) {
        const label = worksheet[`A${row + 1}`]?.v as string;
        let fillColor = 'FFFFFFFF';

        if (label.includes('זמין')) fillColor = 'FFC8E6C9';
        else if (label.includes('מוקפא')) fillColor = 'FFFFCDD2';
        else if (label.includes('בשימוש')) fillColor = 'FFFFE0B2';
        if (label.includes('ממתין לאישור')) fillColor = 'FFFFF9C4';
        else if (label.includes('אושר')) fillColor = 'FFC8E6C9';
        else if (label.includes('הושלם')) fillColor = 'FFBBDEFB';
        else if (label.includes('בוטל')) fillColor = 'FFF8BBD0';
        else if (label.includes('נדחה')) fillColor = 'FFFFCDD2';
        else if (label.includes('בנסיעה')) fillColor = 'FFD1C4E9';

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

      if (isNoShowTab) {
        for (let row = 1; row <= range.e.r; row++) {
          const count = Number(worksheet[`F${row + 1}`]?.v);
          let fillColor = 'FFFFFFFF';

          if (count >= 3) fillColor = 'FFFFCDD2';
          else if (count >= 1) fillColor = 'FFFFFFCC';
          else fillColor = 'FFBBDEFB';

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
      } else if (!isRideStartTimeTab) {
        for (let row = 1; row <= range.e.r; row++) {
          const label = worksheet[`A${row + 1}`]?.v as string;
          let fillColor = 'FFFFFFFF';

          if (label.includes('זמין')) fillColor = 'FFC8E6C9';
          else if (label.includes('מוקפא')) fillColor = 'FFFFCDD2';
          else if (label.includes('בשימוש')) fillColor = 'FFFFE0B2';
          if (label.includes('ממתין לאישור')) fillColor = 'FFFFF9C4';
          else if (label.includes('אושר')) fillColor = 'FFC8E6C9';
          else if (label.includes('הושלם')) fillColor = 'FFBBDEFB';
          else if (label.includes('בוטל')) fillColor = 'FFF8BBD0';
          else if (label.includes('נדחה')) fillColor = 'FFFFCDD2';
          else if (label.includes('בנסיעה')) fillColor = 'FFD1C4E9';

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

      const fileBaseName = this.getHebrewFileBaseName();
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
    const isRideStartTimeTab = this.activeTabIndex === 5;
    const isPurposeTab = this.activeTabIndex === 6;

    if (isNoShowTab && this.noShowsComponent.filteredNoShowUsers.length === 0) {
      this.showExportWarningTemporarily();
      return;
    }

    let chartData: any;
    if (!isNoShowTab && !isPurposeTab) {
      chartData = isVehicleTab
        ? this.vehicleStatusComponent.vehicleChartData
        : isRideTab
        ? this.rideStatusComponent.rideChartData
        : this.vehicleUsageComponent.topUsedVehiclesData;
    }
    const title = isNoShowTab
      ? 'טבלת אי-הגעות'
      : isPurposeTab
      ? 'מטרת נסיעה'
      : isVehicleTab
      ? this.vehicleStatusComponent.selectedVehicleType !== ''
        ? `סטטוס רכבים (${this.vehicleStatusComponent.selectedVehicleType})`
        : 'סטטוס רכבים (כל הסוגים)'
      : isRideTab
      ? 'סטטוס נסיעות'
      : this.vehicleUsageComponent.isMonthlyView
      ? 'שימוש חודשי ברכבים'
      : 'רכבים בשימוש גבוה';

    const timestamp = new Date().toISOString().substring(0, 10);
    let data: any[] = [];

    if (isPurposeTab) {
      if (!this.purposeStats || !this.purposeStats.months) {
        return;
      }

      data = this.purposeStats.months.map((month) => ({
        חודש: month.month_label,
        מנהלי: `${month.administrative_count} (${month.administrative_percentage}%)`,
        מבצעי: `${month.operational_count} (${month.operational_percentage}%)`,
        'סה"כ': month.total_rides,
      }));
    } else if (isNoShowTab) {
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
    } else if (isRideStartTimeTab) {
      if (!this.rideStartTimeChartData) {
        return;
      }

      const labels = this.rideStartTimeChartData.labels || [];
      const counts = this.rideStartTimeChartData.datasets?.[0]?.data || [];

      data = labels.map((label: string, i: number) => ({
        שעה: label,
        'מספר נסיעות': counts[i] ?? 0,
      }));
    } else {
      data = chartData.labels.map((label: string, i: number) => ({
        סטטוס: label,
        כמות: chartData.datasets[0].data[i],
      }));
    }

    const csv = '\uFEFF' + Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const fileBaseName = this.getHebrewFileBaseName();
    saveAs(blob, `${fileBaseName}-${timestamp}.csv`);
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
  private loadDefaultPurposeStats(): void {
    this.purposeFilterMode = 'last4';
    this.fetchPurposeStats();
  }

  onPurposeFilterModeChange(mode: 'last4' | 'custom' | 'range'): void {
    this.purposeFilterMode = mode;

    if (mode === 'last4') {
      this.loadDefaultPurposeStats();
    }
  }

  onApplyPurposeRange(): void {
    const year = parseInt(this.purposeYear, 10);
    let startMonth = parseInt(this.purposeStartMonth, 10);

    if (!year || !startMonth || startMonth < 1 || startMonth > 12) {
      return;
    }

    let fromYear = year;
    let fromMonth = startMonth;
    let toYear = year;
    let toMonth = startMonth + 3;

    if (toMonth > 12) {
      toMonth -= 12;
      toYear += 1;
    }

    this.fetchPurposeStats(fromYear, fromMonth, toYear, toMonth);
  }

  onApplyPurposeDateRange(): void {
    if (!this.purposeRangeStartDate || !this.purposeRangeEndDate) {
      return;
    }

    const startDate = new Date(this.purposeRangeStartDate);
    const endDate = new Date(this.purposeRangeEndDate);

    if (endDate < startDate) {
      this.toastService.show(
        'תאריך הסיום חייב להיות אחרי תאריך ההתחלה',
        'error'
      );
      return;
    }

    const monthsDiff =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth());

    if (monthsDiff > 3) {
      this.toastService.show(
        'תאריך הסיום חייב להיות אחרי תאריך ההתחלה',
        'error'
      );
      return;
    }

    const fromYear = startDate.getFullYear();
    const fromMonth = startDate.getMonth() + 1;
    const toYear = endDate.getFullYear();
    const toMonth = endDate.getMonth() + 1;

    this.fetchPurposeStats(fromYear, fromMonth, toYear, toMonth);
  }

  private fetchPurposeStats(
    fromYear?: number,
    fromMonth?: number,
    toYear?: number,
    toMonth?: number
  ): void {
    this.purposeLoading = true;

    this.statisticsService
      .getPurposeOfTravelStats(fromYear, fromMonth, toYear, toMonth)
      .subscribe({
        next: (res) => {
          this.purposeStats = res;
          this.buildPurposeChart(res);
          this.purposeLoading = false;
        },
        error: (err) => {
          console.error('Error loading purpose-of-travel stats', err);
          this.purposeLoading = false;
        },
      });
  }

  private buildPurposeChart(res: PurposeOfTravelStatsResponse): void {
    const labels = res.months.map((m) => m.month_label);

    const administrativeData = res.months.map((m) => m.administrative_count);
    const operationalData = res.months.map((m) => m.operational_count);

    this.purposeChartData = {
      labels,
      datasets: [
        {
          label: 'נסיעות מנהלתיות',
          data: administrativeData,
          backgroundColor: '#103e76',
          stack: 'purpose',
        },
        {
          label: 'נסיעות מבצעיות',
          data: operationalData,
          backgroundColor: '#811313',
          stack: 'purpose',
        },
      ],
    };

    this.purposeChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            font: {
              family: 'Alef, Arial, sans-serif',
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const datasetIndex = ctx.datasetIndex;
              const monthIndex = ctx.dataIndex;
              const month = res.months[monthIndex];

              if (!month) {
                return '';
              }

              if (datasetIndex === 0) {
                return `מנהלי: ${month.administrative_count} (${month.administrative_percentage}%)`;
              } else {
                return `מבצעי: ${month.operational_count} (${month.operational_percentage}%)`;
              }
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'חודש',
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'מספר נסיעות',
          },
          ticks: {
            precision: 0,
          },
        },
      },
    };
  }

  private getEnglishTitle(): string {
    const isVehicleTab = this.activeTabIndex === 0;
    const isRideTab = this.activeTabIndex === 1;
    const isTopUsedTab = this.activeTabIndex === 2;
    const isUserRidesTab = this.activeTabIndex === 3;
    const isNoShowTab = this.activeTabIndex === 4;
    const isRideStartTimeTab = this.activeTabIndex === 5;
    const isPurposeTab = this.activeTabIndex === 6;

    if (isVehicleTab) {
      if (this.vehicleStatusComponent?.selectedVehicleType) {
        return `Vehicle Status (${this.vehicleStatusComponent.selectedVehicleType})`;
      }
      return 'Vehicle Status';
    }

    if (isRideTab) {
      return 'Ride Status';
    }

    if (isTopUsedTab) {
      return this.vehicleUsageComponent?.isMonthlyView
        ? 'Monthly Vehicle Usage'
        : 'High Usage Vehicles';
    }

    if (isUserRidesTab) {
      return 'Rides by User';
    }

    if (isNoShowTab) {
      return 'User No-Show Table';
    }

    if (isRideStartTimeTab) {
      return 'Ride Start Time Distribution';
    }

    if (isPurposeTab) {
      return 'Purpose of Travel Distribution';
    }

    return 'Analytics Report';
  }

  private getHebrewFileBaseName(): string {
    const isVehicleTab = this.activeTabIndex === 0;
    const isRideTab = this.activeTabIndex === 1;
    const isTopUsedTab = this.activeTabIndex === 2;
    const isUserRidesTab = this.activeTabIndex === 3;
    const isNoShowTab = this.activeTabIndex === 4;
    const isRideStartTimeTab = this.activeTabIndex === 5;
    const isPurposeTab = this.activeTabIndex === 6;

    if (isVehicleTab) {
      return this.vehicleStatusComponent?.selectedVehicleType !== ''
        ? `סטטוס רכבים (${this.vehicleStatusComponent.selectedVehicleType})`
        : 'סטטוס רכבים (כל הסוגים)';
    }

    if (isRideTab) {
      return 'סטטוס נסיעות';
    }

    if (isTopUsedTab) {
      return this.vehicleUsageComponent?.isMonthlyView
        ? 'שימוש חודשי ברכבים'
        : 'רכבים בשימוש גבוה';
    }

    if (isUserRidesTab) {
      return 'נסיעות לפי משתמש';
    }

    if (isNoShowTab) {
      return 'טבלת אי-הגעות';
    }

    if (isRideStartTimeTab) {
      return 'זמני התחלת נסיעות';
    }

    if (isPurposeTab) {
      return 'מטרת נסיעה';
    }

    return 'דוח אנליטיקות';
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
      'ממתין לאישור': 'pending',
      אושר: 'approved',
      נדחה: 'rejected',
      בנסיעה: 'in_progress',
      הושלם: 'completed',
      'בוטלה-נסיעה לא בוצעה': 'cancelled_due_to_no_show',
    };
    return reverseMap[hebrewLabel] || hebrewLabel;
  }
  private buildRideStartChart(res: RideStartTimeStatsResponse): void {
    const labels = Array.from(
      { length: 24 },
      (_, h) => h.toString().padStart(2, '0') + ':00'
    );
    const data = new Array(24).fill(0);

    res.buckets.forEach((bucket) => {
      if (bucket.hour >= 0 && bucket.hour <= 23) {
        data[bucket.hour] = bucket.ride_count;
      }
    });

    this.rideStartTimeChartData = {
      labels,
      datasets: [
        {
          label: 'מספר נסיעות המתחילות בשעה זו',
          data,
          backgroundColor: '#103e76',
        },
      ],
    };

    this.rideStartTimeChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            font: {
              family: 'Alef, Arial, sans-serif',
            },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `שעה ${ctx.label} - ${ctx.parsed.y} נסיעות`,
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'שעת התחלת הנסיעה (0–23)',
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'מספר נסיעות',
          },
          ticks: {
            precision: 0,
          },
        },
      },
    };
  }
  private fetchRideStartTimeStats(fromDate?: string, toDate?: string): void {
    this.rideStartTimeLoading = true;

    this.statisticsService.getRideStartTimeStats(fromDate, toDate).subscribe({
      next: (res) => {
        this.buildRideStartChart(res);
        this.rideStartTimeLoading = false;
      },
      error: (err) => {
        console.error('Error loading ride start time stats', err);
        this.rideStartTimeLoading = false;
      },
    });
  }
  private loadDefaultRideStartTimeStats(): void {
    const now = new Date();
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const from = new Date(to);
    from.setMonth(from.getMonth() - 3);

    const fromStr = from.toISOString().substring(0, 10);
    const toStr = to.toISOString().substring(0, 10);

    this.fetchRideStartTimeStats(fromStr, toStr);
  }
}
