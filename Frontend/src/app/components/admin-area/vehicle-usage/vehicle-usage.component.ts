import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { cloneDeep } from 'lodash';

@Component({
  selector: 'vehicle-usage',
  imports: [CommonModule, FormsModule, ChartModule],
  templateUrl: './vehicle-usage.component.html',
  styleUrl: './vehicle-usage.component.css',
})
export class VehicleUsageComponent {
  isMonthlyView = true;
  selectedMonth = (new Date().getMonth() + 1).toString();
  selectedYear = new Date().getFullYear().toString();
  monthlyChartData: any;
  topUsedVehiclesData: any;
  monthlyChartOptions: any;
  topUsedVehiclesOptions: any;
  monthlyStatsChartData: any;
  monthlyStatsChartOptions: any;
  showChart = true;
  allTimeStatsChartData: any;
  allTimeStatsChartOptions: any;
  allTimeChartData: any;
  allTimeChartOptions: any;
  currentMonthlyPage = 1;
  currentAllTimePage = 1;
  itemsPerPage = 4;
  exportKilometers: number[] = [];
exportRideCounts: number[] = [];
exportLabels: string[] = [];


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
  years = Array.from({ length: 5 }, (_, i) =>
    (new Date().getFullYear() - i).toString()
  );
  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadAllTimeTopUsedVehiclesChart();
    this.loadTopUsedVehiclesChart();
  }
  onMonthOrYearChange() {
    this.updateQueryParams({
      month: this.selectedMonth,
      year: this.selectedYear,
    });
  }
  updateQueryParams(params: any) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
    });
  }
  toggleUsageView() {
    this.isMonthlyView = !this.isMonthlyView;
    if (this.isMonthlyView) {
      this.setMonthlyDefaults();
      this.currentMonthlyPage = 1;
      this.loadTopUsedVehiclesChart();
      this.reloadChart();
    } else {
      this.loadAllTimeTopUsedVehiclesChart();
      this.reloadChart();
    }
  }
  get isMonthlyNoData(): boolean {
    return (
      !this.monthlyStatsChartData ||
      !this.monthlyStatsChartData.labels ||
      this.monthlyStatsChartData.labels.length === 0
    );
  }
  get isAllTimeNoData(): boolean {
    return (
      !this.allTimeStatsChartData ||
      !this.allTimeStatsChartData.labels ||
      this.allTimeStatsChartData.labels.length === 0
    );
  }
  private reloadChart() {
    this.showChart = false;
    setTimeout(() => {
      this.showChart = true;
    }, 0);
  }

  public loadAllTimeTopUsedVehiclesChart() {
    this.http
      .get(`${environment.apiUrl}/vehicles/usage-stats?range=all`)
      .subscribe({
        next: (res: any) => {
          const stats = res?.stats || [];

          if (!stats.length) {
            this.allTimeChartData = {
              labels: ['אין נתונים'],
              datasets: [{ data: [1], backgroundColor: ['#E0E0E0'] }],
            };

            this.allTimeChartOptions = {
              plugins: { legend: { display: false } },
              scales: {
                x: {
                  title: { display: true, text: 'כמות נסיעות' },
                  ticks: { stepSize: 1, beginAtZero: true, precision: 0 },
                },
                y: {
                  title: { display: true, text: 'רכב' },
                  ticks: {
                    callback: (value: any, index: number, ticks: any) =>
                      ticks.length - index,
                  },
                },
              },
              locale: 'he-IL',
            };

            this.topUsedVehiclesData = { ...cloneDeep(this.allTimeChartData) };
            this.topUsedVehiclesOptions = {
              ...cloneDeep(this.allTimeChartOptions),
            };
            this.allTimeStatsChartData = {
              ...cloneDeep(this.allTimeChartData),
            };
            this.allTimeStatsChartOptions = {
              ...cloneDeep(this.allTimeChartOptions),
            };
            return;
          }

          const labels = stats.map(
            (s: any) => `${s.plate_number} ${s.vehicle_model}`
          );
          const data = stats.map((s: any) => s.total_rides);
          const kilometers = stats.map((a: { total_km: number }) => a.total_km);
          const counts = stats.map((v: { total_rides: number }) =>
            Number.isFinite(v.total_rides) ? v.total_rides : 0
          );

          this.exportLabels = labels;
          this.exportRideCounts = counts;
          this.exportKilometers = kilometers;


          const backgroundColors = counts.map((count: number) => {
            if (count > 10) return '#FF5252';
            if (count >= 5) return '#FFC107';
            return '#42A5F5';
          });

          this.allTimeChartData = {
            labels,
            datasets: [
              {
                label: 'Total Rides',
                data: counts,
                backgroundColor: backgroundColors,
              },
            ],
          };

          this.allTimeChartOptions = {
            indexAxis: 'y',
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx: any) => {
                    const km = kilometers[ctx.dataIndex];
                    return `${ctx.parsed.x} נסיעות | ${km} ק"מ`;
                  },
                },
              },
            },
            scales: {
              x: {
                title: { display: true, text: 'כמות הנסיעות' },
                ticks: { beginAtZero: true, stepSize: 1, precision: 0 },
              },
              y: {
                title: { display: true, text: 'רכב' },
                ticks: {
                  autoSkip: false,

                  callback: (value: any, index: number, ticks: any) =>
                    ticks.length - index,
                },
              },
            },
            locale: 'he-IL',
          };

          this.topUsedVehiclesData = { ...cloneDeep(this.allTimeChartData) };
          this.topUsedVehiclesOptions = {
            ...cloneDeep(this.allTimeChartOptions),
          };
          this.allTimeStatsChartData = { ...cloneDeep(this.allTimeChartData) };
          this.allTimeStatsChartOptions = {
            ...cloneDeep(this.allTimeChartOptions),
          };
        },
        error: (err: any) => {
          console.error('Error fetching all-time used vehicles:', err);
        },
      });
  }

  public loadTopUsedVehiclesChart() {
    this.http
      .get<{
        month: number;
        stats: {
          plate_number: string;
          vehicle_model: string;
          total_rides: number;
          total_km: number;
        }[];
        year: number;
      }>(
        `${environment.apiUrl}/vehicles/usage-stats?range=month&year=${this.selectedYear}&month=${this.selectedMonth}`
      )
      .subscribe({
        next: (data) => {
          const labels = data.stats.map(
            (v) => ` ${v.plate_number} – ${v.vehicle_model}`
          );
          const counts = data.stats.map((v) =>
            Number.isFinite(v.total_rides) ? v.total_rides : 0
          );
          const kilometers = data.stats.map((v) => v.total_km);

          this.exportLabels = labels;
this.exportRideCounts = counts;
this.exportKilometers = kilometers;


          const backgroundColors = counts.map((count) => {
            if (count > 10) return '#FF5252';
            if (count >= 5) return '#FFC107';
            return '#42A5F5';
          });

          const hoverColors = backgroundColors.map((color) => color + 'CC');

          const usageLevels = counts.map((count) => {
            if (count > 10) return 'שימוש גבוה';
            if (count >= 5) return 'שימוש בינוני';
            return 'שימוש טוב';
          });

          this.monthlyChartData = {
            labels,
            datasets: [
              {
                label: 'מספר נסיעות',
                data: counts,
                backgroundColor: backgroundColors,
                hoverBackgroundColor: hoverColors,
              },
            ],
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
                    const km = kilometers[context.dataIndex];

                    return `${label}: ${value} נסיעות (${usage}) | ${km} ק"מ`;
                  },
                },
              },
              legend: { display: false },
            },
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: {
                title: { display: true, text: 'כמות נסיעות' },
                ticks: {
                  stepSize: 1,
                  beginAtZero: true,
                  precision: 0,
                },
              },
              y: {
                title: { display: true, text: 'רכב' },
                ticks: {
                  callback: (value: any, index: number, ticks: any) =>
                    ticks.length - index,
                },
              },
            },
          };

          this.topUsedVehiclesData = { ...cloneDeep(this.monthlyChartData) };
          this.topUsedVehiclesOptions = {
            ...cloneDeep(this.monthlyChartOptions),
          };
          this.monthlyStatsChartData = { ...this.monthlyChartData };
          this.monthlyStatsChartOptions = { ...this.monthlyChartOptions };
        },
        error: (err) => {
          console.error('Error fetching top used vehicles:', err);
        },
      });
  }

  get paginatedMonthlyData() {
    return this.getPaginatedData(
      this.monthlyStatsChartData,
      this.currentMonthlyPage
    );
  }

  get paginatedAllTimeData() {
    return this.getPaginatedData(
      this.allTimeStatsChartData,
      this.currentAllTimePage
    );
  }

  get totalMonthlyPages(): number {
    if (!this.monthlyStatsChartData?.labels) return 0;
    return Math.ceil(
      this.monthlyStatsChartData.labels.length / this.itemsPerPage
    );
  }

  get totalAllTimePages(): number {
    if (!this.allTimeStatsChartData?.labels) return 0;
    return Math.ceil(
      this.allTimeStatsChartData.labels.length / this.itemsPerPage
    );
  }

  getPaginatedData(chartData: any, currentPage: number) {
    if (!chartData?.labels || !chartData?.datasets?.[0]?.data) {
      return [];
    }

    const startIndex = (currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;

    return chartData.labels
      .slice(startIndex, endIndex)
      .map((label: string, index: number) => {
        return {
          name: label,
          trips: chartData.datasets[0].data[startIndex + index],
        };
      });
  }

  nextMonthlyPage() {
    if (this.currentMonthlyPage < this.totalMonthlyPages) {
      this.currentMonthlyPage++;
    }
  }

  prevMonthlyPage() {
    if (this.currentMonthlyPage > 1) {
      this.currentMonthlyPage--;
    }
  }

  nextAllTimePage() {
    if (this.currentAllTimePage < this.totalAllTimePages) {
      this.currentAllTimePage++;
    }
  }

  prevAllTimePage() {
    if (this.currentAllTimePage > 1) {
      this.currentAllTimePage--;
    }
  }

  getUsageStatus(trips: number): string {
    if (trips <= 4) return 'טוב';
    if (trips >= 5 && trips <= 10) return 'בינוני';
    return 'גבוה';
  }

  private setMonthlyDefaults(): void {
  this.selectedMonth = (new Date().getMonth() + 1).toString();
  this.selectedYear = new Date().getFullYear().toString();
}

public clearMonthlyFilters(): void {
  this.setMonthlyDefaults();
  this.currentMonthlyPage = 1;
  this.loadTopUsedVehiclesChart();
  this.updateQueryParams({
    month: this.selectedMonth,
    year: this.selectedYear,
  });
}

}
