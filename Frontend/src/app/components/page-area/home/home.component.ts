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
import { CityService } from '../../../services/city.service';
import { Location } from '@angular/common';
import { FuelType, FuelTypeResponse } from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { th } from 'date-fns/locale';

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


handleStep1Next() {
  const targetType = this.rideForm.get('target_type')?.value;
  const targetEmployeeId = this.rideForm.get('target_employee_id')?.value;

  if (!targetType || (targetType === 'other' && !targetEmployeeId)) {
    this.showStep1Error = true;
    return;
  }

  this.showStep1Error = false;
  this.step = 2;
}

  rideForm!: FormGroup;
  public estimated_distance_with_buffer: number = 0;
  public minDate: string = '';
  public fetchedDistance: number | null = null; 
  cities: { id: string; name: string }[] = [];
  step = 1;
  departmentEmployees: { id: string; full_name: string }[] = [];
  showInspectorWarningModal = false;
  VehicleFuelType:FuelType=FuelType.Gasoline
  public isLoadingDistance = false;







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
  showStep1Error= false;
  
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastService: ToastService,
    private rideService: RideService,
    private vehicleService: VehicleService,
    private socketService: SocketService,
    private location: Location,
    private cityService: CityService
  ) {}

 fetchEstimatedDistance(from: string, to: string): void {
  if (!from || !to) return;

  this.isLoadingDistance = true;

  console.log(`🌍 Requesting real distance: ${from} → ${to}`);

  this.rideService.getDistance(from, to).subscribe({
    next: (response) => {
      const realDistance = response.distance_km;
      console.log(`📏 Distance fetched: ${realDistance} km`);

      const roundTripDistance = realDistance * 2; // Calculate round trip

      console.log(`📏 One-way distance: ${realDistance} km, Round-trip: ${roundTripDistance} km`);

      this.fetchedDistance = roundTripDistance; // Store round-trip distance

      this.rideForm.get('estimated_distance_km')?.setValue(roundTripDistance);
      this.updateDistance(); 
      this.isLoadingDistance = false;
    },
    error: (err) => {
      console.error('❌ Failed to fetch distance:', err);
      this.toastService.show('שגיאה בחישוב מרחק בין הערים', 'error');
      this.fetchedDistance = null;
      this.rideForm.get('estimated_distance_km')?.setValue(null);
      this.isLoadingDistance = false;
    }
  });
}


  goBack(): void {
  this.location.back();
}

  ngOnInit(): void {
    this.minDate = this.calculateMinDate();
    this.rideForm = this.fb.group({
      target_type: ['self', Validators.required],
      target_employee_id: [null],
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
      vehicle_type_reason: ['', Validators.required]
    });

    // fetch coworkers in same department if needed
    this.rideForm.get('target_type')?.valueChanges.subscribe(type => {
      if (type === 'other') {
        this.fetchDepartmentEmployees();
      } else {
        this.rideForm.get('target_employee_id')?.setValue(null);
      }
    });


    this.getVehicleTypes()
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
   this.rideForm.get('start_location')?.valueChanges.subscribe(() => {
  this.checkAndFetchDistance();
});

this.rideForm.get('end_location')?.valueChanges.subscribe(() => {
  this.checkAndFetchDistance();
});


    // ✅ Subscribe to city changes
this.rideForm.get('start_location')?.valueChanges.subscribe(() => {
  const from = this.rideForm.get('start_location')?.value;
  const to = this.rideForm.get('destination')?.value;
  if (from && to && from !== to) {
    this.fetchEstimatedDistance(from, to);
  } else {
    // Clear distance when locations are incomplete
    this.fetchedDistance = null;
    this.rideForm.get('estimated_distance_km')?.setValue(null);
    this.estimated_distance_with_buffer = 0;
  }
});

this.rideForm.get('destination')?.valueChanges.subscribe(() => {
  const from = this.rideForm.get('start_location')?.value;
  const to = this.rideForm.get('destination')?.value;
  if (from && to && from !== to) {
    this.fetchEstimatedDistance(from, to);
  } else {
    // Clear distance when locations are incomplete
    this.fetchedDistance = null;
    this.rideForm.get('estimated_distance_km')?.setValue(null);
    this.estimated_distance_with_buffer = 0;
  }
});

    this.fetchCities();
    console.log('fetching cities...', this.cities);

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

    this.rideForm.get('vehicle_type')?.valueChanges.subscribe(value => {
    const vehicleTypeReason = this.rideForm.get('vehicle_type_reason');
    
    if (value?.toLowerCase().includes('jeep') || 
        value?.toLowerCase().includes('van') || 
        value?.toLowerCase().includes('4x4')) {
      vehicleTypeReason?.setValidators([Validators.required]);
    } else {
      vehicleTypeReason?.clearValidators();
    }
    vehicleTypeReason?.updateValueAndValidity();
  });


    // Load pending cars with proper error handling and type safety
    this.loadPendingVehicles();
  }

  fetchCities(): void{
    this.cityService.getCities().subscribe({
      next: (cities) => {
        this.cities = cities.map(city => ({
          id: city.id,
          name: city.name
        }));
      },
      error: (err) => {
        console.error('Failed to fetch cities', err);
        this.toastService.show('שגיאה בטעינת ערים', 'error');
        this.cities = [];
      }
    });
  }

  fetchDepartmentEmployees(): void {
    const currentUserId = localStorage.getItem('employee_id');
    if (!currentUserId) return;

    this.rideService.getDepartmentEmployees(currentUserId).subscribe({
      next: (employees) => {
      this.departmentEmployees = employees;
    },
    error: (err) => {
      console.error('Failed to load department employees', err);
      this.toastService.show('שגיאה בטעינת עובדים מהמחלקה', 'error');
    }
  });
}

