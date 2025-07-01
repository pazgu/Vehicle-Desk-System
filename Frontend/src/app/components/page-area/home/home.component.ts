import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidatorFn,
  FormControl,
  ReactiveFormsModule,
  FormsModule,
  FormArray
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

// Define the interface for pending vehicle
interface PendingVehicle {
  vehicle_id: string;
  date: string;
  period: string;
  start_time?: string;
  end_time?: string;
}

interface Vehicle {
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
}

interface City {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  full_name: string;
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
  minDate: string = '';
  fetchedDistance: number | null = null;
  estimated_distance_with_buffer: number | null = null;
  cities: City[] = [];
  step = 1;
  departmentEmployees: Employee[] = [];
  showInspectorWarningModal = false;
  showStep1Error = false;
  vehicleFuelType: FuelType = FuelType.Gasoline;
  isLoadingDistance = false;
  allCars: Vehicle[] = [];
  availableCars: Vehicle[] = [];
  vehicleTypes: string[] = [];
  pendingVehicles: PendingVehicle[] = [];

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

  ngOnInit(): void {
    this.initializeComponent();
  }

  private initializeComponent(): void {
    this.fetchVehicleTypes();
    this.minDate = this.calculateMinDate();
    this.initializeForm();
    this.setupFormSubscriptions();
    this.fetchCities();
    this.loadVehicles();
    this.loadPendingVehicles();
  }

  private initializeForm(): void {
    this.rideForm = this.fb.group({
      target_type: ['self', Validators.required],
      target_employee_id: [null],
      ride_period: ['morning'],
      ride_date: ['', [Validators.required, this.validYearRangeValidator(2025, 2099)]],
      ride_date_night_end: [''],
      start_time: [''],
      end_time: [''],
      estimated_distance_km: [null, Validators.required],
      ride_type: ['', Validators.required],
      vehicle_type: ['', Validators.required],
      car: ['', Validators.required],
      start_location: [null],
      stop: ['', Validators.required],
      extraStops: this.fb.array([]),
      destination: [null],
      vehicle_type_reason: ['', Validators.required],
      four_by_four_reason: ['']
    });

    // Set default Tel Aviv location
    this.cityService.getCity('תל אביב').subscribe((city) => {
      this.rideForm.patchValue({
        start_location: city,
        destination: city
      });
    });
  }

  private setupFormSubscriptions(): void {
    // Target type changes
    this.rideForm.get('target_type')?.valueChanges.subscribe(type => {
      if (type === 'other') {
        this.fetchDepartmentEmployees();
      } else {
        this.rideForm.get('target_employee_id')?.setValue(null);
      }
    });

    // Period changes
    this.rideForm.get('ride_period')?.valueChanges.subscribe(value => {
      this.onPeriodChange(value);
    });

    // Date and period changes for vehicle availability
    this.rideForm.get('ride_date')?.valueChanges.subscribe(() => {
      this.updateAvailableCars();
    });

    this.rideForm.get('ride_period')?.valueChanges.subscribe(() => {
      this.updateAvailableCars();
    });

    // Distance calculation subscriptions
    this.setupDistanceCalculationSubscriptions();

    // Vehicle type validation
    this.rideForm.get('vehicle_type')?.valueChanges.subscribe(value => {
      this.updateVehicleTypeValidation(value);
    });
  }

  private setupDistanceCalculationSubscriptions(): void {
    this.rideForm.get('stop')?.valueChanges.subscribe(() => {
      this.calculateRouteDistance();
    });

    this.extraStops.valueChanges.subscribe(() => {
      this.calculateRouteDistance();
    });

    this.rideForm.get('estimated_distance_km')?.valueChanges.subscribe((value) => {
      if (value ) {
        this.estimated_distance_with_buffer = +(value * 1.1).toFixed(2);
      }
    });
  }

