import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../services/toast.service';
import { RideReportService } from '../../../services/completion-form.service';
import { Location } from '@angular/common';
import { RideService } from '../../../services/ride.service';
import { RideLocationItem } from '../../../models/ride.model';
import {
  FuelType,
  FuelTypeResponse,
} from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { VehicleService } from '../../../services/vehicle.service';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-ride-completion-form',
  templateUrl: './ride-completion-form.component.html',
  styleUrls: ['./ride-completion-form.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
})
export class RideCompletionFormComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  currentRide!: any;
  ridesWithLocations: RideLocationItem[] = [];
  stop_name: string = '';
  VehicleFuelType: FuelType = FuelType.Gasoline;
  extra_stops_names: string[] = [];

  allStopsNames: string = '';
  private destroy$ = new Subject<void>();

  showForm = true;
  @Input() rideId!: string;
  @Output() formCompleted = new EventEmitter<void>();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private rideReportService: RideReportService,
    private location: Location,
    private rideService: RideService,
    private vehicleService: VehicleService,
    private router: Router
  ) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.rideId = this.rideId || this.route.snapshot.paramMap.get('ride_id')!;
    const submittedKey = `feedback_submitted_${this.rideId}`;

    this.rideService.getRideById(this.rideId).subscribe((ride) => {
      this.currentRide = ride;

      this.rideReportService
        .getRidesWithLocations()
        .subscribe((ridesWithLocations) => {
          const matchingRide = ridesWithLocations.find(
            (r) => r.id === this.currentRide?.ride_id
          );

          if (matchingRide) {
            this.stop_name = matchingRide.stop_name;
            this.extra_stops_names = matchingRide.extra_stops_names || [];
            const allStops = [this.stop_name, ...this.extra_stops_names];
            this.allStopsNames = allStops.filter((name) => name).join(', ');
          }
        });
    });
    if (localStorage.getItem(submittedKey) === 'true') {
      this.showForm = false;
      return;
    }

    this.form = this.fb.group({
      emergency_event: ['', Validators.required],
      freeze_details: [''],
      fueled: ['', Validators.required],
      is_vehicle_ready_for_next_ride: ['', Validators.required],
    });

   this.form.get('emergency_event')?.valueChanges
  .pipe(takeUntil(this.destroy$))
  .subscribe((value) => {
    const freezeDetails = this.form.get('freeze_details');

    if (value === 'true') {
      freezeDetails?.setValidators([Validators.required]);
    } else {
      freezeDetails?.clearValidators();
      freezeDetails?.setValue('');
    }

    freezeDetails?.updateValueAndValidity();
  });

  }

    ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFuelType(vehicleId: string) {
    this.vehicleService.getFuelTypeByVehicleId(vehicleId).subscribe({
      next: (res: FuelTypeResponse) => {
        this.VehicleFuelType = res.fuel_type;
      },
      error: (err) => console.error('Failed to load fuel type', err),
    });
  }

  setEmergencyEvent(value: string): void {
    this.form.get('emergency_event')?.setValue(value);
  }

  setFormValue(controlName: string, value: string | boolean): void {
    this.form.get(controlName)?.setValue(value);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.show('אנא השלם את כל השדות הנדרשים', 'error');
      return;
    }
    this.loadFuelType(this.currentRide.vehicle_id);

    if (this.form.value.fueled == 'false') {
      if (this.VehicleFuelType === 'electric') {
        this.toastService.showPersistent(
          'הרכב טרם נטען. אנא טען לפני ההחזרה.',
          'neutral'
        );
      } else if (this.VehicleFuelType === 'hybrid') {
        this.toastService.showPersistent(
          'הרכב לא תודלק ולא נטען. יש להשלים לפני ההחזרה.',
          'neutral'
        );
      } else if (this.VehicleFuelType === 'gasoline') {
        this.toastService.showPersistent(
          'הרכב לא תודלק. יש לתדלק לפני ההחזרה.',
          'neutral'
        );
      }
    }

   const rawForm = this.form.value;
  const formData = {
    ride_id: this.rideId,
    emergency_event: rawForm.emergency_event === 'true' ? 'true' : 'false',
    freeze_details: rawForm.freeze_details || '',
    fueled: rawForm.fueled === 'true',
    is_vehicle_ready_for_next_ride: rawForm.is_vehicle_ready_for_next_ride === true,
    changed_by: localStorage.getItem('user_id') || '',
  };

  const token = localStorage.getItem('access_token') || '';
  this.loading = true;

  this.rideReportService.submitCompletionForm(formData, token).subscribe({
    next: () => {
  
      localStorage.setItem(`feedback_submitted_${this.rideId}`, 'true');
      localStorage.setItem('last_submitted_ride', this.rideId);
      localStorage.removeItem('pending_feedback_ride');

      this.toastService.show('הטופס נשלח בהצלחה', 'success');
      this.showForm = false;
      this.loading = false;

      this.formCompleted.emit();

      this.router.navigate(['/all-rides']);
    },

      error: () => {
        this.toastService.show('אירעה שגיאה בשליחת הטופס', 'error');
        this.loading = false;
      },
    });
    this.formCompleted.emit();
    this.router.navigate(['/all-rides']);
  }
}
