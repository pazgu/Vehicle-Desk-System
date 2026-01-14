import { Component, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { Router, ActivatedRoute, Params, RouterModule } from '@angular/router';
import { MyRidesService, RebookData } from '../../services/myrides.service';
import { ToastService } from '../../services/toast.service';
import { SocketService } from '../../services/socket.service';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../components/page-area/confirm-dialog/confirm-dialog.component';
import { StartedRidesResponse } from '../../models/ride.model';
import { FilterPanelComponent } from './filter-panel/filter-panel.component';
import { QuotaIndicatorComponent } from './quota-indicator/quota-indicator.component';
import { RideListTableComponent } from './ride-list-table/ride-list-table.component';
import { ExceededWarningBannerComponent } from './exceeded-warning-banner/exceeded-warning-banner.component';
import {
  HttpErrorResponse,
  HttpClient,
  HttpHeaders,
} from '@angular/common/http';
import { RideDetailsComponent } from './../ride-details/ride-details.component';
import { Subject, takeUntil } from 'rxjs';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FilterPanelComponent,
    QuotaIndicatorComponent,
    RideListTableComponent,
    ExceededWarningBannerComponent,
  ],
  templateUrl: './all-rides.component.html',
  styleUrls: ['./all-rides.component.css'],
})
export class AllRidesComponent implements OnInit {
  constructor(
    private router: Router,
    private rideService: MyRidesService,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private socketService: SocketService,
    private location: Location,
    private dialog: MatDialog,
    private http: HttpClient
  ) {}

  loading: boolean = false;
  orders: any[] = [];
  filteredOrders: any[] = [];
  highlightedOrderId: string | null = null;

  rideViewMode: 'all' | 'future' | 'past' = 'all';
  sortBy: string = 'recent';
  statusFilter: string = '';
  startDate: string = '';
  endDate: string = '';
  showFilters: boolean = false;
  showOldOrders: boolean = false;
  minDate = '2025-01-01';
  maxDate = new Date(new Date().setMonth(new Date().getMonth() + 2))
    .toISOString()
    .split('T')[0];
  private apiBase = 'http://127.0.0.1:8000/api';
  private destroy$ = new Subject<void>();

  get ordersPerPage(): number {
    return this.showFilters ? 3 : 4;
  }

