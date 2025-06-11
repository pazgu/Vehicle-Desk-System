import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ChartModule } from 'primeng/chart'; // ✅ required for p-chart
import { CommonModule } from '@angular/common'; // ✅ for structural directives like ngIf/ngFor
import { environment } from '../../../../environments/environment';
import { FormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';



@Component({
  selector: 'app-admin-analytics',
  standalone: true, // ✅ You’re using standalone so mark it
imports: [
  CommonModule,
  FormsModule,
  ChartModule,
  TabViewModule
],
  templateUrl: './admin-analytics.component.html',
  styleUrls: ['./admin-analytics.component.css'],
  
})
export class AdminAnalyticsComponent implements OnInit  {
  vehicleChartData: any;
  vehicleChartOptions: any;
  rideChartData: any;
  rideChartOptions: any;
  selectedSortOption = 'default'; // 🟢 default sort
  activeTabIndex = 0;





  constructor(private http: HttpClient) {}

onTabChange(index: number) {
  this.activeTabIndex = index;

  setTimeout(() => {
    const resizeEvent = new Event('resize');
    window.dispatchEvent(resizeEvent);
    
    // This will trigger chart resize too if DOM rendered but blank
    const canvas = document.querySelectorAll('canvas');
    canvas.forEach(c => {
      const event = new Event('resize');
      c.dispatchEvent(event);
    });
  }, 300); // ← 300ms to allow DOM render before resize
}






  ngOnInit() {

    
  // Vehicle Chart
  this.http.get<{ status: string; count: number }[]>(`${environment.apiUrl}/analytics/vehicle-status-summary`)
    .subscribe(data => {
          console.log('🚗 Vehicle Status Data:', data); // ✅ CORRECT

      const labels = data.map(d => this.getHebrewLabel(d.status));
      const values = data.map(d => d.count);

      this.vehicleChartData = {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726'],
          hoverBackgroundColor: ['#64B5F6', '#81C784', '#FFB74D']
        }]
      };

      this.vehicleChartOptions = {
        plugins: {
          legend: { labels: { color: '#495057' } }
        }
      };
    });



  // 🟢 Ride Chart
  this.http.get<{ status: string; count: number }[]>(`${environment.apiUrl}/analytics/ride-status-summary`)
    .subscribe(data => {
    console.log('🚌 Ride Status Data:', data); // ✅ FIXED NAME
    if (!data || data.length === 0) {
      console.warn('🚨 Vehicle chart has no data!');
    }

    // ... your original code
      const labels = data.map(d => this.getRideStatusHebrew(d.status));
      const values = data.map(d => d.count);

      this.rideChartData = {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
          hoverBackgroundColor: ['#FF6384CC', '#36A2EBCC', '#FFCE56CC', '#4BC0C0CC', '#9966FFCC', '#FF9F40CC']
        }]
      };

      console.log('🧠 rideChartData set:', this.rideChartData); // <== ADD THIS


      this.rideChartOptions = {
        plugins: {
          legend: { labels: { color: '#495057' } }
        }
      };
    });


    };

   

   onSortChange() {
  const sortFunc = {
    countAsc: (a: any, b: any) => a.count - b.count,
    countDesc: (a: any, b: any) => b.count - a.count,
    alphabetical: (a: any, b: any) => a.status.localeCompare(b.status),
    default: () => 0
  };

  // Re-fetch and sort
  this.http.get<{ status: string; count: number }[]>(`${environment.apiUrl}/analytics/vehicle-status-summary`)
    .subscribe(data => {
      const sorted = [...data].sort(sortFunc[this.selectedSortOption as keyof typeof sortFunc]);
      const labels = sorted.map(d => this.getHebrewLabel(d.status));
      const values = sorted.map(d => d.count);

      this.vehicleChartData = {
        labels,
        datasets: [{
          data: values,
          backgroundColor: ['#42A5F5', '#66BB6A', '#FFA726'],
          hoverBackgroundColor: ['#64B5F6', '#81C784', '#FFB74D']
        }]
      };
    });
}

  getHebrewLabel(status: string): string {
    switch (status) {
      case 'available': return 'זמין';
      case 'in_use': return 'בשימוש';
      case 'frozen': return 'מוקפא';
      default: return status;
    }
  }

  getRideStatusHebrew(status: string): string {
  switch (status) {
    case 'pending': return 'ממתין';
    case 'approved': return 'מאושר';
    case 'rejected': return 'נדחה';
    case 'in_progress': return 'בתהליך';
    case 'completed': return 'הושלם';
    case 'cancelled': return 'בוטל';
    default: return status;
  }
}

}
