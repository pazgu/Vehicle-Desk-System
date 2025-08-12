import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { PaginatorModule } from 'primeng/paginator';
import { TableModule } from 'primeng/table';
import { OrderService } from '../../../services/order.service';
import { RideDashboardItem } from '../../../models/ride-dashboard-item/ride-dashboard-item.module';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SocketService } from '../../../services/socket.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-dashboard-all-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    DropdownModule,
    PaginatorModule,
    MatTooltipModule,
  ],
  templateUrl: './dashboard-all-orders.component.html',
  styleUrls: ['./dashboard-all-orders.component.css']
})
export class DashboardAllOrdersComponent implements OnInit {

  orders: RideDashboardItem[] = [];
  rows: number = 5;
  currentPage: number = 1;
  statusFilter: string = '';
  startDate: string = '';
  endDate: string = '';
  showFilters: boolean = false;
  showOldOrders: boolean = false;
  sortBy: string = 'submitted_at';



  constructor(private router: Router, private orderService: OrderService, private toastService: ToastService, private socketService: SocketService) { }

  ngOnInit(): void {
    const departmentId = localStorage.getItem('department_id');
    if (departmentId) {
      this.loadOrders(departmentId);
    } else {
      console.error('Department ID not found in localStorage.');
    }

    this.socketService.rideRequests$.subscribe((newRide) => {
      const role = localStorage.getItem('role')
      if (newRide) {
        if (newRide.department_id == departmentId && role != 'admin') {
          this.orders = [newRide, ...this.orders];
          if (role === 'supervisor') { this.toastService.show("התקבלה בקשה חדשה", "success"); }

        }
      }
    });
    this.socketService.orderUpdated$.subscribe((updatedRide) => {
      const index = this.orders.findIndex(o => o.ride_id === updatedRide.id);
      if (index !== -1) {
        const updatedOrder: RideDashboardItem = {
          ride_id: updatedRide.id,
          employee_name: updatedRide.employee_name, // make sure this is in your updatedRide
          requested_vehicle_plate: updatedRide.requested_vehicle_plate || '', // or map from vehicle_id if needed
          date_and_time: updatedRide.start_datetime,
          distance: updatedRide.estimated_distance_km,
          status: updatedRide.status.toLowerCase(),
          destination: updatedRide.destination || '', // adjust based on your data
          submitted_at: updatedRide.submitted_at || new Date().toISOString() // use actual value here!

        };

        // Replace with a new array to trigger change detection:
        this.orders = [
          ...this.orders.slice(0, index),
          updatedOrder,
          ...this.orders.slice(index + 1)
        ];

      }
    });
    this.socketService.deleteRequests$.subscribe((deletedRide) => {

      const index = this.orders.findIndex(o => o.ride_id === deletedRide.order_id); // <-- FIXED here

      if (index !== -1) {
        this.orders = [
          ...this.orders.slice(0, index),
          ...this.orders.slice(index + 1)
        ];
      }
    });
    this.socketService.rideStatusUpdated$.subscribe((updatedStatus) => {
      if (!updatedStatus) return; // ignore the initial null emission
      if (updatedStatus) {

        const index = this.orders.findIndex(o => o.ride_id === updatedStatus.ride_id);
        if (index !== -1) {
          const newStatus = updatedStatus.new_status

          const updatedOrders = [...this.orders];
          updatedOrders[index] = {
            ...updatedOrders[index],
            status: newStatus
          };

          // ✅ Replace the array
          this.orders = updatedOrders;
          this.orders = [...this.orders]


          const role = localStorage.getItem('role');
          if (role === 'supervisor' || role === 'employee' && updatedStatus != 'approved') {
            this.toastService.show(' יש בקשה שעברה סטטוס', 'success')
          }
        }
      }
    });

  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  onFilterChange(): void {
    this.currentPage = 1;
  }

  loadOrders(departmentId: string | null): void {
    if (departmentId) {
      this.orderService.getDepartmentOrders(departmentId).subscribe(
        (data) => {
          this.orders = Array.isArray(data) ? data : [];
        },
        (error) => {
          console.error('Error loading orders:', error);
        }
      );
    } else {
      console.error('Department ID not found in local storage.');
    }
  }

  get filteredOrders() {
    let filtered = [...this.orders];

    if (this.statusFilter) {
      switch (this.statusFilter) {
        case 'בהמתנה':
          filtered = filtered.filter(order => order.status === 'pending');
          break;
        case 'מאושר':
          filtered = filtered.filter(order => order.status === 'approved');
          break;
        case 'נדחה':
          filtered = filtered.filter(order => order.status === 'rejected');
          break;
        case 'בוצע':
          filtered = filtered.filter(order => order.status === 'completed');
          break;
        case 'בתהליך':
          filtered = filtered.filter(order => order.status === 'in_progress');
          break;
        case 'בוטל':
          filtered = filtered.filter(order => order.status === 'cancelled_due_to_no_show');
          break;
        default:
          break;
      }
    }

    if (this.startDate) {
      filtered = filtered.filter(order => new Date(order.date_and_time) >= new Date(this.startDate));
    }

    if (this.endDate) {
      const endDateAtEndOfDay = this.endDate ? new Date(this.endDate + 'T23:59:59') : null;
      if (endDateAtEndOfDay) {
        filtered = filtered.filter(order => new Date(order.date_and_time) <= endDateAtEndOfDay);
      }
    }

    switch (this.sortBy) {
      case 'status':
        return [...filtered].sort((a, b) => a.status.localeCompare(b.status));
      case 'date_and_time':
        return [...filtered].sort((a, b) => new Date(a.date_and_time).getTime() - new Date(b.date_and_time).getTime());
      case 'submitted_at':
        return [...filtered].sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      default:
        return filtered;

    }
  }


  onRowSelect(trip: RideDashboardItem) {
    this.router.navigate(['/order-card', trip.ride_id]);
  }

  getRowClass(status: string): string {
    switch (status) {
      case 'approved':
        return 'row-approved';
      case 'pending':
        return 'row-pending';
      case 'rejected':
        return 'row-rejected';
      case 'completed':
        return 'row-completed';
      case 'in_progress':
        return 'row-in-progress';
      case 'cancelled_due_to_no_show':
        return 'row-cancelled-no-show';
      default:
        return '';
    }
  }

  onRowClick(trip: RideDashboardItem) {
    this.router.navigate(['/order-card', trip.ride_id]);
  }

  translateStatus(status: string | null | undefined): string {
    if (!status) return '';

    switch (status.toLowerCase()) {
      case 'approved':
        return 'מאושר';
      case 'pending':
        return 'ממתין לאישור';
      case 'rejected':
        return 'נדחה';
      case 'completed':
        return 'בוצע';
      case 'in_progress':
        return 'בתהליך';
      case 'cancelled_due_to_no_show':
        return 'בוטלה-נסיעה לא יצאה';
      default:
        return status;
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'approved':
        return 'status-approved';
      case 'pending':
        return 'status-pending';
      case 'rejected':
        return 'status-rejected';
      case 'completed':
        return 'status-completed';
      case 'in_progress':
        return 'status-in-progress';
      case 'cancelled_due_to_no_show':
        return 'status-cancelled-no-show';
      default:
        return '';
    }
  }

  parseDate(dateTime: string): Date {
    const [datePart, timePart] = dateTime.split(' ');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }



  resetFilters() {
    this.statusFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.showOldOrders = false;
    this.sortBy = 'date_and_time';
    this.currentPage = 1;
  }

  onPageChange(event: any) {
    this.currentPage = event.page + 1;
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  get trips() {
    const startIndex = (this.currentPage - 1) * this.rows;
    return this.filteredOrders.slice(startIndex, startIndex + this.rows);
  }

  get totalPages() {
    return this.filteredOrders.length > 0 ? Math.ceil(this.filteredOrders.length / this.rows) : 1;
  }
  copiedRideId: string | null = null;

  copyToClipboard(rideId: string) {
    navigator.clipboard.writeText(rideId);
    this.copiedRideId = rideId;
    setTimeout(() => {
      if (this.copiedRideId === rideId) {
        this.copiedRideId = null;
      }
    }, 2000);
  }


}
