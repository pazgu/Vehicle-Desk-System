import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MyRidesService } from '../../../services/myrides.service';

@Component({
  selector: 'app-ride-list-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ride-list-table.component.html',
  styleUrls: ['./ride-list-table.component.css'],
})
export class RideListTableComponent implements OnChanges {
  @Input() filteredOrders: any[] = [];
  @Input() loading: boolean = false;
  @Input() highlightedOrderId: string | null = null;
  @Input() allOrders: any[] = [];
  @Input() ordersPerPage: number = 4;

  @Output() viewRide = new EventEmitter<any>();
  @Output() editRide = new EventEmitter<any>();
  @Output() deleteRide = new EventEmitter<any>();
  @Output() newRide = new EventEmitter<void>();
  @Output() rebookRide = new EventEmitter<any>();

  constructor(private router: Router, private myrideservice: MyRidesService) {}

  currentPage = 1;
  pagedOrders: any[] = [];
  role = localStorage.getItem('role');
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filteredOrders'] || changes['ordersPerPage']) {
      this.currentPage = 1;
      this.updatePagedOrders();
    }
  }

  get totalPages(): number {
    return this.filteredOrders.length > 0
      ? Math.ceil(this.filteredOrders.length / this.ordersPerPage)
      : 1;
  }

  private updatePagedOrders(): void {
    const start = (this.currentPage - 1) * this.ordersPerPage;
    this.pagedOrders = this.filteredOrders.slice(
      start,
      start + this.ordersPerPage
    );
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagedOrders();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagedOrders();
    }
  }

  getStatusTooltip(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'אושר';
      case 'pending':
        return 'ממתין לאישור';
      case 'rejected':
        return 'נדחה';
      case 'completed':
        return 'בוצע';
      case 'in_progress':
        return 'בנסיעה';
      case 'cancelled_due_to_no_show':
        return 'בוטלה עקב אי-הגעה';
      case 'reserved':
        return 'מוזמן';
      case 'cancelled':
        return 'בוטל';
      case 'cancelled_vehicle_unavailable':
        return 'בוטל – הרכב לא זמין';
      default:
        return 'סטטוס לא ידוע';
    }
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'status-green';
      case 'pending':
        return 'status-yellow';
      case 'rejected':
        return 'status-red';
      case 'in_progress':
        return 'status_in_progress';
      case 'cancelled_due_to_no_show':
        return 'status-cancelled_due_to_no_show';
      case 'reserved':
        return 'status-reserved';
      case 'cancelled':
        return 'status-cancelled';
      case 'cancelled_vehicle_unavailable':
        return 'status-cancelled_vehicle_unavailable';
      default:
        return '';
    }
  }

  isPastOrder(order: any): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const orderDate = this.parseDate(order.date);
    orderDate.setHours(0, 0, 0, 0);
    return orderDate < today;
  }

  isCompletedOrder(order: any): boolean {
    return order.status === 'completed';
  }

  isPaidOrder(order: any): boolean {
    const maxFreeRides = 6;
    const beginningOfMonth = new Date();
    beginningOfMonth.setDate(1);
    beginningOfMonth.setHours(0, 0, 0, 0);
    const orderDate = this.parseDate(order.date);

    if (
      orderDate.getMonth() === beginningOfMonth.getMonth() &&
      orderDate.getFullYear() === beginningOfMonth.getFullYear()
    ) {
      const priorOrdersThisMonth = this.allOrders.filter((o: any) => {
        const oDate = this.parseDate(o.date);
        return (
          oDate.getMonth() === beginningOfMonth.getMonth() &&
          oDate.getFullYear() === beginningOfMonth.getFullYear() &&
          oDate < orderDate
        );
      }).length;
      return priorOrdersThisMonth >= maxFreeRides;
    }
    return false;
  }

  checkIfOverOneDay(order: any): boolean {
    const orderStartDate = new Date(order.start_datetime);
    const orderEndDate = new Date(order.end_datetime);
    const startDay = orderStartDate.toISOString().split('T')[0];
    const endDay = orderEndDate.toISOString().split('T')[0];
    return startDay !== endDay;
  }

  canEdit(order: any): boolean {
    const userRole = localStorage.getItem('role');
    const isSupervisor = userRole === 'supervisor';
    const isPending = order.status.toLowerCase() === 'pending';
    const isFuture = this.parseDate(order.date) >= new Date();

    if (!isSupervisor) {
      return isPending && isFuture;
    }

    const isEditableStatus = ['pending', 'approved'].includes(
      order.status.toLowerCase()
    );
    if (!isEditableStatus || !isFuture) return false;

    const rideDateTime = new Date(
      `${order.date.split('.').reverse().join('-')}T${order.time}:00`
    );
    const now = new Date();
    const timeDifferenceHours =
      (rideDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return timeDifferenceHours > 2;
  }

  ChangeStatus(id: string) {
    const userRole = localStorage.getItem('role');
    if (userRole != 'supervisor') {
      return;
    }
    this.router.navigate(['/order-card', id]);
  }

  canChangeStatus(order: any): boolean {
    const userRole = localStorage.getItem('role');
    if (userRole !== 'supervisor') return false;

    const [day, month, year] = order.date.split('.');
    const formattedDate = `${year}-${month}-${day}`;

    const combined = `${formattedDate}T${order.time}`;
    const start = new Date(combined);

    if (isNaN(start.getTime())) {
      console.error('Invalid datetime:', combined);
      return false;
    }

    return start.getTime() > Date.now();
  }
  canDelete(order: any, isRebookContext: boolean = false): boolean {
    if (!order) return false;

    const status = (order.status ?? '').toString().toLowerCase().trim();

    const userRole = localStorage.getItem('role');
    const isSupervisor = userRole === 'supervisor';

    if (status === 'cancelled_vehicle_unavailable') {
      return true;
    }

    const [day, month, year] = order.date.split('.');
    const rideDateTime = new Date(`${year}-${month}-${day}T${order.time}:00`);

    if (isNaN(rideDateTime.getTime())) {
      console.error('Invalid ride datetime:', order.date, order.time);
      return false;
    }

    const now = new Date();
    const isFuture = rideDateTime.getTime() > now.getTime();
    const isPending = status === 'pending';

    if (!isSupervisor) {
      if (isRebookContext) {
        return isPending && isFuture;
      }
      const timeDifferenceHours =
        (rideDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      return isPending && isFuture && timeDifferenceHours > 2;
    }

    const isDeletableStatus = ['pending', 'approved'].includes(status);
    if (!isDeletableStatus || !isFuture) return false;

    if (isRebookContext) {
      return true;
    }

    const timeDifferenceHours =
      (rideDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    return timeDifferenceHours > 2;
  }

  onViewRide(order: any): void {
    this.viewRide.emit(order);
  }

  onEditRide(order: any, event: Event): void {
    event.stopPropagation();
    this.editRide.emit(order);
  }

  onDeleteRide(order: any, event: Event): void {
    event.stopPropagation();
    this.deleteRide.emit(order);
  }

  onNewRide(): void {
    this.newRide.emit();
  }

  private parseDate(d: string): Date {
    const [day, month, year] = d.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  }

  canRebook(order: any): boolean {
    if (!order?.status) return false;

    const status = order.status.toLowerCase();
    if (status === 'cancelled_vehicle_unavailable') {
      return true;
    }
    return false;
  }

  onRebook(order: any, event: Event): void {
    event.stopPropagation();
    this.rebookRide.emit(order);
  }
}
