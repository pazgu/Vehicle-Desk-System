// order-card.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule, LowerCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { OrderService } from '../../../services/order.service';
import { OrderCardItem } from '../../../models/order-card-item/order-card-item.module';
import { RideDashboardItem } from '../../../models/ride-dashboard-item/ride-dashboard-item.module';

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

constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    // Fetch departmentId and orderId
    const departmentId = "912a25b9-08e7-4461-b1a3-80e66e79d29e"
    this.route.params.subscribe((params) => {
      const orderId = "bd2f024e-d123-48b5-a6d0-242e594706f6"

      if (departmentId && orderId) {
        this.loadOrder(departmentId, orderId);
      } else {
        console.error('Missing departmentId or orderId');
      }
    });
  }

  loadOrder(departmentId: string, orderId: string): void {
    this.orderService.getDepartmentSpecificOrder(departmentId, orderId).subscribe(
      (response) => {

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
        console.log("iddddd: ", this.trip.id);
      },
      (error) => {
        console.error('Error loading order:', error);
      }
    );
  }


  formatDateTime(dateTime: string): string {
    // You can format the date and time as needed
    // Here's a simple formatting example
    const [date, time] = dateTime.split(' ');
    return `${date} בשעה ${time}`;
  }

  approveTrip() {
    this.trip.status = 'Approved';
    // Add logic to update the status in the backend
    console.log(`Trip ${this.trip.id} approved.`);
  }

  rejectTrip() {
    this.trip.status = 'Rejected';
    // Add logic to update the status in the backend
    console.log(`Trip ${this.trip.id} rejected.`);
  }

  goBack(): void {
    this.router.navigate(['/supervisor-dashboard']);
  }

  getCardClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'approved': // Approved
        return 'card-approved';
      case 'pending': // Pending
        return 'card-pending';
      case 'rejected': // Rejected
        return 'card-rejected';
      default:
        return '';
    }
  }

  translateStatus(status: string): string {
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