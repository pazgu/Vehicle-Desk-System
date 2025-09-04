import { Component, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, Params, RouterModule } from '@angular/router';
import { MyRidesService } from '../../services/myrides.service';
import { ToastService } from '../../services/toast.service';
import { SocketService } from '../../services/socket.service';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../components/page-area/confirm-dialog/confirm-dialog.component';
import { HttpErrorResponse } from '@angular/common/http';
import { StartedRide, StartedRidesResponse } from '../../models/ride.model';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule , ButtonModule],
  templateUrl: './all-rides.component.html',
  styleUrls: ['./all-rides.component.css']
})
export class AllRidesComponent implements OnInit {
  
  constructor(
    private router: Router,
    private rideService: MyRidesService,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private socketService: SocketService,
    private location: Location,
    private dialog: MatDialog
  ) {}
  

  goBack(): void {
    this.location.back();
  }

  currentPage = 1;
  loading: boolean = false;

  get ordersPerPage(): number {
    return this.showFilters ? 3 : 5;
  }

  filterBy = 'date';
  statusFilter = '';
  startDate: string = '';
  endDate: string = '';
  showFilters = false;
  showOldOrders = false;

  minDate = '2025-01-01';
  maxDate = new Date(new Date().setMonth(new Date().getMonth() + 2))
    .toISOString()
    .split('T')[0];

  sortBy = 'recent';
  orders: any[] = [];
  rideViewMode: 'all' | 'future' | 'past' = 'all';
  highlightedOrderId: string | null = null;
warningVisible = false;
freeQuotaTotal = 6;
freeQuotaUsed = 0;         

get freeQuotaExceeded(): boolean {
  return this.freeQuotaUsed >= this.freeQuotaTotal;
}


  ngOnInit(): void {
    const userId = localStorage.getItem('employee_id');
 if (this.exceededMaxRides()) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastShownDate = localStorage.getItem('exceededWarningDate');

    if (lastShownDate !== today) {
      // Show warning only if it wasn't shown today
      this.warningVisible = true;
      localStorage.setItem('exceededWarningDate', today);
    }
  }
    this.route.queryParams.subscribe(params => {
      // Restore component state from URL params
      this.rideViewMode = (params['mode'] as 'all' | 'future' | 'past') || 'all';
      this.sortBy = params['sort'] || 'recent';
      this.statusFilter = params['status'] || '';
      this.startDate = params['start_date'] || '';
      this.endDate = params['end_date'] || '';
      this.showFilters = params['filters'] === 'true';
      this.showOldOrders = params['old_orders'] === 'true';

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

      // Fetch rides based on the restored state (from URL or defaults)
      this.fetchRides();
    });

    // Socket listeners (unchanged)
    this.socketService.rideRequests$.subscribe((newRide) => {
      if (newRide) {
        this.fetchRides();
      }
    });
     this.socketService.rideSupposedToStart$.subscribe(() => {
        this.fetchRides();
      
    });

