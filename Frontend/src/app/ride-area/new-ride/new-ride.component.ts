import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidatorFn,
  FormControl,
  ReactiveFormsModule,
  FormsModule
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastService } from '../../services/toast.service';
import { RideService } from '../../services/ride.service'; 
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../services/vehicle.service';
import { SocketService } from '../../services/socket.service';

@Component({
  selector: 'app-new-ride',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule,
    HttpClientModule
  ],
  templateUrl: './new-ride.component.html',
  styleUrls: ['./new-ride.component.css']
})
export class NewRideComponent implements OnInit {
  rideForm!: FormGroup;
  public estimated_distance_with_buffer: number = 0;
  public minDate: string = '';

  allCars: {
    id: string;
    plate_number: string;
    type: string;
    fuel_type: string;
    status: string;
    freeze_reason?: string | null;
    last_used_at?: string;
    current_location?: string;
    odometer_reading: number;
    image_url: string;
    vehicle_model: string;
  }[] = [];

  availableCars: typeof this.allCars = [];

  // Store pending vehicle IDs in a Set for fast lookup
  pendingVehicleIds = new Set<string>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastService: ToastService,
    private rideService: RideService,
    private vehicleService: VehicleService,
    private socketService: SocketService,
  ) {}

  ngOnInit(): void {
    this.minDate = this.calculateMinDate(2);
    this.rideForm = this.fb.group({
      ride_period: ['morning'],
      ride_date: ['', [Validators.required, this.minDateValidator(2), this.validYearRangeValidator(2025, 2099)]],
      ride_date_night_end: [''],
      start_time: [''],
      end_time: [''],
      estimated_distance_km: [null, [Validators.required, Validators.min(1)]],
      ride_type: ['', Validators.required],
      vehicle_type: ['', Validators.required],
      car: ['', Validators.required],
      start_location: ['', Validators.required],
      stop: ['', Validators.required],
      destination: ['', Validators.required],
    });

    this.rideForm.get('estimated_distance_km')?.valueChanges.subscribe(() => {
      this.updateDistance();
    });

    this.rideForm.get('ride_period')?.valueChanges.subscribe(value => {
      this.onPeriodChange(value);
    });

    // Load all vehicles and filter for available ones
    this.vehicleService.getAllVehicles().subscribe({
      next: (vehicles) => {
        this.allCars = vehicles
          .filter(v =>
            v.status === 'available' &&
            !!v.id &&
            !!v.type &&
            !!v.plate_number &&
            typeof v.odometer_reading === 'number'
          )
          .map(v => ({
            ...v,
            image_url: v.image_url || 'assets/default-car.png',
            vehicle_model: v.vehicle_model || 'רכב ללא דגם',
            freeze_reason: v.freeze_reason ?? null
          }));
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת רכבים זמינים', 'error');
      }
    });

    // Load pending cars and save their IDs in a Set
  // Load pending cars and save their IDs in a Set
this.vehicleService.getPendingCars().subscribe({
  next: (pendingVehicleIds: string[]) => {
    console.log('Fetched pending vehicle IDs:', pendingVehicleIds);
    this.pendingVehicleIds = new Set(pendingVehicleIds.map(id => id.trim())); // trim just in case
    console.log('Pending vehicle IDs set:', Array.from(this.pendingVehicleIds));
  },
  error: () => {
    this.toastService.show('שגיאה בטעינת רכבים ממתינים', 'error');
  }
});


  }

  onRideTypeChange() {
    const selectedType = this.rideForm.value.vehicle_type;
    this.availableCars = this.allCars.filter(car => car.type === selectedType);
    this.rideForm.get('car')?.setValue('');

    if (this.availableCars.length === 0) {
      this.toastService.show('אין רכבים זמינים מסוג זה', 'error');
    }
  }

  onPeriodChange(value: string): void {
    const nightEndControl = this.rideForm.get('ride_date_night_end');
    const rideDateControl = this.rideForm.get('ride_date');

    if (value === 'night') {
      nightEndControl?.setValidators([Validators.required]);
      rideDateControl?.clearValidators();
    } else {
      nightEndControl?.clearValidators();
      rideDateControl?.setValidators([
        Validators.required,
        this.minDateValidator(2),
        this.validYearRangeValidator(2025, 2099)
      ]);
    }

    rideDateControl?.updateValueAndValidity();
    nightEndControl?.updateValueAndValidity();
  }

  updateDistance(): void {
    const distance = this.rideForm.get('estimated_distance_km')?.value || 0;
    this.estimated_distance_with_buffer = +(distance * 1.1).toFixed(2);
  }

  calculateMinDate(daysAhead: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().split('T')[0];
  }

  minDateValidator(minDaysAhead: number): ValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return null;
      const selectedDate = new Date(control.value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = new Date(today);
      minDate.setDate(today.getDate() + minDaysAhead);
      return selectedDate >= minDate ? null : { tooSoon: true };
    };
  }

  validYearRangeValidator(minYear: number, maxYear: number): ValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return null;
      const selectedYear = new Date(control.value).getFullYear();
      return selectedYear >= minYear && selectedYear <= maxYear ? null : { invalidYear: true };
    };
  }

  // The function you requested: returns true if the vehicle is pending, else false
 isPendingVehicle(vehicle_id: string): boolean {
  const isPending = this.pendingVehicleIds.has(vehicle_id);
  console.log(`Checking if carId ${vehicle_id} is pending: ${isPending}`);
  return isPending;
}





  submit(): void {
    if (this.rideForm.invalid) {
      this.rideForm.markAllAsTouched();
      this.toastService.show('יש להשלים את כל שדות הטופס כנדרש', 'error');
      return;
    }

    const vehicleId = this.rideForm.get('car')?.value;
    if (!vehicleId) {
      this.toastService.show('יש לבחור רכב מהתפריט', 'error');
      return;
    }

    if (this.isPendingVehicle(vehicleId)) {
      this.toastService.show('הרכב שבחרת ממתין לעיבוד ולא זמין כרגע', 'error');
      return;
    }

    // ...rest of your submit logic here (omitted for brevity)
  }

  get f() {
    return {
      ride_period: this.rideForm.get('ride_period') as FormControl,
      ride_date: this.rideForm.get('ride_date') as FormControl,
      ride_date_night_end: this.rideForm.get('ride_date_night_end') as FormControl,
      start_time: this.rideForm.get('start_time') as FormControl,
      end_time: this.rideForm.get('end_time') as FormControl,
      estimated_distance_km: this.rideForm.get('estimated_distance_km') as FormControl,
      ride_type: this.rideForm.get('ride_type') as FormControl,
      vehicle_type: this.rideForm.get('vehicle_type') as FormControl,
      car: this.rideForm.get('car') as FormControl,
      start_location: this.rideForm.get('start_location') as FormControl,
      stop: this.rideForm.get('stop') as FormControl,
      destination: this.rideForm.get('destination') as FormControl
    };
  }

  close(): void {
    this.router.navigate(['/home']);
  }
}
