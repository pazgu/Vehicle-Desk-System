// order-card.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { OrderService } from '../../../services/order.service';
import { OrderCardItem } from '../../../models/order-card-item/order-card-item.module';
import { RideDashboardItem } from '../../../models/ride-dashboard-item/ride-dashboard-item.module';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    TagModule,
    DividerModule,
    ProgressSpinnerModule
  ],
  templateUrl: './order-card.component.html',
  styleUrls: ['./order-card.component.css']
})
export class OrderCardComponent implements OnInit {
  trip: any = null;
  order: OrderCardItem | null = null;
  departmentId = "912a25b9-08e7-4461-b1a3-80e66e79d29e";
  orderId = "bd2f024e-d123-48b5-a6d0-242e594706f6";
  loading = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    // Listen for route params
    this.route.params.subscribe((params) => {
      // Override default values if provided in the route
      const deptId = params['departmentId'] || this.departmentId;
      const orderIdParam = params['orderId'] || this.orderId;
      
      if (deptId && orderIdParam) {
        this.departmentId = deptId;
        this.orderId = orderIdParam;
        this.loadOrder(this.departmentId, this.orderId);
      } else {
        console.error('Missing departmentId or orderId');
      }
    });
  }

  loadOrder(departmentId: string, orderId: string): void {
    this.loading = true;
    this.orderService.getDepartmentSpecificOrder(departmentId, orderId)
      .pipe(
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (response) => {
          // Map the backend response to the frontend model
          this.trip = {
            id: response.id,
            userId: response.user_id,
            vehicleId: response.vehicle_id,
            tripType: response.ride_type,
            startDateTime: response.start_datetime,
            endDateTime: response.end_datetime,
            startLocation: response.start_location,
            stop: response.stop,
            destination: response.destination,
            estimatedDistanceKm: response.estimated_distance_km,
            actualDistanceKm: response.actual_distance_km,
            status: response.status,
            licenseCheckPassed: response.license_check_passed,
            submittedAt: response.submitted_at,
            emergencyEvent: response.emergency_event,
          };
          console.log("Order loaded with ID:", this.trip.id);
        },
        error: (error) => {
          console.error('Error loading order:', error);
        }
      });
  }

  formatDateTime(dateTime: string): string {
    // You can format the date and time as needed
    // Here's a simple formatting example
    const [date, time] = dateTime.split(' ');
    return `${date} בשעה ${time}`;
  }

 updateStatus(status: string): void {
    if (!this.trip) return;
    this.loading = true;

    this.orderService.updateOrderStatus(this.departmentId, this.orderId, status)
        .pipe(
            finalize(() => {
                this.loading = false;
            })
        )
        .subscribe({
            next: (response) => {
                console.log('Order status updated successfully:', response);
                setTimeout(() => {
                    this.loadOrder(this.departmentId, this.orderId);
                }, 500);
            },
            error: (error) => {
                console.error('Error updating order status:', error);
                alert(`Failed to update status: ${error.error?.detail || error.message}`);
            }
        });
}

  goBack(): void {
    this.router.navigate(['/supervisor-dashboard']);
  }

  getCardClass(status: string | null | undefined): string {
    if (!status) return '';
    
    switch (status.toLowerCase()) {
      case 'approved':
        return 'card-approved';
      case 'pending':
        return 'card-pending';
      case 'rejected':
        return 'card-rejected';
      default:
        return '';
    }
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
      default:
        return status;
    }
  }
}