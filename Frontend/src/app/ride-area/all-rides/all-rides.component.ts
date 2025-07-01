import { Component, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MyRidesService } from '../../services/myrides.service';
import { ActivatedRoute, Params } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { SocketService } from '../../services/socket.service';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './all-rides.component.html',
  styleUrls: ['./all-rides.component.css']
})
export class AllRidesComponent implements OnInit {
  constructor(private router: Router,
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


ngOnInit(): void {
    const storedOrders = localStorage.getItem('user_orders');
     const userId = localStorage.getItem('employee_id');
 
     this.route.queryParams.subscribe(params => {
      const idToHighlight = params['highlight'] || null;
      if (idToHighlight) {
        setTimeout(() => {
          this.highlightedOrderId = idToHighlight;
          setTimeout(() => {
            this.highlightedOrderId = null;
          }, 10000); // duration matches CSS animation
        }, 500); // allow DOM to render
      }
    });

    this.fetchRides();

    this.socketService.rideRequests$.subscribe((newRide) => {
  if (newRide) {
    console.log('🔁 New ride event received - refreshing rides...');
    this.fetchRides();
  }

  
});

this.socketService.orderUpdated$.subscribe((updatedRide) => {
  console.log('🔔 Subscription triggered with:', updatedRide); // Add this line
  if (!updatedRide) return; // ignore the initial null emission
  if (updatedRide) {
    console.log('✏️ Ride update received in HomeComponent:', updatedRide);

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
        submitted_at: updatedRide.submitted_at
      };

      // 👈 **replace array with a new one**
      this.orders = [
        ...this.orders.slice(0, index),
        updatedOrder,
        ...this.orders.slice(index + 1)
      ];

      console.log(`✅ Ride ${updatedRide.id} updated in local state`);
      const role=localStorage.getItem('role');
      if(role==='supervisor'){
      this.toastService.show('✅ יש בקשה שעודכנה בהצלחה','success')
      }
    }
  }
});
this.socketService.rideStatusUpdated$.subscribe((updatedStatus) => {
  console.log('🔔 Subscription triggered with:', updatedStatus); // Add this line
  if (!updatedStatus) return; // ignore the initial null emission
  if (updatedStatus) {
    console.log('✏️ Ride  status update received in HomeComponent:', updatedStatus);

    const index = this.orders.findIndex(o => o.ride_id === updatedStatus.ride_id);
    if (index !== -1) {
      const newStatus=updatedStatus.new_status

         const updatedOrders = [...this.orders];
    updatedOrders[index] = {
      ...updatedOrders[index],
      status: newStatus  
    };

    // ✅ Replace the array
    this.orders = updatedOrders;
    this.orders = [...this.orders]
      
      const role=localStorage.getItem('role');
      if(role==='supervisor' || role ==='employee'){
      this.toastService.show(' יש בקשה שעברה סטטוס','success')
      }
    }
  }
});
this.socketService.deleteRequests$.subscribe((deletedRide) => {
  if(deletedRide){ console.log('❌ deleteRequest$ triggered:', deletedRide);

  const index = this.orders.findIndex(o => o.ride_id === deletedRide.id);
  if (index !== -1) {
    this.orders = [

      
      ...this.orders.slice(0, index),
      ...this.orders.slice(index + 1)
    ];
  }}
 
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
    default: return 'סטטוס לא ידוע';
  }
}


 getStatusClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'approved': return 'status-green';
    case 'pending': return 'status-yellow';
    case 'rejected': return 'status-red';
    case 'in_progress': return 'status_in_progress';
    default: return '';
  }
}


  get filteredOrders() {
    const today = new Date();
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(today.getMonth() - 1);

    let filtered = this.orders

    switch (this.rideViewMode) {
      case 'future':
        filtered = filtered.filter(order => this.parseDate(order.date) >= today);
        break;
      case 'past':
        filtered = filtered.filter(order => this.parseDate(order.date) < today);
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
      start.setHours(0, 0, 0, 0); // normalize time
      filtered = filtered.filter(order => {
        const orderDate = this.parseDate(order.date);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate >= start;
      });
    }

     // Sorting
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
        })
    }
  }

  
  parseDate(d: string): Date {
    const [day, month, year] = d.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(12, 0, 0, 0); // set to midday to avoid timezone shift issues
    return date;
  }

  
  isPastOrder(order: any): boolean {
    const today = new Date();
    const orderDate = this.parseDate(order.date);
    return orderDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }
   isCompletedOrder(order: any): boolean {
    if(order.status==='completed') {
      return true
    }
    return false
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
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;

    const min = new Date(this.minDate);
    const max = new Date(this.maxDate);
    return date >= min && date <= max;
  }

  goToNewRide(): void {
    this.router.navigate(['/home']);
  }

  fetchRides() {
    const userId = localStorage.getItem('employee_id');
    if (!userId) return;

    this.loading = true;
    const filters: any = {};
    if (this.statusFilter) filters.status = this.statusFilter;
    if (this.startDate) filters.from_date = this.startDate;
    if (this.endDate) filters.to_date = this.endDate;

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
        console.log('🧾 Raw response from backend:', res);
        console.log('✅ fetchRides called');
        console.log('🚦 View Mode:', this.rideViewMode);
        console.log('📤 Filters:', filters);

        if (Array.isArray(res)) {
          this.orders = res.map(order => ({
            ride_id: order.ride_id,
            date: formatDate(order.start_datetime, 'dd.MM.yyyy', 'en-US'),
            time: formatDate(order.start_datetime, 'HH:mm', 'en-US'),
            type: order.vehicle,
            distance: order.estimated_distance,
            status: order.status.toLowerCase(), // ✅ force lowercase here
            start_datetime: order.start_datetime,       // ✅ Ensure it's passed to `canEdit`
            submitted_at: order.submitted_at,           // ✅ Same
            user_id: order.user_id      
          }));
          localStorage.setItem('user_orders', JSON.stringify(this.orders));
          console.log('Orders from backend:', this.orders);
        } else {
          this.orders = [];
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error fetching orders:', err);
      }
    });
  }

  capitalize(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  }

