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
import { ToastService } from '../../../services/toast.service';
import { RideService } from '../../../services/ride.service'; 
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../../services/vehicle.service';
import { SocketService } from '../../../services/socket.service';
import { Location } from '@angular/common';

// Define the interface for pending vehicle
interface PendingVehicle {
  vehicle_id: string;
  date: string;
  period: string;
  start_time?: string;
  end_time?: string;
}

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
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class NewRideComponent implements OnInit {
  rideForm!: FormGroup;
  public estimated_distance_with_buffer: number = 0;
  public minDate: string = '';
  public fetchedDistance: number | null = null; 

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

  // Fix: Use proper interface and initialization
  pendingVehicles: PendingVehicle[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastService: ToastService,
    private rideService: RideService,
    private vehicleService: VehicleService,
    private socketService: SocketService,
    private location: Location
  ) {}

  // ✅ MOCKED FUNCTION: Fetch estimated distance between start and destination cities
fetchEstimatedDistance(from: string, to: string): void {
  if (!from || !to) return;

  console.log(`Fetching distance between: ${from} → ${to}`);

  // ⏱ Simulate backend response with a delay
  setTimeout(() => {
    const mockDistance = +(Math.random() * 100 + 5).toFixed(1); // 5–105 km
    this.fetchedDistance = mockDistance;

    // Set the value into the form
    this.rideForm.get('estimated_distance_km')?.setValue(mockDistance);
  }, 500);
}


  goBack(): void {
  this.location.back();
}

  ngOnInit(): void {
    this.minDate = this.calculateMinDate();
    this.rideForm = this.fb.group({
      ride_period: ['morning'],
      ride_date: ['', [Validators.required, this.validYearRangeValidator(2025, 2099)]],
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

    // Add subscription to form changes to trigger re-evaluation of pending vehicles
    this.rideForm.get('ride_date')?.valueChanges.subscribe(() => {
      this.updateAvailableCars();
    });

    this.rideForm.get('ride_period')?.valueChanges.subscribe(() => {
      this.updateAvailableCars();
    });

    // Add time change subscriptions for real-time validation
    this.rideForm.get('start_time')?.valueChanges.subscribe(() => {
      this.updateAvailableCars();
    });

    this.rideForm.get('end_time')?.valueChanges.subscribe(() => {
      this.updateAvailableCars();
    });

    // ✅ Subscribe to city changes
this.rideForm.get('start_location')?.valueChanges.subscribe(() => {
  const from = this.rideForm.get('start_location')?.value;
  const to = this.rideForm.get('destination')?.value;
  if (from && to) this.fetchEstimatedDistance(from, to);
});

this.rideForm.get('destination')?.valueChanges.subscribe(() => {
  const from = this.rideForm.get('start_location')?.value;
  const to = this.rideForm.get('destination')?.value;
  if (from && to) this.fetchEstimatedDistance(from, to);
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
        
        this.updateAvailableCars();
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת רכבים זמינים', 'error');
      }
    });

    // Load pending cars with proper error handling and type safety
    this.loadPendingVehicles();
  }

  private loadPendingVehicles(): void {
    this.vehicleService.getPendingCars().subscribe({
      next: (response: any) => {
        console.log('Raw API response:', response);
        
        // Handle different possible response formats
        let pendingData: any[] = [];
        
        if (Array.isArray(response)) {
          pendingData = response;
        } else if (response && Array.isArray(response.data)) {
          pendingData = response.data;
        } else if (response && Array.isArray(response.pending_vehicles)) {
          pendingData = response.pending_vehicles;
        }

        // Map and validate the data
        this.pendingVehicles = pendingData
          .filter(item => item && typeof item === 'object')
          .map(item => ({
            vehicle_id: String(item.vehicle_id || item.vehicleId || item.car_id || ''),
            date: String(item.date || item.ride_date || ''),
            period: String(item.period || item.ride_period || ''),
            start_time: item.start_time || item.startTime || undefined,
            end_time: item.end_time || item.endTime || undefined
          }))
          .filter(item => item.vehicle_id && item.date && item.period);

        console.log('Processed pending vehicles:', this.pendingVehicles);
        this.updateAvailableCars();
      },
      error: (error) => {
        console.error('Error loading pending vehicles:', error);
        this.toastService.show('שגיאה בטעינת רכבים ממתינים', 'error');
      }
    });
  }

  private updateAvailableCars(): void {
    const selectedType = this.rideForm.get('vehicle_type')?.value;
    if (selectedType) {
      this.availableCars = this.allCars.filter(car => car.type === selectedType);
    }
  }

  onRideTypeChange() {
    this.updateAvailableCars();
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

isPendingVehicle(vehicle_id: string): boolean {
  const rideDate = this.rideForm.get('ride_date')?.value;
  const ridePeriod = this.rideForm.get('ride_period')?.value;
  const startTime = this.rideForm.get('start_time')?.value;
  const endTime = this.rideForm.get('end_time')?.value;

  console.log('Checking pending for:', { vehicle_id, rideDate, ridePeriod, startTime, endTime });
  console.log('Current pending vehicles:', this.pendingVehicles);

  if (!rideDate || !ridePeriod || !vehicle_id || !startTime || !endTime) {
    return false;
  }

  // Normalize date format (ensure consistent format)
  const normalizedRideDate = this.normalizeDateString(rideDate);

  const isPending = this.pendingVehicles.some(pv => {
    const normalizedPendingDate = this.normalizeDateString(pv.date);
    
    // First check if vehicle and date match
    const basicMatch = pv.vehicle_id === vehicle_id && 
                      normalizedPendingDate === normalizedRideDate;
    
    if (!basicMatch) {
      return false;
    }

    // Skip if pending vehicle doesn't have time data
    if (!pv.start_time || !pv.end_time) {
      console.log('Pending vehicle missing time data - blocking entire day for safety:', pv);
      return true;
    }

    // Add 2-hour buffer to pending vehicle's end time
    const pendingEndTimeWithBuffer = this.addHoursToTime(pv.end_time, 2);
    
    // Check time overlap including the 2-hour buffer
    const hasTimeOverlap = this.checkTimeOverlap(
      startTime, endTime,
      pv.start_time, pendingEndTimeWithBuffer
    );
    
    if (hasTimeOverlap) {
      console.log('Time overlap detected (including 2-hour buffer):', {
        requested: { start: startTime, end: endTime },
        pending: { start: pv.start_time, end: pv.end_time },
        pendingWithBuffer: { start: pv.start_time, end: pendingEndTimeWithBuffer }
      });
    }
    
    return hasTimeOverlap;
  });

  console.log('Is pending result:', isPending);
  return isPending;
}

// Helper function to add hours to a time string (HH:MM format)
private addHoursToTime(timeString: string, hoursToAdd: number): string {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setHours(date.getHours() + hoursToAdd);
  
  // Handle day overflow (if time goes past 24:00)
  const newHours = date.getHours();
  const newMinutes = date.getMinutes();
  
  return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
}

  private checkTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    // Convert time strings to minutes for easier comparison
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);

    // Handle cases where end time is next day (crosses midnight)
    const end1Adjusted = end1Minutes < start1Minutes ? end1Minutes + 1440 : end1Minutes;
    const end2Adjusted = end2Minutes < start2Minutes ? end2Minutes + 1440 : end2Minutes;

    // Check for overlap: two time ranges overlap if start1 < end2 and start2 < end1
    const overlap = start1Minutes < end2Adjusted && start2Minutes < end1Adjusted;
    
    console.log('Time overlap check:', {
      range1: { start: start1, end: end1, startMin: start1Minutes, endMin: end1Adjusted },
      range2: { start: start2, end: end2, startMin: start2Minutes, endMin: end2Adjusted },
      overlap
    });

    return overlap;
  }

  private timeToMinutes(timeStr: string): number {
    if (!timeStr || typeof timeStr !== 'string') {
      return 0;
    }
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours * 60) + (minutes || 0);
  }

  private normalizeDateString(dateStr: string): string {
    if (!dateStr) return '';
    
    // Handle different date formats
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return dateStr; // Return original if invalid
      }
      // Return in YYYY-MM-DD format
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.warn('Date normalization failed for:', dateStr);
      return dateStr;
    }
  }

  calculateMinDate(): string {
    const date = new Date();
    date.setDate(date.getDate());
    return date.toISOString().split('T')[0];
  }

  // minDateValidator(minDaysAhead: number): ValidatorFn {
  //   return (control: AbstractControl) => {
  //     if (!control.value) return null;
  //     const selectedDate = new Date(control.value);
  //     const today = new Date();
  //     today.setHours(0, 0, 0, 0);
  //     const minDate = new Date(today);
  //     minDate.setDate(today.getDate() + minDaysAhead);
  //     return selectedDate >= minDate ? null : { tooSoon: true };
  //   };
  // }

  validYearRangeValidator(minYear: number, maxYear: number): ValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return null;
      const selectedYear = new Date(control.value).getFullYear();
      return selectedYear >= minYear && selectedYear <= maxYear ? null : { invalidYear: true };
    };
  }

  submit(): void {
  // Initial form validation
  if (this.rideForm.invalid) {
    this.rideForm.markAllAsTouched();
    this.toastService.show('יש להשלים את כל שדות הטופס כנדרש', 'error');
    return;
  }

  // Vehicle selection validation
  const vehicleId = this.rideForm.get('car')?.value;
  if (!vehicleId) {
    this.toastService.show('יש לבחור רכב מהתפריט', 'error');
    return;
  }

  // Check if vehicle is pending
  if (this.isPendingVehicle(vehicleId)) {
    this.toastService.show('הרכב שבחרת ממתין לעיבוד ולא זמין כרגע', 'error');
    return;
  }

  // Get form values
  const ridePeriod = this.rideForm.get('ride_period')?.value as 'morning' | 'night';
  const rideDate = this.rideForm.get('ride_date')?.value;
  const nightEndDate = this.rideForm.get('ride_date_night_end')?.value;
  const startTime = this.rideForm.get('start_time')?.value;
  const endTime = this.rideForm.get('end_time')?.value;
  const distance = this.rideForm.get('estimated_distance_km')?.value;

  // Time validation for morning rides
  if (ridePeriod === 'morning' && startTime && endTime && startTime >= endTime) {
    this.toastService.show('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'error');
    return;
  }

  // Distance validation
  if (distance > 1000) {
    this.toastService.show('מרחק לא הגיוני - נא להזין ערך סביר', 'error');
    return;
  }

  // User validation
  const user_id = localStorage.getItem('employee_id');
  if (!user_id) {
    this.toastService.show('שגיאת זיהוי משתמש - התחבר מחדש', 'error');
    return;
  }

  // Build datetime strings
  const start_datetime = `${rideDate}T${startTime}`;
  const end_datetime = ridePeriod === 'morning'
    ? `${rideDate}T${endTime}`
    : `${nightEndDate}T${endTime}`;

  // Prepare form data
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

  console.log('Ride data for backend:', formData);

  // Submit ride request
  this.rideService.createRide(formData, user_id).subscribe({
    next: (createdRide) => {
      this.toastService.show('הבקשה נשלחה בהצלחה! ✅', 'success');

      // Emit socket message after successful creation
      this.socketService.sendMessage('new_ride_request', {
        ...createdRide,
        user_id
      });

      this.router.navigate(['/']);
    },
    error: (err) => {
      this.toastService.show('שגיאה בשליחת הבקשה', 'error');
      console.error('Submit error:', err);
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