  ngOnInit(): void {
   this.route.queryParams
  .pipe(takeUntil(this.destroy$))
  .subscribe((params) => {
    this.rideViewMode =
      (params['mode'] as 'all' | 'future' | 'past') || 'all';
    this.sortBy = params['sort'] || 'recent';
    this.statusFilter = params['status'] || '';
    this.startDate = params['start_date'] || '';
    this.endDate = params['end_date'] || '';
    this.showFilters = params['filters'] === 'true';
    this.showOldOrders = params['old_orders'] === 'true';

    this.rideService.clearRebookData();

    if (this.showOldOrders && !this.startDate && !this.endDate) {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      this.startDate = this.formatDateForInput(oneMonthAgo);
    }

    const idToHighlight = params['highlight'] || null;
    if (idToHighlight) {
      setTimeout(() => {
        this.highlightedOrderId = idToHighlight;
        setTimeout(() => {
          this.highlightedOrderId = null;
        }, 10000);
      }, 500);
    }

    this.fetchRides();
  });


    this.setupSocketSubscriptions();
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  editOrder(order: any): void {
    const userRole = localStorage.getItem('role');
    const isSupervisor = userRole === 'supervisor';
    const isFuture = this.parseDate(order.date) >= new Date();

    if (!isFuture) {
      this.toastService.show('אפשר לערוך רק הזמנות עתידיות ', 'error');
      return;
    }

    if (!isSupervisor) {
      const isPending = order.status.toLowerCase() === 'pending';
      if (!isPending) {
        this.toastService.show(
          'אפשר לערוך רק הזמנות עתידיות במצב "ממתין לאישור" ',
          'error'
        );
        return;
      }
    } else {
      const isEditableStatus = ['pending', 'approved'].includes(
        order.status.toLowerCase()
      );
      if (!isEditableStatus) {
        this.toastService.show(
          'אפשר לערוך רק הזמנות במצב "ממתין לאישור" או "אושר" ',
          'error'
        );
        return;
      }

      const rideDateTime = new Date(
        `${order.date.split('.').reverse().join('-')}T${order.time}:00`
      );
      const now = new Date();
      const timeDifferenceHours =
        (rideDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (timeDifferenceHours <= 2) {
        this.toastService.show(
          'אפשר לערוך הזמנה עד שעתיים לפני זמן הנסיעה ',
          'error'
        );
        return;
      }
    }

    if (!order.ride_id) {
      this.toastService.show('שגיאה בזיהוי הנסיעה', 'error');
      return;
    }

    this.router.navigate(['/ride/edit', order.ride_id]);
  }

clearFilters(): void {
  this.router.navigate([], {
    relativeTo: this.route,
    queryParams: {
      mode: 'all',
      sort: 'recent',
    },
    replaceUrl: true,
  });
}

  deleteOrder(order: any): void {
    const rawStatus = order.status || '';
    const status = rawStatus.toString().toLowerCase().trim();
    const userRole = localStorage.getItem('role');
    const isSupervisor = userRole === 'supervisor';

    const [day, month, year] = order.date.split('.');
    const rideDateTime = new Date(`${year}-${month}-${day}T${order.time}:00`);
    const now = new Date();

    if (isNaN(rideDateTime.getTime())) {
      console.error('Invalid ride datetime:', order.date, order.time);
      this.toastService.show('שגיאה בזיהוי זמן הנסיעה', 'error');
      return;
    }

    const isFuture = rideDateTime.getTime() > now.getTime();
    const isRebookContext =
      status === 'cancelled_vehicle_unavailable' ||
      status === 'cancelled_vehicle_unavilable';

    if (!isRebookContext) {
      if (!isFuture) {
        this.toastService.show('אפשר לבטל רק הזמנות עתידיות ', 'error');
        return;
      }

      if (!isSupervisor) {
        const isPending = status === 'pending';
        if (!isPending) {
          this.toastService.show(
            'אפשר לבטל רק הזמנות עתידיות במצב "ממתין לאישור" ',
            'error'
          );
          return;
        }

        const timeDifferenceHours =
          (rideDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (timeDifferenceHours <= 2) {
          this.toastService.show(
            'אפשר לבטל הזמנה עד שעתיים לפני זמן הנסיעה ',
            'error'
          );
          return;
        }
      } else {
        const isDeletableStatus = ['pending', 'approved'].includes(status);
        if (!isDeletableStatus) {
          this.toastService.show(
            'אפשר לבטל רק הזמנות במצב "ממתין לאישור" או "אושר" ',
            'error'
          );
          return;
        }

        const timeDifferenceHours =
          (rideDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (timeDifferenceHours <= 2) {
          this.toastService.show(
            'אפשר לבטל הזמנה עד שעתיים לפני זמן הנסיעה ',
            'error'
          );
          return;
        }
      }
    }

    if (!order.ride_id) {
      this.toastService.show('שגיאה בזיהוי הנסיעה', 'error');
      return;
    }
  

    const dialogData: ConfirmDialogData = {
      title: 'ביטול הזמנה',
      message: `  האם את/ה בטוח שברצונך לבטל את הנסיעה?\n\nתאריך: ${order.date}\nשעה: ${order.time}\nסוג: ${order.type}`,
      confirmText: 'בטל הזמנה',
      cancelText: 'חזור',
      noRestoreText: isRebookContext ? '' : 'שימ/י לב שלא ניתן לשחזר את הנסיעה',
      isDestructive: true,
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      height: 'auto',
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.rideService.deleteOrder(order.ride_id).subscribe({
        next: () => {
          this.toastService.show('הנסיעה בוטלה בהצלחה ', 'success');
          this.socketService.deleteRequests$
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => {});
          this.fetchRides();
          const index = this.orders.findIndex(
            (o) => o.ride_id === order.ride_id
          );
          if (index !== -1) {
            this.orders = [
              ...this.orders.slice(0, index),
              ...this.orders.slice(index + 1),
            ];
          }
        },
        error: (error) => {
          console.error('Error deleting order:', error);
          this.toastService.show('שגיאה בביטול הנסיעה ', 'error');
        },
      });
    });
  }

private setupSocketSubscriptions(): void {
  this.socketService.rideRequests$
    .pipe(takeUntil(this.destroy$))
    .subscribe((newRide) => {
      if (newRide) this.fetchRides();
    });

  this.socketService.rideSupposedToStart$
    .pipe(takeUntil(this.destroy$))
    .subscribe(() => {
      this.fetchRides();
    });

  this.socketService.orderUpdated$
    .pipe(takeUntil(this.destroy$))
    .subscribe((updatedRide) => {
      if (!updatedRide) return;
      this.handleOrderUpdate(updatedRide);
    });

  this.socketService.rideStatusUpdated$
    .pipe(takeUntil(this.destroy$))
    .subscribe((updatedStatus) => {
      if (!updatedStatus) return;
      this.handleStatusUpdate(updatedStatus);
    });

  this.socketService.deleteRequests$
    .pipe(takeUntil(this.destroy$))
    .subscribe((deletedRide) => {
      if (deletedRide) this.handleDeletedRide(deletedRide);
    });
}


  private handleOrderUpdate(updatedRide: any): void {
    const index = this.orders.findIndex((o) => o.ride_id === updatedRide.id);
    if (index !== -1) {
      const newDate = formatDate(
        updatedRide.start_datetime,
        'dd.MM.yyyy',
        'en-US'
      );
      const newTime = formatDate(updatedRide.start_datetime, 'HH:mm', 'en-US');
      const newRecent = updatedRide.submitted_at
        ? formatDate(updatedRide.submitted_at, 'dd.MM.yyyy', 'en-US')
        : newDate;
      const updatedOrder = {
        ...this.orders[index],
        recent: newRecent,
        date: newDate,
        time: newTime,
        status: updatedRide.status.toLowerCase(),
        distance: updatedRide.estimated_distance_km,
        start_datetime: updatedRide.start_datetime,
        end_datetime: updatedRide.end_datetime,
        submitted_at: updatedRide.submitted_at,
      };
      this.orders = [
        ...this.orders.slice(0, index),
        updatedOrder,
        ...this.orders.slice(index + 1),
      ];
    }
  }

  private handleStatusUpdate(updatedStatus: any): void {
    const index = this.orders.findIndex(
      (o) => o.ride_id === updatedStatus.ride_id
    );
    if (index !== -1) {
      this.orders[index] = {
        ...this.orders[index],
        status: updatedStatus.new_status,
      };
      this.orders = [...this.orders];
    }
  }

  private handleDeletedRide(deletedRide: any): void {
    const index = this.orders.findIndex((o) => o.ride_id === deletedRide.id);
    if (index !== -1) {
      this.orders = [
        ...this.orders.slice(0, index),
        ...this.orders.slice(index + 1),
      ];
    }
  }

  goBack(): void {
    this.location.back();
  }

  onFilteredOrdersChanged(filtered: any[]): void {
    this.filteredOrders = filtered;
  }

  onViewRide(order: any): void {
    if (!order.ride_id) {
      this.toastService.show('שגיאה בזיהוי הנסיעה', 'error');
      return;
    }

    const dialogRef = this.dialog.open(RideDetailsComponent, {
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'ride-details-modal-panel',
      data: { rideId: order.ride_id },
      autoFocus: false,
      restoreFocus: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.rideStarted) {
        this.fetchRides();
      }
    });
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onEditRide(order: any): void {
    this.editOrder(order);
  }

  onDeleteRide(order: any): void {
    this.deleteOrder(order);
  }

  goToNewRide(): void {
    const token = localStorage.getItem('access_token');

    if (!token) {
      this.router.navigate(['/home']);
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    });

    this.http.get<any>(`${this.apiBase}/user/me`, { headers }).subscribe({
      next: (user) => {
        const hasPendingRebook = user?.has_pending_rebook === true;

        if (hasPendingRebook) {
          const dialogData: ConfirmDialogData = {
            title: 'יש להשלים הזמנה מחדש',
            message:
              'הנסיעה שלך בוטלה בגלל רכב שאינו זמין. לפני יצירת הזמנה חדשה, יש להשלים הזמנה מחדש באמצעות כפתור "הזמן מחדש" במסך "הנסיעות שלי".',
            confirmText: 'עבור להנסיעות שלי',
            cancelText: 'חזור',
            noRestoreText: '',
            isDestructive: false,
          };

          const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: '420px',
            height: 'auto',
            data: dialogData,
          });

          dialogRef.afterClosed().subscribe((confirmed) => {
            if (confirmed) {
              this.router.navigate(['/all-rides'], {
                queryParams: { mode: 'future' },
              });
            }
          });
        } else {
          this.router.navigate(['/home']);
        }
      },
      error: (err: HttpErrorResponse) => {
        console.error('Failed to check hasPendingRebook:', err);
        this.router.navigate(['/home']);
      },
    });
  }

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  fetchRides() {
    const userId = localStorage.getItem('employee_id');
    if (!userId) return;
    this.loading = true;
    const filters: any = {};
    if (this.statusFilter) filters.status = this.statusFilter;
    if (this.startDate) filters.from_date = this.startDate;
    if (this.endDate) filters.to_date = this.endDate;
    if (this.showOldOrders && !this.startDate && !this.endDate) {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      filters.from_date = this.formatDateForInput(oneMonthAgo);
    }

    let fetchFn;
    switch (this.rideViewMode) {
      case 'future':
        fetchFn = this.rideService.getFutureOrders(userId, filters);
        break;
      case 'past':
        fetchFn = this.rideService.getPastOrders(userId, filters);
        break;
      case 'all':
      default:
        fetchFn = this.rideService.getAllOrders(userId, filters);
    }

    fetchFn.subscribe({
      next: (res) => {
        this.loading = false;
        if (Array.isArray(res)) {
          const mappedOrders = res.map((order) => ({
            ride_id: order.ride_id,
            date: formatDate(order.start_datetime, 'dd.MM.yyyy', 'en-US'),
            time: formatDate(order.start_datetime, 'HH:mm', 'en-US'),
            type: order.vehicle,
            distance: order.estimated_distance,
            status: order.status.toLowerCase(),
            start_datetime: order.start_datetime,
            end_datetime: order.end_datetime,
            submitted_at: order.submitted_at,
            user_id: order.user_id,
            cancel_reason:
              order.cancel_reason || order.cancellation_reason || null,
          }));
          this.orders = mappedOrders;

          localStorage.setItem('user_orders', JSON.stringify(this.orders));

          this.rideService.checkStartedApprovedRides().subscribe({
            next: (res: StartedRidesResponse) => {
              const startedRideIds = res.rides_supposed_to_start;
              this.orders = this.orders.map((order) => ({
                ...order,
                hasStarted: startedRideIds.includes(order.ride_id),
              }));
            },
            error: (err) => console.error('Error checking started rides:', err),
          });
        } else {
          this.orders = [];
        }
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        if (err.status === 404) {
          console.warn(
            'Backend returned 404 for orders, treating as no orders found:',
            err
          );
          this.orders = [];
        } else {
          console.error('Error fetching orders:', err);
          this.toastService.show('שגיאה בטעינת ההזמנות ', 'error');
        }
      },
    });
  }

  private parseDate(d: string): Date {
    const [day, month, year] = d.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  }

  onRebookRide(order: any): void {
    if (!order?.ride_id) {
      this.toastService.show('שגיאה בזיהוי הנסיעה לביצוע הזמנה מחדש', 'error');
      return;
    }

    this.rideService.getRebookData(order.ride_id).subscribe({
      next: (data: RebookData) => {
        this.rideService.setRebookData(data);
        this.router.navigate(['/home']);
      },
      error: (err) => {
        console.error('Failed to load rebook data:', err);
        this.toastService.show(
          'שגיאה בטעינת פרטי הנסיעה לביצוע הזמנה מחדש',
          'error'
        );
      },
    });
  }
}