 private calculateRouteDistance(): void {
  const startRaw = this.rideForm.get('start_location')?.value;
  const stopRaw = this.rideForm.get('stop')?.value;
  const extraStops = this.extraStops.value || [];

  if (!startRaw || !stopRaw) {
    this.resetDistanceValues();
    return;
  }

  const start = typeof startRaw === 'string' ? startRaw : startRaw.id;
  const stop = typeof stopRaw === 'string' ? stopRaw : stopRaw.id;

  if (!start || !stop || start === stop) {
    this.resetDistanceValues();
    return;
  }

const routeStops = [...extraStops.filter((id: string) => !!id), stop];
console.log('📦 Raw stop:', stopRaw, '| extraStops:', extraStops);


  this.fetchEstimatedDistance(start, routeStops);
}


  private resetDistanceValues(): void {
    this.fetchedDistance = null;
    this.estimated_distance_with_buffer = null;
    this.rideForm.get('estimated_distance_km')?.setValue(null, { emitEvent: false });
  }

  // Step navigation
  handleStep1Next(): void {
    const targetType = this.rideForm.get('target_type')?.value;
    const targetEmployeeId = this.rideForm.get('target_employee_id')?.value;

    if (!targetType || (targetType === 'other' && !targetEmployeeId)) {
      this.showStep1Error = true;
      return;
    }

    this.showStep1Error = false;
    this.step = 2;
  }

  canProceedToDetails(): boolean {
    const type = this.rideForm.get('target_type')?.value;
    const selectedEmp = this.rideForm.get('target_employee_id')?.value;

    if (type === 'self') return true;
    if (type === 'other' && selectedEmp) return true;
    return false;
  }

  // Data fetching methods
  private fetchVehicleTypes(): void {
    this.vehicleService.getVehicleTypes().subscribe(types => {
      this.vehicleTypes = types;
    });
  }

