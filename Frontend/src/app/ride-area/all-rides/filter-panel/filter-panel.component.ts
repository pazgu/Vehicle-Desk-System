import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MyRidesService } from '../../../services/myrides.service';
@Component({
  selector: 'app-ride-filter-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-panel.component.html',
  styleUrls: ['./filter-panel.component.css'],
})
export class FilterPanelComponent implements OnChanges {
  @Input() allOrders: any[] = [];
  @Input() rideViewMode: 'all' | 'future' | 'past' = 'all';
  @Input() sortBy: string = 'recent';
  @Input() statusFilter: string = '';
  @Input() startDate: string = '';
  @Input() endDate: string = '';
  @Input() showFilters: boolean = false;
  @Input() minDate: string = '';
  @Input() maxDate: string = '';
  @Output() filteredOrdersChanged = new EventEmitter<any[]>();
    dateError: boolean = false;
  @Output() clearFiltersClicked = new EventEmitter<void>();
  @Output() startDateChanged = new EventEmitter<string>();
  @Output() endDateChanged = new EventEmitter<string>();
  private filteredOrders: any[] = [];
  constructor(private myrideservice: MyRidesService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['allOrders'] ||
      changes['rideViewMode'] ||
      changes['sortBy'] ||
      changes['statusFilter'] ||
      changes['startDate'] ||
      changes['endDate']
    ) {
      this.applyFiltersAndSort();
      this.checkVipStatus();
    }
  }
  isVIP: boolean = false;

  onRideViewModeChange(mode: 'all' | 'future' | 'past'): void {
    this.rideViewMode = mode;
    this.applyFiltersAndSort();
  }
  validateDatesEndStart(): void {
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      this.dateError = start > end;
    } else {
      this.dateError = false;
    }
  }

  onSortChange(): void {
    this.applyFiltersAndSort();
  }

onClearFiltersClick(): void {
  this.rideViewMode = 'all';
  this.sortBy = 'recent';
  this.statusFilter = '';
  this.startDate = '';
  this.endDate = '';
  this.dateError = false;
  this.applyFiltersAndSort();
  this.clearFiltersClicked.emit();
}

  toggleFiltersVisibility(): void {
    this.showFilters = !this.showFilters;
  }

  onStatusFilterChange(): void {
    this.applyFiltersAndSort();
  }

  onDateChange(): void {
    this.applyFiltersAndSort();
  }

  validateDate(type: 'start' | 'end'): void {
    const value = type === 'start' ? this.startDate : this.endDate;
    if (!this.isDateValid(value)) {
      if (type === 'start') this.startDate = '';
      else this.endDate = '';
    }
  }

  private isDateValid(dateStr: string): boolean {
    if (!dateStr) return true;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const min = new Date(this.minDate);
    const max = new Date(this.maxDate);
    date.setHours(0, 0, 0, 0);
    min.setHours(0, 0, 0, 0);
    max.setHours(0, 0, 0, 0);
    return date >= min && date <= max;
  }
  checkVipStatus(): void {
    this.myrideservice.isVip().subscribe({
      next: (res) => {
        this.isVIP = res.is_vip;
      },
      error: (err) => {
        this.isVIP = false;
      },
    });
  }

  private translateStatusToEnglish(hebrewStatus: string): string {
    const statusMap: { [key: string]: string } = {
      אושר: 'approved',
      'ממתין לאישור': 'pending',
      נדחה: 'rejected',
      בוצע: 'completed',
      בנסיעה: 'in_progress',
      'בוטלה עקב אי-הגעה': 'cancelled_due_to_no_show',
      'בוטל - רכב לא זמין': 'cancelled_vehicle_unavailable',
    };
    return statusMap[hebrewStatus] || hebrewStatus;
  }

  private applyFiltersAndSort(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(today.getMonth() - 1);
    oneMonthAgo.setHours(0, 0, 0, 0);
    let filtered = [...this.allOrders];

    switch (this.rideViewMode) {
      case 'future':
        filtered = filtered.filter(
          (order) => this.parseDate(order.date) >= today,
        );
        break;
      case 'past':
        filtered = filtered.filter(
          (order) => this.parseDate(order.date) < today,
        );
        break;
    }

    if (this.statusFilter) {
      const englishStatus = this.translateStatusToEnglish(this.statusFilter);
      filtered = filtered.filter((order) => order.status === englishStatus);
    }

    if (this.startDate) {
      const start = new Date(this.startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter((order) => {
        const orderDate = this.parseDate(order.date);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate >= start;
      });
    }

    if (this.endDate) {
      const end = new Date(this.endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((order) => {
        const orderDate = this.parseDate(order.date);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate <= end;
      });
    }

    switch (this.sortBy) {
      case 'status':
        filtered = [...filtered].sort((a, b) =>
          a.status.localeCompare(b.status),
        );
        break;
      case 'date':
        filtered = [...filtered].sort(
          (a, b) =>
            this.parseDate(a.date).getTime() - this.parseDate(b.date).getTime(),
        );
        break;
      case 'recent':
      default:
        filtered = [...filtered].sort((a, b) => {
          const dateA = a.submitted_at
            ? new Date(a.submitted_at)
            : this.parseDate(a.date);
          const dateB = b.submitted_at
            ? new Date(b.submitted_at)
            : this.parseDate(b.date);
          return dateB.getTime() - dateA.getTime();
        });
    }

    this.filteredOrders = filtered;
    this.filteredOrdersChanged.emit(this.filteredOrders);
  }

  private parseDate(d: string): Date {
    const [day, month, year] = d.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  }
isFilterActive(): boolean {
  const hasStatus =
    this.statusFilter !== '' &&
    this.statusFilter !== null &&
    this.statusFilter !== undefined;
  const hasStartDate =
    this.startDate !== '' &&
    this.startDate !== null &&
    this.startDate !== undefined;
  const hasEndDate =
    this.endDate !== '' &&
    this.endDate !== null &&
    this.endDate !== undefined;

  return hasStatus || hasStartDate || hasEndDate;
}
  onStartDateChange(): void {
    this.validateDatesEndStart();
    this.onDateChange();
  }

  onEndDateChange(): void {
    this.validateDatesEndStart();
    this.onDateChange();
  }
}
