// order-card.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';


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

  
  // Mock data similar to the one in your dashboard component
  trips=  [
    {
      id: 1,
      userId: 'user-101',
      vehicleId: 1,
      tripType: 'אישי',
      startDateTime: '2025-05-07 08:00',
      endDateTime: '2025-05-07 09:30',
      stop: 'מחלף השלום',
      destination: 'תל אביב',
      estimatedDistanceKm: 12,
      actualDistanceKm: 10,
      status: 'הושלם',
      licenseCheckPassed: true,
      submittedAt: '7 במאי 2025, 10:00'
    },
    {
      id: 2,
      userId: 'user-102',
      vehicleId: 2,
      tripType: 'עסקי',
      startDateTime: '2025-05-07 11:00',
      endDateTime: '2025-05-07 12:45',
      stop: 'תחנת דלק מודיעין',
      destination: 'ירושלים',
      estimatedDistanceKm: 75,
      actualDistanceKm: 70,
      status: 'ממתין',
      licenseCheckPassed: true,
      submittedAt: '7 במאי 2025, 13:00'
    },
    {
      id: 3,
      userId: 'user-103',
      vehicleId: 3,
      tripType: 'אישי',
      startDateTime: '2025-05-08 08:30',
      endDateTime: '2025-05-08 10:15',
      stop: 'תחנת רכבת חדרה',
      destination: 'חיפה',
      estimatedDistanceKm: 95,
      actualDistanceKm: 90,
      status: 'בדרך',
      licenseCheckPassed: false,
      submittedAt: '8 במאי 2025, 10:20'
    },
    {
      id: 4,
      userId: 'user-104',
      vehicleId: 4,
      tripType: 'עסקי',
      startDateTime: '2025-05-08 13:00',
      endDateTime: '2025-05-08 14:45',
      stop: 'צומת להבים',
      destination: 'באר שבע',
      estimatedDistanceKm: 115,
      actualDistanceKm: 110,
      status: 'הושלם',
      licenseCheckPassed: true,
      submittedAt: '8 במאי 2025, 15:00'
    },
    {
      id: 5,
      userId: 'user-105',
      vehicleId: 5,
      tripType: 'אישי',
      startDateTime: '2025-05-09 07:30',
      endDateTime: '2025-05-09 08:45',
      stop: 'מחלף פולג',
      destination: 'נתניה',
      estimatedDistanceKm: 35,
      actualDistanceKm: 30,
      status: 'ממתין',
      licenseCheckPassed: true,
      submittedAt: '9 במאי 2025, 09:00'
    }
  ];
  

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Get the trip ID from the route parameter
    this.route.params.subscribe(params => {
      const tripId = +params['id']; // Convert to number
      
      // Simulate loading data
      setTimeout(() => {
        // Find the trip in the mock data
        this.trip = this.trips.find(t => t.id === tripId) || null;
        
        // If trip not found, could redirect to 404 or back to dashboard
        if (!this.trip) {
          console.error('Trip not found with ID:', tripId);
          this.router.navigate(['/supervisor-dashboard']);
          alert('Trip not found! Redirecting to dashboard.');
        }
      }, 500); // Simulate network delay
    });
  }

  formatDateTime(dateTime: string): string {
    // You can format the date and time as needed
    // Here's a simple formatting example
    const [date, time] = dateTime.split(' ');
    return `${date} בשעה ${time}`;
  }

  getStatusSeverity(status: string): string {
    switch (status) {
      case 'הושלם':
        return 'success';
      case 'בדרך':
        return 'info';
      case 'ממתין':
        return 'warning';
      default:
        return 'secondary';
    }
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
}