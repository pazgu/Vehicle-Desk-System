import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  FreezeReason,
  VehicleOutItem,
} from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { ToastService } from '../../../services/toast.service';
import { VehicleService } from '../../../services/vehicle.service';
import { SocketService } from '../../../services/socket.service';
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'vehicle-status',
  imports: [CommonModule, FormsModule, ChartModule],
  templateUrl: './vehicle-status.component.html',
  styleUrl: './vehicle-status.component.css',
})
export class VehicleStatusComponent {
  selectedVehicleType: string = '';
  vehicleChartData: any;
  vehicleChartOptions: any;
  frozenVehicles = <VehicleOutItem[]>[];
  vehicleChartInitialized = false;
  vehicleTypes: string[] = [];

  constructor(
    private toastService: ToastService,
    private vehicleService: VehicleService,
    private socketService: SocketService
  ) {}
  ngOnInit() {
    this.loadVehicleChart();
    this.loadFrozenVehicles();
    this.loadVehicleTypes();
    this.socketService.vehicleStatusUpdated$.subscribe(() => {
      this.loadVehicleChart();
      this.loadFrozenVehicles();
    });
    this.socketService.deleteRequests$.subscribe(() => {
      this.loadVehicleChart();
      this.loadFrozenVehicles();
    });
  }

  getHebrewLabel(status: string): string {
    const statusMap: { [key: string]: string } = {
      available: 'זמין',
      in_use: 'בשימוש',
      frozen: 'מוקפא',
    };
    return statusMap[status] || status;
  }

  onVehicleTypeFilterChange() {
    this.loadVehicleChart();
  }

  public updateVehicleChart(data: { status: string; count: number }[]) {
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
          return '#66BB6A';
        case 'frozen':
          return '#42A5F5';
        case 'in_use':
          return '#FFA726';
        default:
          return '#BDBDBD';
      }
    });

    const hoverColors = data.map((d) => {
      switch (d.status) {
        case 'available':
          return '#81C784';
        case 'frozen':
          return '#64B5F6';
        case 'in_use':
          return '#FFB74D';
        default:
          return '#E0E0E0';
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

  loadVehicleTypes() {
    this.vehicleService.getVehicleTypes().subscribe({
      next: (vehicleTypes) => {
        this.vehicleTypes = vehicleTypes;
      },
      error: (err) => {
        this.toastService.show('אירעה שגיאה בטעינת סוגי רכבים', 'error');
      },
    });
  }

  private loadVehicleChart() {
    this.vehicleService
      .getVehicleStatusSummary(this.selectedVehicleType)
      .subscribe({
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

  get isVehicleNoData(): boolean {
    return (
      this.vehicleChartData?.labels?.length === 1 &&
      this.vehicleChartData.labels[0] === 'אין נתונים'
    );
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
}
