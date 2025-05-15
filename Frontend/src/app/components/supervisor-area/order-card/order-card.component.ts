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
  departmentId: string | null = null; // Retrieve from localStorage
  loading = false;
  rideId!: string;


  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    // Retrieve departmentId from localStorage
    this.departmentId = localStorage.getItem('department_id');
    if (!this.departmentId) {
      console.error('Department ID not found in localStorage.');
      return;
    }
    this.rideId = this.route.snapshot.paramMap.get('ride_id')!;
    console.log('Extracted ride_id:', this.rideId);

    // Listen for route params
    this.route.params.subscribe((params) => {
      const orderIdParam = params['orderId'] || this.rideId;

      if (orderIdParam) {
        this.rideId = orderIdParam;
        this.loadOrder(this.departmentId!, this.rideId); // Use departmentId from localStorage
      } else {
        console.error('Missing orderId');
      }
    });
  }

  loadOrder(departmentId: string, orderId: string): void {
    this.loading = true;
    this.orderService.getDepartmentSpecificOrder(departmentId, this.rideId)
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
    const [date, time] = dateTime.split(' ');
    return `${date} בשעה ${time}`;
  }

  updateStatus(status: string): void {
    if (!this.trip) return;
    this.loading = true;

    this.orderService.updateOrderStatus(this.departmentId!, this.rideId, status)
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Order status updated successfully:', response);
          setTimeout(() => {
            this.loadOrder(this.departmentId!, this.rideId);
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