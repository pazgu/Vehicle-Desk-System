import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartModule } from 'primeng/chart';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { SocketService } from '../../../services/socket.service';
import * as Papa from 'papaparse';
import pdfMake from 'pdfmake/build/pdfmake';
import { saveAs } from 'file-saver';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import openSans from '!!raw-loader!../../../assets/fonts/OpenSans-VariableFont_wdth,wght.ttf';
import openSansItalic from '!!raw-loader!../../../assets/fonts/OpenSans-Italic-VariableFont_wdth,wght.ttf';

(pdfMake as any).vfs = {
  'OpenSans.ttf': openSans,
  'OpenSans-Italic.ttf': openSansItalic
};

(pdfMake as any).fonts = {
  OpenSans: {
    normal: 'OpenSans.ttf',
    bold: 'OpenSans.ttf',
    italics: 'OpenSans-Italic.ttf',
    bolditalics: 'OpenSans-Italic.ttf'
  }
};






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


  constructor(private http: HttpClient,private socketService:SocketService) {}

  ngOnInit() {
    this.loadVehicleChart();
    this.loadRideChart();
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
            // Set empty chart data
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
          // Set error state
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
    
    const newVehicleChartData = {
      labels: [...labels],
      datasets: [{
        data: [...values],
        backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726'],
        hoverBackgroundColor: ['#64B5F6', '#81C784', '#FFB74D']
      }]
    };
      this.vehicleChartData = { ...newVehicleChartData }; // 👈 NEW OBJECT

    

    this.vehicleChartOptions = {
      plugins: {
        legend: { 
          labels: { color: '#495057', style: { size: '300px !important'  } }
        }
      },
      responsive: true,
      maintainAspectRatio: false
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
    
    console.log('📊 Chart labels:', labels);
    console.log('📊 Chart values:', values);

    const newrideChartData = {
      labels: [...labels],
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
          labels: { color: '#495057', style: { size: '300px !important'  } }
        }
      },
      responsive: true,
      maintainAspectRatio: false
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
    // Vehicle tab
    this.http.get<{ status: string; count: number }[]>(`${environment.apiUrl}/analytics/vehicle-status-summary`)
      .subscribe(data => {
        const sortedData = this.selectedSortOption === 'default' ? data : [...data].sort(sortFn);
        this.updateVehicleChart(sortedData);
      });
  } else {
    // Ride tab
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
  const chartData = isVehicleTab ? this.vehicleChartData : this.rideChartData;
  const title = isVehicleTab ? 'Vehicle Status Summary' : 'Ride Status Summary';
  const timestamp = new Date().toLocaleString();

  const body = chartData.labels.map((label: string, i: number) => [
    label,
    chartData.datasets[0].data[i]
  ]);

  const docDefinition: any = {
  content: [
    { text: title, style: 'header' },
    { text: `נוצר בתאריך: ${timestamp}`, style: 'subheader' },
    {
      table: {
        headerRows: 1,
        widths: ['*', '*'],
        body: [
          [{ text: 'סטטוס', alignment: 'right' }, { text: 'כמות', alignment: 'right' }],
          ...body.map((row: any[]) =>
            row.map((cell: any) => ({ text: String(cell), alignment: 'right' }))
          )
        ]
      }
    }
  ],
  styles: {
    header: {
      fontSize: 22,
      bold: true,
      alignment: 'right',
      margin: [0, 0, 0, 10]
    },
    subheader: {
      fontSize: 14,
      alignment: 'right',
      margin: [0, 0, 0, 10]
    }
  },
  defaultStyle: {
    font: 'OpenSans', // ✅ Use what's included in vfs_fonts
    fontSize: 14
  }
};


  pdfMake.createPdf(docDefinition).download(`${title}-${timestamp}.pdf`);
}

public exportCSV(): void {
  const isVehicleTab = this.activeTabIndex === 0;
  const chartData = isVehicleTab ? this.vehicleChartData : this.rideChartData;
  const title = isVehicleTab ? 'Vehicle_Status_Summary' : 'Ride_Status_Summary';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const data = chartData.labels.map((label: string, i: number) => ({
    Status: label,
    Count: chartData.datasets[0].data[i]
  }));

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${title}-${timestamp}.csv`);
}


}