canEdit(order: any): boolean {
  const isPending = order.status.toLowerCase() === 'pending';
  const isFuture = this.parseDate(order.date) >= new Date();

  return isPending && isFuture;
}

canDelete(order: any): boolean {
const isPending = ['pending'].includes(order.status.toLowerCase());
  const isFuture = this.parseDate(order.date) >= new Date();

  return isPending && isFuture;
}


editOrder(order: any): void {
  const isPending = order.status.toLowerCase() === 'pending';
  const isFuture = this.parseDate(order.date) >= new Date();

  if (!isPending || !isFuture) {
    this.toastService.show('אפשר לערוך רק הזמנות עתידיות במצב "ממתין" ❌', 'error');
    return;
  }

  if (!order.ride_id) {
    this.toastService.show('שגיאה בזיהוי ההזמנה', 'error');
    return;
  }

  this.router.navigate(['/ride/edit', order.ride_id]);
}


// deleteOrder(order: any): void {
//   const isPending = order.status.toLowerCase() === 'pending';
//   const isFuture = this.parseDate(order.date) >= new Date();

//   if (!isPending || !isFuture) {
//     this.toastService.show('אפשר לבטל רק הזמנות עתידיות במצב "ממתין" ❌', 'error');
//     return;
//   }

//   if (!order.ride_id) {
//     this.toastService.show('שגיאה בזיהוי ההזמנה', 'error');
//     return;
//   }

//   // Confirmation popup
//   const confirmed = window.confirm('האם אתה בטוח שברצונך למחוק הזמנה זו לצמיתות?');
//   if (!confirmed) return;

//   this.rideService.deleteOrder(order.ride_id).subscribe({
//     next: () => {
//       this.toastService.show('ההזמנה בוטלה בהצלחה ✅', 'success');
//       this.socketService.deleteRequests$.subscribe((deletedRide) => {
//         if (deletedRide) {
//           console.log('a ride has been deleted via socket:', deletedRide);
//           this.fetchRides();
//         }
//       });
//     },
//     error: () => {
//       this.toastService.show('שגיאה בביטול ההזמנה ❌', 'error');
//     }
//   });
// }


deleteOrder(order: any): void {
  const isPending = order.status.toLowerCase() === 'pending';
  const isFuture = this.parseDate(order.date) >= new Date();

  if (!isPending || !isFuture) {
    this.toastService.show('אפשר לבטל רק הזמנות עתידיות במצב "ממתין" ❌', 'error');
    return;
  }

  if (!order.ride_id) {
    this.toastService.show('שגיאה בזיהוי ההזמנה', 'error');
    return;
  }

  const dialogRef = this.dialog.open(ConfirmDialogComponent);

  dialogRef.afterClosed().subscribe(confirmed => {
    if (!confirmed) return;

    this.rideService.deleteOrder(order.ride_id).subscribe({
      next: () => {
        this.toastService.show('ההזמנה בוטלה בהצלחה ✅', 'success');
        this.socketService.deleteRequests$.subscribe((deletedRide) => {
          if (deletedRide) {
            console.log('a ride has been deleted via socket:', deletedRide);
            this.fetchRides();
          }
        });
      },
      error: () => {
        this.toastService.show('שגיאה בביטול ההזמנה ❌', 'error');
      }
    });
  });
}


viewRide(order: any): void {
  if (!order.ride_id) {
    this.toastService.show('שגיאה בזיהוי ההזמנה', 'error');
    return;
  }

  this.router.navigate(['/ride/details', order.ride_id]);
}

goToArchivedOrders() {
  this.router.navigate(['/archived-orders']);
}
warningVisible = true;  // controls visibility
exceededMaxRides(): boolean {
  const maxRides = 6;
  const userOrders = JSON.parse(localStorage.getItem('user_orders') || '[]');
  
  const beginningOfMonth = new Date();
  beginningOfMonth.setDate(1);
  beginningOfMonth.setHours(0, 0, 0, 0);
  
  const endOfMonth = new Date();
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0); // Last day of current month
  endOfMonth.setHours(23, 59, 59, 999);

  const recentOrders = userOrders.filter((order: any) => {
    const orderDate = this.parseDate(order.date);
    return orderDate >= beginningOfMonth && orderDate <= endOfMonth;
  });

  console.log('🗓️ Recent orders in the current month:', recentOrders);
  return recentOrders.length >= maxRides;
}


// In your component class:
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
  const beginningOfMonthStr = beginningOfMonth.toLocaleDateString('en-GB').replace(/\//g, '.');

  const priorOrdersThisMonth = userOrders.filter((order: any) => {
    return order.date >= beginningOfMonthStr && order.date < currentOrder.date;
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
  
  // Only apply paid logic to orders in current month
  if (orderDate.getMonth() === beginningOfMonth.getMonth() && 
      orderDate.getFullYear() === beginningOfMonth.getFullYear()) {
    
    // Count orders in current month that came BEFORE this order
    const priorOrdersThisMonth = userOrders.filter((o: any) => {
      const oDate = this.parseDate(o.date);
      return oDate.getMonth() === beginningOfMonth.getMonth() && 
             oDate.getFullYear() === beginningOfMonth.getFullYear() &&
             oDate < orderDate;
    }).length;
    
    return priorOrdersThisMonth >= maxFreeRides;
  }
  
  return false; // Orders in other months are free
}
}