  private fetchCities(): void {
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

  private fetchDepartmentEmployees(): void {
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

  private loadVehicles(): void {
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
  }

  private loadPendingVehicles(): void {
    this.vehicleService.getPendingCars().subscribe({
      next: (response: any) => {
        console.log('Raw API response:', response);
        
        let pendingData: any[] = [];
        
        if (Array.isArray(response)) {
          pendingData = response;
        } else if (response && Array.isArray(response.data)) {
          pendingData = response.data;
        } else if (response && Array.isArray(response.pending_vehicles)) {
          pendingData = response.pending_vehicles;
        }

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

  private loadFuelType(vehicleId: string): void {
    this.vehicleService.getFuelTypeByVehicleId(vehicleId).subscribe({
      next: (res: FuelTypeResponse) => {
        this.vehicleFuelType = res.fuel_type;
        console.log('Fuel Type:', this.vehicleFuelType);
      },
      error: err => console.error('Failed to load fuel type', err)
    });
  }

  // Distance calculation methods
  private fetchEstimatedDistance(from: string, toArray: string[]): void {
    console.log('📍 Distance Params:', { from, toArray });

    if (!from || !toArray || toArray.length === 0) return;

    console.log(`🌍 Requesting route distance: ${from} → ${toArray.join(' → ')}`);
    this.isLoadingDistance = true;
  if(toArray) toArray = toArray.filter(to => to && typeof to === 'string' && to.trim() !== '');
    this.rideService.getRouteDistance(from, toArray).subscribe({
      next: (response) => {
        const realDistance = response.distance_km;
        console.log(`📏 Distance fetched: ${realDistance} km`);

        this.fetchedDistance = realDistance;
        this.estimated_distance_with_buffer = +(realDistance * 1.1).toFixed(2);
        
        this.rideForm.get('estimated_distance_km')?.setValue(realDistance, { emitEvent: false });
        this.isLoadingDistance = false;
        
        console.log(`Distance set: ${realDistance} km, Buffer: ${this.estimated_distance_with_buffer} km`);
      },
      error: (err) => {
        console.error('❌ Failed to fetch distance:', err);
        this.toastService.show('שגיאה בחישוב מרחק בין הערים', 'error');
        this.resetDistanceValues();
        this.isLoadingDistance = false;
      }
    });
  }

  // Vehicle management methods
  private updateAvailableCars(): void {
    const selectedType = this.rideForm.get('vehicle_type')?.value;
    if (selectedType) {
      this.availableCars = this.allCars.filter(car => car.type === selectedType);
    }
  }

  onRideTypeChange(): void {
    this.updateAvailableCars();
    this.rideForm.get('car')?.setValue('');

    if (this.availableCars.length === 0) {
      this.toastService.show('אין רכבים זמינים מסוג זה', 'error');
    }
  }

  private updateVehicleTypeValidation(value: string): void {
    const vehicleTypeReason = this.rideForm.get('vehicle_type_reason');
    
    if (value?.toLowerCase().includes('jeep') || 
        value?.toLowerCase().includes('van') || 
        value?.toLowerCase().includes('4x4')) {
      vehicleTypeReason?.setValidators([Validators.required]);
    } else {
      vehicleTypeReason?.clearValidators();
    }
    vehicleTypeReason?.updateValueAndValidity();
  }

  // Vehicle availability checking
  isPendingVehicle(vehicle_id: string): boolean {
    const rideDate = this.rideForm.get('ride_date')?.value;
    const ridePeriod = this.rideForm.get('ride_period')?.value;
    const startTime = this.rideForm.get('start_time')?.value;
    const endTime = this.rideForm.get('end_time')?.value;

    if (!rideDate || !ridePeriod || !vehicle_id || !startTime || !endTime) {
      return false;
    }

    const normalizedRideDate = this.normalizeDateString(rideDate);

    return this.pendingVehicles.some(pv => {
      const normalizedPendingDate = this.normalizeDateString(pv.date);
      
      const basicMatch = pv.vehicle_id === vehicle_id && 
                        normalizedPendingDate === normalizedRideDate;
      
      if (!basicMatch) {
        return false;
      }

      if (!pv.start_time || !pv.end_time) {
        console.log('Pending vehicle missing time data - blocking entire day for safety:', pv);
        return true;
      }

      const pendingEndTimeWithBuffer = this.addHoursToTime(pv.end_time, 2);
      
      const hasTimeOverlap = this.checkTimeOverlap(
        startTime, endTime,
        pv.start_time, pendingEndTimeWithBuffer
      );
      
      return hasTimeOverlap;
    });
  }

  // Time and date utility methods
  private addHoursToTime(timeString: string, hoursToAdd: number): string {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    date.setHours(date.getHours() + hoursToAdd);
    
    const newHours = date.getHours();
    const newMinutes = date.getMinutes();
    
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
  }

  private checkTimeOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);

    const end1Adjusted = end1Minutes < start1Minutes ? end1Minutes + 1440 : end1Minutes;
    const end2Adjusted = end2Minutes < start2Minutes ? end2Minutes + 1440 : end2Minutes;

    return start1Minutes < end2Adjusted && start2Minutes < end1Adjusted;
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
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return dateStr;
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.warn('Date normalization failed for:', dateStr);
      return dateStr;
    }
  }

  calculateMinDate(): string {
    const date = new Date();
    return date.toISOString().split('T')[0];
  }

  validYearRangeValidator(minYear: number, maxYear: number): ValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return null;
      const selectedYear = new Date(control.value).getFullYear();
      return selectedYear >= minYear && selectedYear <= maxYear ? null : { invalidYear: true };
    };
  }

  // Form period management
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

  // Extra stops management
  get extraStops(): FormArray {
    return this.rideForm.get('extraStops') as FormArray;
  }

  addExtraStop(): void {
    if (this.extraStops.length < 2) {
      this.extraStops.push(this.fb.control('', Validators.required));
    }
  }

  removeExtraStop(index: number): void {
    this.extraStops.removeAt(index);
  }

  // Display helpers
  getSelectedStopName(): string {
    const stopId = this.rideForm.get('stop')?.value;
    const city = this.cities.find(c => c.id === stopId);
    return city ? city.name : 'לא נבחרה תחנה';
  }

  getExtraStopNames(): string[] {
    const stopsArray = this.rideForm?.get('extraStops');
    if (!stopsArray || !Array.isArray(stopsArray.value)) return [];

    const stopIds = stopsArray.value;
    return stopIds
      .map((id: string) => {
        const city = this.cities.find(c => c.id === id);
        return city?.name || null;
      })
      .filter((name): name is string => !!name);
  }

  getVehicleTypes(): string[] {
    return [...new Set(this.allCars.map(car => car.type))];
  }

  // Inspector closure warning
  isDuringInspectorClosure(startTime: string): boolean {
    const startMinutes = this.timeToMinutes(startTime);
    const startRange = this.timeToMinutes('11:15');
    const endRange = this.timeToMinutes('12:15');
    return startMinutes >= startRange && startMinutes <= endRange;
  }

  confirmInspectorWarning(): void {
    this.showInspectorWarningModal = false;
    this.submit(true);
  }

  // Form submission
  submit(confirmedWarning = false): void {
    // Form validation
    if (this.rideForm.invalid) {
      this.rideForm.markAllAsTouched();
      this.toastService.show('יש להשלים את כל שדות הטופס כנדרש', 'error');
      this.logFormErrors();
      return;
    }

    // Vehicle validation
    const vehicleId = this.rideForm.get('car')?.value;
    if (!vehicleId) {
      this.toastService.show('יש לבחור רכב מהתפריט', 'error');
      return;
    }

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

    // Time validation
    if (ridePeriod === 'morning' && startTime && endTime && startTime >= endTime) {
      this.toastService.show('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'error');
      return;
    }

    // Inspector closure warning
    if (!confirmedWarning && ridePeriod === 'morning' && this.isDuringInspectorClosure(startTime)) {
      this.showInspectorWarningModal = true;
      return;
    }

    // User validation
    const user_id = localStorage.getItem('employee_id');
    if (!user_id) {
      this.toastService.show('שגיאת זיהוי משתמש - התחבר מחדש', 'error');
      return;
    }

    // Determine rider and requester IDs
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
    const formData = {
      user_id: rider_id, 
      override_user_id: requester_id, 
      ride_type: this.rideForm.get('ride_type')?.value,
      start_datetime,
      vehicle_id: vehicleId,
      end_datetime,
      start_location: this.rideForm.get('start_location')?.value.name,
      stop: this.rideForm.get('stop')?.value,
      extra_stops: this.extraStops.value,
      destination: this.rideForm.get('destination')?.value.name,
      estimated_distance_km: Number(distance),
      actual_distance_km: Number(this.estimated_distance_with_buffer),
      four_by_four_reason: this.rideForm.get('four_by_four_reason')?.value,
    };

    console.log('Ride data for backend:', formData);

    // Submit ride request
    this.rideService.createRide(formData, user_id).subscribe({
      next: (createdRide) => {
        this.toastService.show('הבקשה נשלחה בהצלחה! ✅', 'success');
        this.loadFuelType(formData.vehicle_id);
        this.showFuelTypeMessage();

        // Emit socket message
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

  private logFormErrors(): void {
    console.log('FORM IS INVALID. HERE ARE THE ERRORS:');
    Object.keys(this.rideForm.controls).forEach(key => {
      const control = this.rideForm.get(key);
      if (control && control.invalid) {
        console.log(`- Control '${key}' is invalid. Errors:`, control.errors);
      }
    });
  }

  private showFuelTypeMessage(): void {
    if(localStorage.getItem('role')=='employee')
      {   if (this.vehicleFuelType === 'electric') {
      this.toastService.showPersistent('אנא ודא כי הרכב טעון לפני ההחזרה.', 'neutral');
    } else if (this.vehicleFuelType === 'hybrid') {
      this.toastService.showPersistent('אנא ודא כי יש מספיק דלק וטעינה לפני ההחזרה.', 'neutral');
    } else if (this.vehicleFuelType === 'gasoline') {
      this.toastService.showPersistent('אנא ודא כי מיכל הדלק מלא לפני ההחזרה.', 'neutral');
    }}
 
  }

  // Form getters
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

  // Navigation methods
  goBack(): void {
    this.location.back();
  }

  close(): void {
    this.router.navigate(['/home']);
  }
}