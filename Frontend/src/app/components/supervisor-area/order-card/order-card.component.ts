import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { OrderService } from '../../../services/order.service';
import { OrderCardItem } from '../../../models/order-card-item.module';
import { finalize } from 'rxjs/operators';
import { CityService } from '../../../services/city.service';
import { ToastService } from '../../../services/toast.service';
import { HttpClient } from '@angular/common/http';
import { VehicleService } from '../../../services/vehicle.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [
    CommonModule,
    CardModule,
    ButtonModule,
    TagModule,
    DividerModule,
    ProgressSpinnerModule,
  ],
  templateUrl: './order-card.component.html',
  styleUrls: ['./order-card.component.css'],
})
export class OrderCardComponent implements OnInit {
  trip: any = null;
  order: OrderCardItem | null = null;
  departmentId: string | null = null;
  loading = false;
  rideId!: string;
  cityMap: { [id: string]: string } = {};
  users: { id: string; user_name: string }[] = [];
  vehicles: { id: string; vehicle_model: string; plate_number: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private cityService: CityService,
    private toastService: ToastService,
    private http: HttpClient,
    private vehicleService: VehicleService,
    private location: Location
  ) {}

  ngOnInit(): void {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
    this.departmentId = localStorage.getItem('department_id');
    if (!this.departmentId) {
      this.toastService.show('מחלקה לא נמצאה', 'error');
      return;
    }
    this.rideId = this.route.snapshot.paramMap.get('ride_id')!;

    this.route.params.subscribe((params) => {
      const orderIdParam = params['orderId'] || this.rideId;

      if (orderIdParam) {
        this.rideId = orderIdParam;
        this.loadOrder(this.departmentId!, this.rideId);
      } else {
        this.toastService.show('Missing orderId', 'error');
      }
    });
    this.cityService.getCities().subscribe({
      next: (cities) => {
        this.cityMap = cities.reduce((map: { [id: string]: string }, city) => {
          map[city.id] = city.name;
          return map;
        }, {});
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת ערים', 'error');
      },
    });
    this.fetchUsers();
    this.fetchVehicles();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  getCityName(id: string): string {
    return this.cityMap[id] || 'לא ידוע';
  }

  loadOrder(departmentId: string, orderId: string): void {
    this.loading = true;
    this.orderService
      .getDepartmentSpecificOrder(departmentId, this.rideId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (response) => {
          this.trip = {
            id: response.id,
            userId: response.user_id,
            vehicleId: response.vehicle_id,
            tripType: response.ride_type,
            startDateTime: response.start_datetime,
            endDateTime: response.end_datetime,
            startLocation: response.start_location,
            stop: response.stop,
            extraStops: response.extra_stops || [],
            destination: response.destination,
            estimatedDistanceKm: response.estimated_distance_km,
            actualDistanceKm: response.actual_distance_km,
            status: response.status,
            licenseCheckPassed: response.license_check_passed,
            submittedAt: response.submitted_at,
            emergencyEvent: response.emergency_event,
            four_by_four_reason: response.four_by_four_reason ?? null,
            extended_ride_reason: response.extended_ride_reason ?? null,
          };
        },
        error: (error) => {
          this.toastService.show('שגיאה בטעינת הזמנה', 'error');
        },
      });
  }

  updateStatus(status: string): void {
    if (!this.trip) return;
    this.loading = true;

    this.orderService
      .updateOrderStatus(this.departmentId!, this.rideId, status)
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (response) => {
          this.toastService.show(`סטטוס עודכן בהצלחה`, 'success');
          setTimeout(() => {
            this.loadOrder(this.departmentId!, this.rideId);
          }, 500);
          this.router.navigate(['/supervisor-dashboard']);
        },
        error: (error) => {
          this.toastService.show('שגיאה בעדכון הסטטוס', 'error');
        },
      });
  }

  goBack(): void {
    this.location.back();
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
      case 'completed':
        return 'card-completed';
      case 'cancelled_vehicle_unavailable':
        return 'card-cancelled-vehicle-unavailable';
      case 'cancelled_due_to_no_show':
        return 'card-cancelled-due-to-no-show';
      case 'in_progress':
        return 'card-in-progress';
      default:
        return '';
    }
  }

  translateStatus(status: string | null | undefined): string {
    if (!status) return '';

    switch (status.toLowerCase()) {
      case 'approved':
        return 'אושר';
      case 'pending':
        return 'ממתין לאישור';
      case 'rejected':
        return 'נדחה';
      case 'in_progress':
        return 'בנסיעה';
      case 'completed':
        return 'בוצע';
      case 'cancelled_vehicle_unavailable':
        return 'בוטל - רכב לא זמין';
      case 'cancelled_due_to_no_show':
        return 'בוטל עקב אי-הגעה';
      default:
        return status;
    }
  }

  hasTripPassed(): boolean {
    if (!this.trip || !this.trip.startDateTime) return false;

    const tripStart = new Date(this.trip.startDateTime);
    const now = new Date();

    return tripStart < now;
  }

  fetchUsers(): void {
    this.http.get<any>('http://localhost:8000/api/users').subscribe({
      next: (data) => {
        const usersArr = Array.isArray(data.users) ? data.users : [];
        this.users = usersArr.map((user: any) => ({
          id: user.employee_id,
          user_name: user.username,
        }));
      },
      error: (err: any) => {
        this.toastService.show('שגיאה בטעינת רשימת משתמשים', 'error');
        this.users = [];
      },
    });
  }
  getUserNameById(id: string): string {
    if (!Array.isArray(this.users)) return id;
    const user = this.users.find((u) => u.id === id);
    return user ? `${user.user_name}` : id;
  }

  fetchVehicles(): void {
    this.vehicleService.getAllVehicles().subscribe(
      (data) => {
        this.vehicles = Array.isArray(data)
          ? data.map((vehicle) => ({
              ...vehicle,
            }))
          : [];
      },
      (error) => {
        this.toastService.show('שגיאה בטעינת רכבים', 'error');
      }
    );
  }

  getVehicleById(
    vehicleId: string
  ): { vehicle_model: string; plate_number: string } | undefined {
    return this.vehicles.find((vehicle) => vehicle.id === vehicleId);
  }
  getVehicleModel(vehicleId: string): string {
    const vehicle = this.getVehicleById(vehicleId);
    return vehicle ? `${vehicle.vehicle_model}` : 'לא זמין';
  }
  getPlateNumber(vehicleId: string): string {
    const vehicle = this.getVehicleById(vehicleId);
    return vehicle ? `${vehicle.plate_number}` : 'לא זמין';
  }

  translateRideType(rideType: string | null | undefined): string {
    if (!rideType) return '';
    switch (rideType.toLowerCase()) {
      case 'administrative':
        return 'מנהלתית';
      case 'operational':
        return 'מבצעית';
      default:
        return rideType;
    }
  }

  ceil(value: number): number {
    return Math.ceil(value);
  }

  getFormattedStops(
    firstStopId: string,
    extraStopsRaw: string[] | null
  ): string {
    let extraStopIds: string[] = [];

    if (Array.isArray(extraStopsRaw)) {
      extraStopIds = extraStopsRaw;
    }

    const allStops = [firstStopId, ...extraStopIds];

    return allStops
      .filter(Boolean)
      .map((id) => this.getCityName(id))
      .join(' ← ');
  }
}
