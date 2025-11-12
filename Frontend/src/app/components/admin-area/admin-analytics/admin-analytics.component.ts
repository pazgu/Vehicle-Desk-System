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
  ],
  templateUrl: './admin-analytics.component.html',
  styleUrls: ['./admin-analytics.component.css'],
})
export class AdminAnalyticsComponent implements OnInit {
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
  years = Array.from({ length: 5 }, (_, i) =>
    (new Date().getFullYear() - i).toString()
  );

  ngOnInit() {}
  ngAfterViewInit() {
        setTimeout(() => {
      this.activeTabIndex = 0;})
        
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
        ? this.vehicleStatusComponent.vehicleChartData
        : isRideTab
        ? this.rideStatusComponent.rideChartData
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
      ? this.vehicleStatusComponent.vehicleChartData
      : isRideTab
      ? this.rideStatusComponent.rideChartData
      : this.vehicleUsageComponent.topUsedVehiclesData;

    const title = isNoShowTab
      ? 'טבלת אי-הגעות'
      : isVehicleTab
      ? this.vehicleStatusComponent.selectedVehicleType !== ''
        ? `סטטוס רכבים (${this.vehicleStatusComponent.selectedVehicleType})`
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
        ? this.vehicleStatusComponent.vehicleChartData
        : isRideTab
        ? this.rideStatusComponent.rideChartData
        : this.vehicleUsageComponent.topUsedVehiclesData;
    }
    const title = isNoShowTab
      ? 'טבלת אי-הגעות'
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