    this.socketService.orderUpdated$.subscribe((updatedRide) => {
      if (!updatedRide) return;
      if (updatedRide) {
        const index = this.orders.findIndex(o => o.ride_id === updatedRide.id);
        if (index !== -1) {
          const newDate = formatDate(updatedRide.start_datetime, 'dd.MM.yyyy', 'en-US');
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
            submitted_at: updatedRide.submitted_at
          };
          this.orders = [
            ...this.orders.slice(0, index),
            updatedOrder,
            ...this.orders.slice(index + 1)
          ];
          this.updateFreeQuota();

          const role = localStorage.getItem('role');
          if (role === 'supervisor') {
            this.toastService.show('✅ יש בקשה שעודכנה בהצלחה', 'success');
          }
        }
      }
    });

    this.socketService.rideStatusUpdated$.subscribe((updatedStatus) => {
      if (!updatedStatus) return;
      if (updatedStatus) {
        const index = this.orders.findIndex(o => o.ride_id === updatedStatus.ride_id);
        if (index !== -1) {
          const newStatus = updatedStatus.new_status;
          const updatedOrders = [...this.orders];
          updatedOrders[index] = {
            ...updatedOrders[index],
            status: newStatus
          };
          this.orders = updatedOrders;
          this.orders = [...this.orders];
          this.updateFreeQuota();

        }
      }
    });

    this.socketService.deleteRequests$.subscribe((deletedRide) => {
      if (deletedRide) {
        const index = this.orders.findIndex(o => o.ride_id === deletedRide.id);
        if (index !== -1) {
          this.orders = [
            ...this.orders.slice(0, index),
            ...this.orders.slice(index + 1)
          ];
        }
      }
    });
    this.updateFreeQuota();

  }

  // --- New / Modified Methods for URL Sync ---

  private formatDateForInput(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  applyFiltersAndSort(): void {
    this.updateUrlQueryParams();
  }

  toggleFiltersVisibility(): void {
    this.showFilters = !this.showFilters;
    this.updateUrlQueryParams();
  }

  private updateFreeQuota(): void {
  // which statuses count as a "used free ride"
  const countableStatuses = new Set([
    'pending',
    'approved',
    'reserved',
    'in_progress',
    'completed'
  ]);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // use the current in-memory orders list to avoid localStorage drift
  const used = this.orders.filter(o => {
    if (!o?.date) return false;
    const d = this.parseDate(o.date);
    d.setHours(12, 0, 0, 0);
    const inMonth = d >= startOfMonth && d <= endOfMonth;
    const counts = countableStatuses.has(String(o.status || '').toLowerCase());
    return inMonth && counts;
  }).length;

  this.freeQuotaUsed = Math.min(used, this.freeQuotaTotal);
}


  // This is the core method to update the URL with current filter states
  private updateUrlQueryParams(): void {
    const queryParams: Params = {
      // Explicitly set parameters to null if they are at their default,
      // so the router removes them from the URL.
      mode: this.rideViewMode === 'all' ? null : this.rideViewMode,
      sort: this.sortBy === 'recent' ? null : this.sortBy,
      status: this.statusFilter === '' ? null : this.statusFilter,
      start_date: this.startDate === '' ? null : this.startDate,
      end_date: this.endDate === '' ? null : this.endDate,
      filters: this.showFilters === false ? null : true, // Only include if true
      old_orders: this.showOldOrders === false ? null : true, // Only include if true
    };

 
    const currentHighlight = this.route.snapshot.queryParamMap.get('highlight');
    if (currentHighlight) {
        queryParams['highlight'] = currentHighlight;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge' 
    });
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
          this.orders = res.map(order => ({
            ride_id: order.ride_id,
            date: formatDate(order.start_datetime, 'dd.MM.yyyy', 'en-US'),
            time: formatDate(order.start_datetime, 'HH:mm', 'en-US'),
            type: order.vehicle,
            distance: order.estimated_distance,
            status: order.status.toLowerCase(),
            start_datetime: order.start_datetime,
            end_datetime: order.end_datetime,
            submitted_at: order.submitted_at,
            user_id: order.user_id
          }));
          localStorage.setItem('user_orders', JSON.stringify(this.orders));
          

        this.rideService.checkStartedApprovedRides().subscribe({
          next: (res: StartedRidesResponse) => {
            const startedRideIds = res.rides_supposed_to_start; 
            this.updateFreeQuota();
            this.orders = this.orders.map(order => ({
              ...order,
              hasStarted: startedRideIds.includes(order.ride_id)
            }));
          },
          error: (err) => {
            console.error('Error checking started rides:', err);
          }
        });

        } else {
          this.orders = [];
        }
      },
    error: (err: HttpErrorResponse) => { 
        this.loading = false;
        if (err.status === 404) {
          console.warn('Backend returned 404 for orders, treating as no orders found:', err);
          this.orders = []; 
        } else {
          console.error('Error fetching orders:', err);
          this.toastService.show('שגיאה בטעינת ההזמנות ❌', 'error');
        }
      }
    });


  }


  get pagedOrders() {
    const start = (this.currentPage - 1) * this.ordersPerPage;
    return this.filteredOrders.slice(start, start + this.ordersPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  get totalPages() {
    return this.filteredOrders.length > 0 ? Math.ceil(this.filteredOrders.length / this.ordersPerPage) : 1;
  }

  getStatusTooltip(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'אושר';
      case 'pending': return 'בהמתנה';
      case 'rejected': return 'נדחה';
      case 'completed': return 'הושלם';
      case 'in_progress': return 'בתהליך';
      case 'cancelled_due_to_no_show': return 'בוטל – אי הגעה';
      case 'reserved': return 'מוזמן';
      default: return 'סטטוס לא ידוע';
    }
  }

  getStatusClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': return 'status-green';
      case 'pending': return 'status-yellow';
      case 'rejected': return 'status-red';
      case 'in_progress': return 'status_in_progress';
      case 'cancelled_due_to_no_show': return 'status-cancelled-no-show';
      case 'reserved': return 'status-reserved';
      default: return '';
    }
  }

  get filteredOrders() {
    const today = new Date();
    today.setHours(0,0,0,0);

    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(today.getMonth() - 1);
    oneMonthAgo.setHours(0,0,0,0);

    let filtered = this.orders;

    switch (this.rideViewMode) {
      case 'future':
        filtered = filtered.filter(order => {
            const orderDate = this.parseDate(order.date);
            return orderDate >= today;
        });
        break;
      case 'past':
        filtered = filtered.filter(order => {
            const orderDate = this.parseDate(order.date);
            return orderDate < today;
        });
        break;
      case 'all':
      default:
        break;
    }

    if (this.statusFilter) {
      filtered = filtered.filter(order => order.status === this.statusFilter);
    }

    if (this.startDate) {
      const start = new Date(this.startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(order => {
        const orderDate = this.parseDate(order.date);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate >= start;
      });
    }
    if (this.endDate) {
        const end = new Date(this.endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(order => {
            const orderDate = this.parseDate(order.date);
            orderDate.setHours(0,0,0,0);
            return orderDate <= end;
        });
    }

    // Apply 'showOldOrders' logic in the client-side filtering (if needed)
    // ONLY apply if startDate and endDate are not already set by the specific date filter
    if (this.showOldOrders && !this.startDate && !this.endDate) {
        filtered = filtered.filter(order => {
            const orderDate = this.parseDate(order.date);
            return orderDate >= oneMonthAgo;
        });
    }


    switch (this.sortBy) {
      case 'status':
        return [...filtered].sort((a, b) => a.status.localeCompare(b.status));
      case 'date':
      default:
        return [...filtered].sort(
          (a, b) => this.parseDate(a.date).getTime() - this.parseDate(b.date).getTime()
        );
      case 'recent':
        return [...filtered].sort((a, b) => {
          const dateA = a.submitted_at ? new Date(a.submitted_at) : this.parseDate(a.date);
          const dateB = b.submitted_at ? new Date(b.submitted_at) : this.parseDate(b.date);
          return dateB.getTime() - dateA.getTime();
        });
    }
  }

  parseDate(d: string): Date {
    const [day, month, year] = d.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(12, 0, 0, 0);
    return date;
  }

  isPastOrder(order: any): boolean {
    const today = new Date();
    today.setHours(0,0,0,0);
    const orderDate = this.parseDate(order.date);
    orderDate.setHours(0,0,0,0);
    return orderDate < today;
  }

  isCompletedOrder(order: any): boolean {
    if (order.status === 'completed') {
      return true;
    }
    return false;
  }

  validateDate(type: 'start' | 'end'): string {
    const value = type === 'start' ? this.startDate : this.endDate;
    if (!this.isDateValid(value)) {
      if (type === 'start') this.startDate = '';
      else this.endDate = '';
      return 'אנא הזן תאריך תקין בין 01.01.2025 ועד היום';
    }
    return '';
  }

  isDateValid(dateStr: string): boolean {
    if (!dateStr) return true;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;

    const min = new Date(this.minDate);
    const max = new Date(this.maxDate);
    date.setHours(0,0,0,0);
    min.setHours(0,0,0,0);
    max.setHours(0,0,0,0);

    return date >= min && date <= max;
  }

  goToNewRide(): void {
    this.router.navigate(['/home']);
  }

  capitalize(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

  canEdit(order: any): boolean {
    const userRole = localStorage.getItem('role');
    const isSupervisor = userRole === 'supervisor';
    
    // For regular users - only pending orders can be edited
    const isPending = order.status.toLowerCase() === 'pending';
    const isFuture = this.parseDate(order.date) >= new Date();
    
    if (!isSupervisor) {
      return isPending && isFuture;
    }
    
    // For supervisors - allow editing approved orders until 2 hours before ride time
    const isEditableStatus = ['pending', 'approved'].includes(order.status.toLowerCase());
    
    if (!isEditableStatus || !isFuture) {
      return false;
    }
    
    // Calculate if it's more than 2 hours before the ride
    const rideDateTime = new Date(`${order.date.split('.').reverse().join('-')}T${order.time}:00`);
    const now = new Date();
    const timeDifferenceHours = (rideDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return timeDifferenceHours > 2;
  }

  canDelete(order: any): boolean {
    const userRole = localStorage.getItem('role');
    const isSupervisor = userRole === 'supervisor';
    
    // For regular users - only pending orders can be deleted
    const isPending = order.status.toLowerCase() === 'pending';
    const isFuture = this.parseDate(order.date) >= new Date();
    
    if (!isSupervisor) {
      return isPending && isFuture;
    }
    
    // For supervisors - allow deleting approved orders until 2 hours before ride time
    const isDeletableStatus = ['pending', 'approved'].includes(order.status.toLowerCase());
    
    if (!isDeletableStatus || !isFuture) {
      return false;
    }
    
    // Calculate if it's more than 2 hours before the ride
    const rideDateTime = new Date(`${order.date.split('.').reverse().join('-')}T${order.time}:00`);
    const now = new Date();
    const timeDifferenceHours = (rideDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    return timeDifferenceHours > 2;
  }

  editOrder(order: any): void {
    const userRole = localStorage.getItem('role');
    const isSupervisor = userRole === 'supervisor';
    const isFuture = this.parseDate(order.date) >= new Date();

    if (!isFuture) {
      this.toastService.show('אפשר לערוך רק הזמנות עתידיות ❌', 'error');
      return;
    }

    // For regular users - only pending status allowed
    if (!isSupervisor) {
      const isPending = order.status.toLowerCase() === 'pending';
      if (!isPending) {
        this.toastService.show('אפשר לערוך רק הזמנות עתידיות במצב "ממתין" ❌', 'error');
        return;
      }
    } else {
      // For supervisors - check if it's within the 2-hour window
      const isEditableStatus = ['pending', 'approved'].includes(order.status.toLowerCase());
      if (!isEditableStatus) {
        this.toastService.show('אפשר לערוך רק הזמנות במצב "ממתין" או "מאושר" ❌', 'error');
        return;
      }

      const rideDateTime = new Date(`${order.date.split('.').reverse().join('-')}T${order.time}:00`);
      const now = new Date();
      const timeDifferenceHours = (rideDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (timeDifferenceHours <= 2) {
        this.toastService.show('אפשר לערוך הזמנה עד שעתיים לפני זמן הנסיעה ❌', 'error');
        return;
      }
    }

    if (!order.ride_id) {
      this.toastService.show('שגיאה בזיהוי ההזמנה', 'error');
      return;
    }

    this.router.navigate(['/ride/edit', order.ride_id]);
  }

  deleteOrder(order: any): void {
    const userRole = localStorage.getItem('role');
    const isSupervisor = userRole === 'supervisor';
    const isFuture = this.parseDate(order.date) >= new Date();

    if (!isFuture) {
      this.toastService.show('אפשר לבטל רק הזמנות עתידיות ❌', 'error');
      return;
    }

    // For regular users - only pending status allowed
    if (!isSupervisor) {
      const isPending = order.status.toLowerCase() === 'pending';
      if (!isPending) {
        this.toastService.show('אפשר לבטל רק הזמנות עתידיות במצב "ממתין" ❌', 'error');
        return;
      }
    } else {
      // For supervisors - check if it's within the 2-hour window
      const isDeletableStatus = ['pending', 'approved'].includes(order.status.toLowerCase());
      if (!isDeletableStatus) {
        this.toastService.show('אפשר לבטל רק הזמנות במצב "ממתין" או "מאושר" ❌', 'error');
        return;
      }

      const rideDateTime = new Date(`${order.date.split('.').reverse().join('-')}T${order.time}:00`);
      const now = new Date();
      const timeDifferenceHours = (rideDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (timeDifferenceHours <= 2) {
        this.toastService.show('אפשר לבטל הזמנה עד שעתיים לפני זמן הנסיעה ❌', 'error');
        return;
      }
    }

    if (!order.ride_id) {
      this.toastService.show('שגיאה בזיהוי ההזמנה', 'error');
      return;
    }

    // Create proper dialog data
    const dialogData: ConfirmDialogData = {
      title: 'ביטול הזמנה',
      message: `?האם אתה בטוח שברצונך לבטל את ההזמנה\n\nתאריך: ${order.date}\nשעה: ${order.time}\nסוג: ${order.type}`,
      confirmText: 'בטל הזמנה',
      cancelText: 'חזור',
      noRestoreText: 'שימ/י לב שלא ניתן לשחזר את הנסיעה',
      isDestructive: true
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      height: 'auto',
      data: dialogData
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.rideService.deleteOrder(order.ride_id).subscribe({
        next: () => {
          this.toastService.show('ההזמנה בוטלה בהצלחה ✅', 'success');
          this.socketService.deleteRequests$.subscribe((deletedRide) => {
         
          });
          // Remove the order from local state immediately
          this.fetchRides();
          const index = this.orders.findIndex(o => o.ride_id === order.ride_id);
          if (index !== -1) {
            this.orders = [
              ...this.orders.slice(0, index),
              ...this.orders.slice(index + 1)
            ];
          }
          // Also refresh from server to ensure consistency
        },
        error: (error) => {
          console.error('Error deleting order:', error);
          this.toastService.show('שגיאה בביטול ההזמנה ❌', 'error');
        }
      });
    });
  }

  get quotaSegments(): number[] {
  return Array.from({ length: this.freeQuotaTotal }, (_, i) => i);
}


  viewRide(order: any): void {
    if (!order.ride_id) {
      this.toastService.show('שגיאה בזיהוי ההזמנה', 'error');
      return;
    }

    this.router.navigate(['/ride/details', order.ride_id]);
  }

checkIfOverOneDay(order: any): boolean {
  const orderStartDate = new Date(order.start_datetime);
  const orderEndDate = new Date(order.end_datetime);

  console.log('Order Start Date:', orderStartDate);
  console.log('Order End Date:', orderEndDate);

  // Extract only the date part (ignoring time)
  const startDay = orderStartDate.toISOString().split('T')[0];
  const endDay = orderEndDate.toISOString().split('T')[0];

  return startDay !== endDay;
}

  exceededMaxRides(): boolean {
    const maxRides = 6;
    const userOrders = JSON.parse(localStorage.getItem('user_orders') || '[]');

    const beginningOfMonth = new Date();
    beginningOfMonth.setDate(1);
    beginningOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    const recentOrders = userOrders.filter((order: any) => {
      const orderDate = this.parseDate(order.date);
      return orderDate >= beginningOfMonth && orderDate <= endOfMonth;
    });

    return recentOrders.length >= maxRides;
  }

  hideWarning() {
    this.warningVisible = false;
  }

  showWarning() {
    this.warningVisible = true;
  }

  exceededMaxRidesForOrder(currentOrder: any): boolean {
    const maxRides = 6;
    const userOrders = JSON.parse(localStorage.getItem('user_orders') || '[]');

    const beginningOfMonth = new Date();
    beginningOfMonth.setDate(1);
    beginningOfMonth.setHours(0, 0, 0, 0);

    const currentOrderDate = this.parseDate(currentOrder.date);

    const priorOrdersThisMonth = userOrders.filter((order: any) => {
      const orderDate = this.parseDate(order.date);
      return orderDate >= beginningOfMonth && orderDate < currentOrderDate;
    });

    return priorOrdersThisMonth.length >= maxRides;
  }

  exceededMaxRidesForThisOrder(currentOrder: any): boolean {
    const maxRides = 6;
    const userOrders = JSON.parse(localStorage.getItem('user_orders') || '[]');

    const beginningOfMonth = new Date();
    beginningOfMonth.setDate(1);
    beginningOfMonth.setHours(0, 0, 0, 0);

    const currentOrderDate = this.parseDate(currentOrder.date);

    const priorOrdersThisMonth = userOrders.filter((order: any) => {
      const orderDate = this.parseDate(order.date);
      return orderDate >= beginningOfMonth && orderDate < currentOrderDate;
    });

    return priorOrdersThisMonth.length >= maxRides;
  }

  isPaidOrder(order: any): boolean {
    const maxFreeRides = 6;
    const userOrders = JSON.parse(localStorage.getItem('user_orders') || '[]');

    const beginningOfMonth = new Date();
    beginningOfMonth.setDate(1);
    beginningOfMonth.setHours(0, 0, 0, 0);

    const orderDate = this.parseDate(order.date);

    if (orderDate.getMonth() === beginningOfMonth.getMonth() &&
      orderDate.getFullYear() === beginningOfMonth.getFullYear()) {

      const priorOrdersThisMonth = userOrders.filter((o: any) => {
        const oDate = this.parseDate(o.date);
        return oDate.getMonth() === beginningOfMonth.getMonth() &&
          oDate.getFullYear() === beginningOfMonth.getFullYear() &&
          oDate < orderDate;
      }).length;

      return priorOrdersThisMonth >= maxFreeRides;
    }
    return false;
  }
}