canProceedToDetails(): boolean {
  const type = this.rideForm.get('target_type')?.value;
  const selectedEmp = this.rideForm.get('target_employee_id')?.value;

  if (type === 'self') return true;
  if (type === 'other' && selectedEmp) return true;
  return false;
}
  loadFuelType(vehicleId: string) {
    this.vehicleService.getFuelTypeByVehicleId(vehicleId).subscribe({
      next: (res: FuelTypeResponse) => {
        this.VehicleFuelType = res.fuel_type;
        console.log('Fuel Type:', this.VehicleFuelType);
      },
      error: err => console.error('Failed to load fuel type', err)
    });
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

  validYearRangeValidator(minYear: number, maxYear: number): ValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return null;
      const selectedYear = new Date(control.value).getFullYear();
      return selectedYear >= minYear && selectedYear <= maxYear ? null : { invalidYear: true };
    };
  }

 checkAndFetchDistance() {
  const start = this.rideForm.get('start_location')?.value;
  const end = this.rideForm.get('end_location')?.value;

  if (start && end && start !== end) {
    this.fetchEstimatedDistance(start, end);
  } else {
    this.fetchedDistance = null;
    this.rideForm.get('estimated_distance_km')?.setValue(null);
  }
}

isDuringInspectorClosure(startTime: string): boolean {
  const startMinutes = this.timeToMinutes(startTime);
  const startRange = this.timeToMinutes('11:15');
  const endRange = this.timeToMinutes('12:15');
  return startMinutes >= startRange && startMinutes <= endRange;
}

confirmInspectorWarning(): void {
  this.showInspectorWarningModal = false;
  this.submit(true); // Allow it to skip re-check
}


  submit(confirmedWarning = false): void {
  // Initial form validation
  if (this.rideForm.invalid) {
    this.rideForm.markAllAsTouched();
    this.toastService.show('יש להשלים את כל שדות הטופס כנדרש', 'error');
    return;

  }
  this.rideForm.markAllAsTouched(); // This is good, keeps errors visible

  if (this.rideForm.invalid) {
    this.toastService.show('יש להשלים את כל שדות הטופס כנדרש', 'error');

    // --- PASTE THIS CODE HERE ---
    console.log('FORM IS INVALID. HERE ARE THE ERRORS:');
    Object.keys(this.rideForm.controls).forEach(key => {
      const control = this.rideForm.get(key);
      if (control && control.invalid) {
        console.log(`- Control '${key}' is invalid. Errors:`, control.errors);
      }
    });
    // --- END PASTE ---

    return; // Stop submission if form is invalid
  }

  // ... (rest of your submission logic)

  
  

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


  if (
  !confirmedWarning &&
  ridePeriod === 'morning' &&
  this.isDuringInspectorClosure(startTime)
) {
  this.showInspectorWarningModal = true;
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

      // Determine actual and override user IDs ✅ ADDED
    const targetType = this.rideForm.get('target_type')?.value;
    const targetEmployeeId = this.rideForm.get('target_employee_id')?.value;
    let rider_id = user_id;
    let requester_id = null;

    if (targetType === 'other' && targetEmployeeId) {
      rider_id = targetEmployeeId;
      requester_id = user_id;
    }

  // Build datetime strings
  const start_datetime = `${rideDate}T${startTime}`;
  const end_datetime = ridePeriod === 'morning'
    ? `${rideDate}T${endTime}`
    : `${nightEndDate}T${endTime}`;

  // Prepare form data

  // const targetEmployeeId = this.rideForm.get('target_type')?.value === 'other'
  // ? this.rideForm.get('target_employee_id')?.value
  // : null;

  const formData = {
    user_id: rider_id, 
    override_user_id: requester_id, 
    ride_type: this.rideForm.get('ride_type')?.value,
    start_datetime,
    vehicle_id: vehicleId,
    end_datetime,
    start_location: this.rideForm.get('start_location')?.value,
    stop: this.rideForm.get('stop')?.value,
    destination: this.rideForm.get('destination')?.value,
    estimated_distance_km: distance,
    actual_distance_km: this.estimated_distance_with_buffer,
  };

  console.log('Ride data for backend:', formData);

  // Submit ride request
  this.rideService.createRide(formData, user_id).subscribe({
    next: (createdRide) => {
      this.toastService.show('הבקשה נשלחה בהצלחה! ✅', 'success');
      this.loadFuelType(formData.vehicle_id)

         if (this.VehicleFuelType === 'electric') {
        this.toastService.showPersistent('אנא ודא כי הרכב טעון לפני ההחזרה.','neutral');
      } else if (this.VehicleFuelType === 'hybrid') {
        this.toastService.showPersistent('אנא ודא כי יש מספיק דלק וטעינה לפני ההחזרה.','neutral');
      } else if (this.VehicleFuelType === 'gasoline') {
        this.toastService.showPersistent('אנא ודא כי מיכל הדלק מלא לפני ההחזרה.','neutral');
      }


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
  getVehicleTypes(): any
  {
    return [...new Set(this.allCars.map(car => car.type))];
    console.log('Available vehicle types:', [...new Set(this.allCars.map(car => car.type))]);
  }
  close(): void {
    this.router.navigate(['/home']);
  }
}

