
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
import { RideService } from '../../services/ride.service'; // ✅ Import your ride service
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../services/vehicle.service';

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
  styleUrl: './new-ride.component.css'
})
export class NewRideComponent implements OnInit {
  rideForm!: FormGroup;
  public estimated_distance_with_buffer: number = 0;
  public minDate: string = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastService: ToastService,
    private rideService: RideService,
    private vehicleService: VehicleService 
  ) {}
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

  ngOnInit(): void {
    
    this.minDate = this.calculateMinDate(2);
    this.rideForm = this.fb.group({
      ride_period: ['morning'],
      ride_date: ['', [Validators.required, this.minDateValidator(2), this.validYearRangeValidator(2025, 2099)]],
      ride_date_night_end: [''],
      start_time: [''],
      end_time: [''],
      estimated_distance_km: [null, [Validators.required, Validators.min(1)]],
      ride_type: ['', Validators.required], // ✅ type of ride (admin/operational)
      vehicle_type: ['', Validators.required], // ✅ type of vehicle (small/van/large)
      car: ['', Validators.required], // ✅ Add required validation
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

 this.vehicleService.getAllVehicles().subscribe({
  next: (vehicles) => {

    console.log('🚗 Raw vehicle data from backend:', vehicles); // ✅ ADD THIS

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
    image_url: v.image_url || 'assets/default-car.png',  // Optional fallback
    vehicle_model: v.vehicle_model || 'רכב ללא דגם',
    freeze_reason: v.freeze_reason ?? null
  }));

  console.log('✅ Filtered available cars after .filter():', this.allCars); // ✅ ADD THIS


  },
  error: () => {
    this.toastService.show('שגיאה בטעינת רכבים זמינים', 'error');
  }
});



    
  }
  onRideTypeChange() {
    const selectedType = this.rideForm.value.vehicle_type; 
    this.availableCars = this.allCars.filter(car => car.type === selectedType);

    // Reset selected car if type changes
    this.rideForm.get('car')?.setValue('');

  console.log('All cars:', this.allCars);
  console.log('Selected type:', selectedType);
  console.log('Filtered available cars:', this.availableCars);

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

  submit(): void {
    if (this.rideForm.invalid) {
      this.rideForm.markAllAsTouched();
      this.toastService.show('יש להשלים את כל שדות הטופס כנדרש', 'error');
      return;
    }

    const ridePeriod = this.rideForm.get('ride_period')?.value as 'morning' | 'night';
    const rideDate = this.rideForm.get('ride_date')?.value;
    const nightEndDate = this.rideForm.get('ride_date_night_end')?.value;
    const startTime = this.rideForm.get('start_time')?.value;
    const endTime = this.rideForm.get('end_time')?.value;

    if (ridePeriod === 'morning' && startTime && endTime && startTime >= endTime) {
      this.toastService.show('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'error');
      return;
    }

    const distance = this.rideForm.get('estimated_distance_km')?.value;
    if (distance > 1000) {
      this.toastService.show('מרחק לא הגיוני - נא להזין ערך סביר', 'error');
      return;
    }

    const vehicleId = this.rideForm.get('car')?.value;

if (!vehicleId) {
  this.toastService.show('יש לבחור רכב מהתפריט', 'error');
  return;
}


    const start_datetime = `${rideDate}T${startTime}`;
    const end_datetime = ridePeriod === 'morning'
      ? `${rideDate}T${endTime}`
      : `${nightEndDate}T${endTime}`;

 const formData = {
  ride_type: this.rideForm.get('ride_type')?.value,
  start_datetime,
  vehicle_id: vehicleId,
  end_datetime,
  start_location: this.rideForm.get('start_location')?.value,
  stop: this.rideForm.get('stop')?.value,
  destination: this.rideForm.get('destination')?.value,
  estimated_distance_km: distance,
  actual_distance_km: this.estimated_distance_with_buffer 
};

// Keep these only for display/logging, not for backend
const clientMeta = {
  estimated_distance_with_buffer: this.estimated_distance_with_buffer,
  ride_period: ridePeriod
};

console.log('Ride for backend:', formData);
console.log('Client-only metadata:', clientMeta);


    const user_id = localStorage.getItem('employee_id'); // ✅ make sure this is stored at login
    console.log('employee_id from localStorage:', user_id);
    if (!user_id) {
      this.toastService.show('שגיאת זיהוי משתמש - התחבר מחדש', 'error');
      return;
    }

this.rideService.createRide(formData, user_id).subscribe({
      next: () => {
        this.toastService.show('הבקשה נשלחה בהצלחה! ✅', 'success');
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.toastService.show('שגיאה בשליחת הבקשה', 'error');
        console.error(err);
      }
    });
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