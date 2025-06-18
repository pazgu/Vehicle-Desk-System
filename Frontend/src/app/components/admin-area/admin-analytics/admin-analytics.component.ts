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
 
  // Initialization flags
  vehicleChartInitialized = false;
  rideChartInitialized = false;

  topUsedVehiclesData: any;
  topUsedVehiclesOptions: any;


  constructor(private http: HttpClient, private socketService: SocketService) {}

  ngOnInit() {
    this.loadVehicleChart();
    this.loadRideChart();
    this.loadTopUsedVehiclesChart();

    
    this.socketService.rideStatusUpdated$.subscribe(() => {
      console.log('🔔 rideStatusUpdated$ triggered');
      this.loadRideChart();
    });

    this.socketService.vehicleStatusUpdated$.subscribe(() => {
      console.log('🔔 vehicleStatusUpdated$ triggered');
      this.loadVehicleChart();
    });

    this.socketService.deleteRequests$.subscribe(() => {
      console.log('🔔 deleteRequest$ triggered');
      this.loadRideChart();
      this.loadVehicleChart();
    });
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
      'cancelled': 'בוטל'
    };
    return statusMap[status] || status;
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
    'cancelled': 'Cancelled'
  };
  return statusMap[status] || status;
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
    'בוטל': 'cancelled'
  };
  return reverseMap[hebrewLabel] || hebrewLabel;
}

private loadTopUsedVehiclesChart() {
  this.http.get<{ plate_number: string; vehicle_model: string; ride_count: number }[]>(
    `${environment.apiUrl}/analytics/top-used-vehicles`
  ).subscribe({
    next: data => {
      const labels = data.map(v => `${v.plate_number} – ${v.vehicle_model}`);
      const counts = data.map(v => v.ride_count);

      const backgroundColors = counts.map(count => {
        if (count > 10) return '#FF5252';    // Red
        if (count >= 5) return '#FFC107';    // Yellow
        return '#42A5F5';                    // Blue
      });

      const hoverColors = backgroundColors.map(color => color + 'CC'); // Slight transparency

      const usageLevels = counts.map(count => {
        if (count > 10) return 'שימוש גבוה';
        if (count >= 5) return 'בינוני';
        return 'טוב';
      });

      this.topUsedVehiclesData = {
        labels,
        datasets: [{
          label: 'כמות נסיעות',
          data: counts,
          backgroundColor: backgroundColors,
          hoverBackgroundColor: hoverColors
        }]
      };

      this.topUsedVehiclesOptions = {
        indexAxis: 'y',
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context: any) {
                const label = context.chart.data.labels[context.dataIndex];
                const value = context.raw;
                const usage = usageLevels[context.dataIndex];
                return `${label}: ${value} נסיעות (${usage})`;
              }
            }
          },
          legend: {
            display: false
          }
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: 'מספר נסיעות'
            },
            ticks: {
              stepSize: 1,
              beginAtZero: true
            }
          },
          y: {
            title: {
              display: true,
              text: 'רכב'
            },
            ticks: {
              mirror: false,
              padding: 10
            }
          }
        },
        locale: 'he-IL'
      };
    },
    error: err => {
      console.error('❌ Error fetching top used vehicles:', err);
    }
  });
}


}