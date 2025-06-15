import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartModule } from 'primeng/chart';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';



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

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadVehicleChart();
    this.loadRideChart();
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
    
    this.vehicleChartData = {
      labels: [...labels],
      datasets: [{
        data: [...values],
        backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726'],
        hoverBackgroundColor: ['#64B5F6', '#81C784', '#FFB74D']
      }]
    };

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

    this.rideChartData = {
      labels: [...labels],
      datasets: [{
        data: [...values],
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
        hoverBackgroundColor: ['#FF6384CC', '#36A2EBCC', '#FFCE56CC', '#4BC0C0CC', '#9966FFCC', '#FF9F40CC']
      }]
    };

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
}