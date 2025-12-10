import { Component } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { SocketService } from '../../../services/socket.service';
import { RideService } from '../../../services/ride.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ride-status',
  imports: [ChartModule, CommonModule],
  templateUrl: './ride-status.component.html',
  styleUrl: './ride-status.component.css',
})
export class RideStatusComponent {
  rideChartData: any;
  rideChartOptions: any;
  selectedRideStatus: string = '';
  rideChartInitialized = false;

  constructor(
    private socketService: SocketService,
    private rideService: RideService
  ) {}
  ngOnInit() {
    this.loadRideChart();
    this.socketService.rideStatusUpdated$.subscribe(() => {
      this.loadRideChart();
    });
    this.socketService.deleteRequests$.subscribe(() => {
      this.loadRideChart();
    });
  }

  get isNoData(): boolean {
    return (
      this.rideChartData?.labels?.length === 1 &&
      this.rideChartData.labels[0] === 'אין נתונים'
    );
  }
  onRideStatusFilterChange() {
    this.loadRideChart();
  }
  getRideStatusHebrew(status: string): string {
    const statusMap: { [key: string]: string } = {
      pending: 'ממתין לאישור',
      approved: 'אושר',
      rejected: 'נדחה',
      in_progress: 'בנסיעה',
      completed: 'בוצע',
      cancelled_due_to_no_show: 'בוטלה עקב אי-הגעה',
      cancelled_vehicle_unavailable: 'בוטל - רכב לא זמין',
    };
    return statusMap[status] || status;
  }

  public updateRideChart(data: { status: string; count: number }[]) {
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
      locale: 'he-IL',
    };
  }

  private loadRideChart() {
    this.rideService.getRideStatusSummary(this.selectedRideStatus).subscribe({
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
        console.error('Error loading ride data:', error);
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
}
