import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RideService } from '../../services/ride.service';
import { ToastService } from '../../services/toast.service';
import { VehicleService } from '../../services/vehicle.service';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';
import { CityService } from '../../services/city.service';

interface City { id: string; name: string; }

@Component({
  selector: 'app-edit-ride',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-ride.component.html',
  styleUrl: './edit-ride.component.css'
})
export class EditRideComponent implements OnInit {
  cities: City[] = [];
  filteredEndTimes: string[] = [];
  stopName: string = 'תחנה 0 לא ידועה';
  status: string = 'pending';
  licenseCheckPassed: boolean = true;
  submittedAt: string = new Date().toISOString();
  rideForm!: FormGroup;
  rideId!: string;
  minDate: string = '';
  estimated_distance_with_buffer: number = 0;
  rideRequestSub!: Subscription; 
  vehicleTypes: string[] = [];
  
  // ✅ NEW: Add ride type indicator
  isDayRide: boolean = true;
  rideTypeNote: string = '';

  allCars: {
    id: string;
    plate_number: string;
    type: string;
    fuel_type: string;
    status: string;
    freeze_reason?: string | null;
    last_used_at?: string;
    mileage: number;
    image_url: string;
    vehicle_model: string;
  }[] = [];

  availableCars: typeof this.allCars = [];
  timeOptions: string[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private rideService: RideService,
    private toastService: ToastService,
    private vehicleService: VehicleService,
    private socketService: SocketService,
    private cityService: CityService
  ) {}

  // ✅ FIXED: Custom validator that properly handles overnight rides
  private endTimeValidator = (formGroup: FormGroup) => {
    const startTime = formGroup.get('start_time')?.value;
    const endTime = formGroup.get('end_time')?.value;
    const startDate = formGroup.get('ride_date')?.value;
    const endDate = formGroup.get('ride_date_night_end')?.value;
    
    if (!startTime || !endTime || !startDate) {
      return null;
    }

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    // Case 1: Different end date explicitly set - this is an overnight ride
    if (endDate && startDate !== endDate) {
      return null; // No time validation for explicit overnight rides
    }
    
    // Case 2: End time is before start time - this crosses midnight (overnight)
    if (endMinutes < startMinutes) {
      return null; // Allow overnight rides when end < start
    }
    
    // Case 3: Same day ride - validate minimum duration
    if (endMinutes - startMinutes < 15) {
      return { invalidTimeRange: true };
    }
    
    return null;
  }

  // ✅ ENHANCED: Better logic to detect night vs day rides
  private updateRideTypeNote(): void {
    const startDate = this.rideForm.get('ride_date')?.value;
    const endDate = this.rideForm.get('ride_date_night_end')?.value;
    const startTime = this.rideForm.get('start_time')?.value;
    const endTime = this.rideForm.get('end_time')?.value;

    console.log('updateRideTypeNote:', { startDate, endDate, startTime, endTime });

    if (startDate && startTime) {
      // Priority 1: Check if end date is explicitly set and different
      if (endDate && startDate !== endDate) {
        this.isDayRide = false;
        this.rideTypeNote = 'נסיעה יותר מיום - נבחר תאריך סיום שונה';
        console.log('Detected night ride - different end date');
        return;
      }
      
      // Priority 2: Check if end time suggests overnight ride (end < start)
      if (endTime) {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        console.log('Time comparison:', { startMinutes, endMinutes, isNight: endMinutes < startMinutes });
        
        if (endMinutes < startMinutes) {
          this.isDayRide = false;
          this.rideTypeNote = 'נסיעה יותר מיום - הנסיעה חוצה חצות';
          console.log('Detected night ride - end time before start time');
          
          // Auto-set end date to next day if not already set
          if (!endDate) {
            const nextDay = new Date(startDate);
            nextDay.setDate(nextDay.getDate() + 1);
            console.log('Auto-setting end date to:', nextDay.toISOString().split('T')[0]);
            this.rideForm.get('ride_date_night_end')?.setValue(nextDay.toISOString().split('T')[0], { emitEvent: false });
          }
          return;
        }
      }
      
      // Default: Day ride
      this.isDayRide = true;
      this.rideTypeNote = 'נסיעת יום - התחלה וסיום באותו היום';
      console.log('Detected day ride');
      
      // Clear end date for day rides (but only if it was the same as start date)
      if (endDate && startDate === endDate) {
        console.log('Clearing end date for day ride');
        this.rideForm.get('ride_date_night_end')?.setValue('', { emitEvent: false });
      }
    }
  }

  calculateMinDate(daysAhead: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.fetchCities();
    this.generateTimeOptions();
    this.rideId = this.route.snapshot.paramMap.get('id') || '';
    this.minDate = this.calculateMinDate(2);
    this.buildForm();
    this.fetchVehicleTypes();
    
    this.rideRequestSub = this.socketService.rideRequests$.subscribe((rideData) => {
      if (rideData) {
        this.toastService.show('🚗 התקבלה הזמנת נסיעה חדשה', 'success');
        const audio = new Audio('assets/sounds/notif.mp3');
        audio.play();
      }
    });

    // ✅ SEPARATED: Different time filtering for day vs night rides
    this.rideForm.get('start_time')?.valueChanges.subscribe(startTime => {
      if (!startTime) {
        this.filteredEndTimes = [...this.timeOptions];
        return;
      }
      
      // First update ride type to know what kind of ride this is
      this.updateRideTypeNote();
      
      if (this.isDayRide) {
        // DAY RIDE: Only show times after start + 15 minutes
        const [startHour, startMin] = startTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        
        this.filteredEndTimes = this.timeOptions.filter(time => {
          const [timeHour, timeMin] = time.split(':').map(Number);
          const timeMinutes = timeHour * 60 + timeMin;
          return timeMinutes >= startMinutes + 15;
        });
        
        // Reset end time if invalid for day ride
        const currentEndTime = this.rideForm.get('end_time')?.value;
        if (currentEndTime && !this.filteredEndTimes.includes(currentEndTime)) {
          this.rideForm.get('end_time')?.setValue('');
        }
      } else {
        // NIGHT RIDE: Show ALL times (no restrictions)
        this.filteredEndTimes = [...this.timeOptions];
      }
    });

    // ✅ NEW: Watch for date changes to update ride type note
    this.rideForm.get('ride_date')?.valueChanges.subscribe(() => {
      this.updateRideTypeNote();
      this.filterAvailableVehicles(); // Re-filter vehicles when date changes
    });

    this.rideForm.get('ride_date_night_end')?.valueChanges.subscribe(() => {
      this.updateRideTypeNote();
      // Update filtered times when end date changes
      const startTime = this.rideForm.get('start_time')?.value;
      if (startTime) {
        if (this.isDayRide) {
          const [startHour, startMin] = startTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          
          this.filteredEndTimes = this.timeOptions.filter(time => {
            const [timeHour, timeMin] = time.split(':').map(Number);
            const timeMinutes = timeHour * 60 + timeMin;
            return timeMinutes >= startMinutes + 15;
          });
        } else {
          this.filteredEndTimes = [...this.timeOptions];
        }
      }
    });

    this.rideForm.get('end_time')?.valueChanges.subscribe(endTime => {
      // Update ride type when end time changes
      this.updateRideTypeNote();
      
      // Re-filter available vehicles
      this.filterAvailableVehicles();
      
      // Update time options based on new ride type
      const startTime = this.rideForm.get('start_time')?.value;
      if (startTime) {
        if (this.isDayRide) {
          // DAY RIDE: Filter times
          const [startHour, startMin] = startTime.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          
          this.filteredEndTimes = this.timeOptions.filter(time => {
            const [timeHour, timeMin] = time.split(':').map(Number);
            const timeMinutes = timeHour * 60 + timeMin;
            return timeMinutes >= startMinutes + 15;
          });
        } else {
          // NIGHT RIDE: All times allowed
          this.filteredEndTimes = [...this.timeOptions];
        }
      }
    });

    // Load vehicles and then load ride data
    this.vehicleService.getAllVehicles().subscribe({
      next: (vehicles) => {
        this.allCars = vehicles.filter(v =>
          !!v.id &&
          !!v.type &&
          !!v.vehicle_model &&
          typeof v.mileage === 'number'
        );
        this.loadRide();
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת רכבים זמינים', 'error');
      }
    });
  }

  buildForm(): void {
    this.rideForm = this.fb.group({
      ride_period: ['morning'],
      ride_date: ['', Validators.required],
      ride_date_night_end: [''], // For overnight rides
      start_time: ['', Validators.required],
      end_time: ['', Validators.required],
      estimated_distance_km: [null, [Validators.required, Validators.min(1)]],
      ride_type: ['', Validators.required],
      vehicle_type: ['', Validators.required],
      car: [''],
      start_location: ['', Validators.required],
      stop: ['', Validators.required],
      destination: ['', Validators.required],
      extraStops: this.fb.array([])
    }); // ✅ REMOVED: Custom validator temporarily to test

    this.rideForm.get('estimated_distance_km')?.valueChanges.subscribe(() => {
      const d = this.rideForm.get('estimated_distance_km')?.value || 0;
      this.estimated_distance_with_buffer = +(d * 1.1).toFixed(2);
    });

    // ✅ ENHANCED: Filter available vehicles by type and availability for selected dates
    this.rideForm.get('vehicle_type')?.valueChanges.subscribe(value => {
      this.filterAvailableVehicles();
      this.rideForm.get('car')?.setValue('');
    });
  }

  // ✅ NEW: Filter vehicles by type and availability for selected date/time
  private filterAvailableVehicles(): void {
    const vehicleType = this.rideForm.get('vehicle_type')?.value;
    const selectedDate = this.rideForm.get('ride_date')?.value;
    const startTime = this.rideForm.get('start_time')?.value;
    const endTime = this.rideForm.get('end_time')?.value;
    
    if (!vehicleType) {
      this.availableCars = [];
      return;
    }

    // First filter by vehicle type and basic availability
    let filteredCars = this.allCars.filter(car => 
      car.type === vehicleType && 
      car.status === 'available' && 
      !car.freeze_reason
    );

    // ✅ TODO: Add logic here to check vehicle availability for specific date/time
    // This would require calling a service to check for conflicting bookings
    if (selectedDate && startTime && endTime) {
      // For now, we'll just use the basic filter
      // In a real implementation, you'd call a service like:
      // this.vehicleService.getAvailableVehicles(selectedDate, startTime, endTime, vehicleType)
      console.log('Filtering vehicles for date/time:', { selectedDate, startTime, endTime, vehicleType });
    }

    this.availableCars = filteredCars;
  }

  loadRide(): void {
    const user_id = localStorage.getItem('employee_id');
    if (!user_id) {
      this.toastService.show('שגיאת זיהוי משתמש - התחבר מחדש', 'error');
      this.router.navigate(['/login']);
      return;
    }

    this.rideService.getRideById(this.rideId).subscribe({
      next: (ride) => {
        console.log('Ride fetched, stop:', ride.stop);
        this.status = ride.status || 'pending';
        this.submittedAt = ride.submitted_at || new Date().toISOString();
        this.licenseCheckPassed = ride.license_check_passed ?? true;
        const isPending = ride.status && ride.status.toLowerCase() === 'pending';

        if (!isPending) {
          this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
          this.router.navigate(['/home']);
          return;
        }

        const startDate = new Date(ride.start_datetime);
        const endDate = new Date(ride.end_datetime);

        // Find vehicle by multiple fallbacks
        const selectedVehicle = this.allCars.find(car =>
          car.id === ride.vehicle_id ||
          car.vehicle_model === ride.vehicle ||
          car.fuel_type === ride.vehicle ||
          car.type === ride.vehicle
        );

        if (!selectedVehicle) {
          this.toastService.show('הרכב שבוצעה בו ההזמנה אינו זמין יותר', 'error');
          return;
        }

        // Filter available cars by type
        this.availableCars = this.allCars.filter(car =>
          car.status === 'available' && car.type === selectedVehicle.type
        );

        console.log('Selected Vehicle:', selectedVehicle);

        // Patch form values
        this.rideForm.patchValue({
          ride_period: 'morning',
          ride_date: startDate.toISOString().split('T')[0],
          start_time: startDate.toTimeString().slice(0, 5),
          end_time: endDate.toTimeString().slice(0, 5),
          estimated_distance_km: parseFloat(ride.estimated_distance || '0'),
          ride_type: ride.ride_type || 'operational',
          vehicle_type: selectedVehicle.type,
          car: selectedVehicle.id,
          start_location: ride.start_location ?? 'מיקום התחלה לא ידוע',
          destination: ride.destination ?? 'יעד לא ידוע'
        });

        // Load stop information
        if (ride.stop) {
          this.cityService.getCityNameById(ride.stop).subscribe({
            next: city => {
              const cityName = city?.name ?? 'תחנה לא ידועה';
              this.stopName = cityName;
              this.rideForm.get('stop')?.setValue(ride.stop);
            },
            error: (err) => {
              console.log('Error fetching city for stop:', ride.stop, err);
              this.stopName = 'תחנה לא ידועה';
              this.rideForm.get('stop')?.setValue('');
            }
          });
        }

        // Load extra stops
        if (ride.extra_stops && ride.extra_stops.length > 0) {
          while (this.extraStops.length > 0) {
            this.extraStops.removeAt(0);
          }
          
          ride.extra_stops.forEach((stopId: string) => {
            this.extraStops.push(
              this.fb.group({
                stop: [stopId, Validators.required]
              })
            );
          });
        }

        this.estimated_distance_with_buffer = +(parseFloat(ride.estimated_distance) * 1.1).toFixed(2);
        
        // Update ride type note after loading
        this.updateRideTypeNote();
      },
      error: (err) => {
        this.toastService.show('שגיאה בטעינת ההזמנה לעריכה', 'error');
        this.router.navigate(['/home']);
      }
    });
  }

  isCarDisabled(car: typeof this.allCars[0]): boolean {
    return car.status !== 'available' || !!car.freeze_reason;
  }

  private fetchVehicleTypes(): void {
    this.vehicleService.getVehicleTypes().subscribe(types => {
      this.vehicleTypes = types;
    });
  }

  generateTimeOptions(): void {
    const times: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour = h.toString().padStart(2, '0');
        const minute = m.toString().padStart(2, '0');
        times.push(`${hour}:${minute}`);
      }
    }
    this.timeOptions = times;
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

  getVehicleTypes(): string[] {
    return [...new Set(this.allCars.map(car => car.type))];
  }

  get extraStops(): FormArray {
    return this.rideForm.get('extraStops') as FormArray;
  }

  addExtraStop(): void {
    this.extraStops.push(
      this.fb.group({
        stop: ['', Validators.required]
      })
    );
  }

  removeExtraStop(index: number): void {
    this.extraStops.removeAt(index);
  }

  submit(): void {
    // ✅ SEPARATE VALIDATION: Check required fields
    const requiredFields = ['ride_type', 'ride_date', 'start_time', 'end_time', 'estimated_distance_km', 'vehicle_type', 'start_location', 'stop', 'destination'];
    const missingFields = requiredFields.filter(field => {
      const value = this.rideForm.get(field)?.value;
      return !value || (typeof value === 'string' && value.trim() === '');
    });

    if (missingFields.length > 0) {
      this.rideForm.markAllAsTouched();
      this.toastService.show('נא למלא את כל השדות הנדרשים', 'error');
      return;
    }

    const startTime = this.rideForm.get('start_time')?.value;
    const endTime = this.rideForm.get('end_time')?.value;
    const startDate = this.rideForm.get('ride_date')?.value;
    const endDate = this.rideForm.get('ride_date_night_end')?.value;

    // ✅ SEPARATE VALIDATION: Only validate day rides
    if (this.isDayRide) {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      // For day rides: end must be at least 15 minutes after start
      if (endMinutes <= startMinutes || endMinutes - startMinutes < 15) {
        this.toastService.show('בנסיעת יום: שעת הסיום חייבת להיות לפחות 15 דקות אחרי שעת ההתחלה', 'error');
        return;
      }
    }
    // ✅ NIGHT RIDES: No time validation needed

    const rideDate = this.rideForm.get('ride_date')?.value;
    const nightEndDate = this.rideForm.get('ride_date_night_end')?.value;

    // Build datetime strings
    const start_datetime = `${rideDate}T${startTime}`;
    const end_datetime = `${nightEndDate || rideDate}T${endTime}`;

    console.log('Submitting:', {
      type: this.isDayRide ? 'DAY' : 'NIGHT',
      start_datetime,
      end_datetime,
      nightEndDate
    });

    // Extract extra stops
    const extraStopsIds = this.extraStops.controls
      .map(control => control.get('stop')?.value)
      .filter(stopId => stopId && stopId.trim() !== '');

    const payload = {
      id: this.rideId,
      user_id: localStorage.getItem('employee_id'),
      vehicle_id: this.rideForm.get('car')?.value,
      ride_type: this.rideForm.get('ride_type')?.value,
      start_datetime,
      end_datetime,
      estimated_distance_km: this.rideForm.get('estimated_distance_km')?.value,
      start_location: this.rideForm.get('start_location')?.value,
      stop: this.rideForm.get('stop')?.value,
      extra_stops: extraStopsIds,
      destination: this.rideForm.get('destination')?.value,
      status: this.status,
      submitted_at: this.submittedAt,
      is_day_ride: this.isDayRide,
      ride_note: this.rideTypeNote
    };

    this.rideService.updateRide(this.rideId, payload).subscribe({
      next: () => {
        this.toastService.show('ההזמנה עודכנה בהצלחה ✅', 'success');
        this.router.navigate(['/home']);
      },
      error: () => {
        this.toastService.show('שגיאה בעדכון ההזמנה', 'error');
        console.log('Payload:', payload);
      }
    });
  }

  close(): void {
    this.router.navigate(['/home']);
  }

  // ✅ NEW: Helper method to get form control errors
  getFieldError(fieldName: string): string {
    const field = this.rideForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return 'שדה חובה';
      if (field.errors['min']) return 'ערך מינימלי לא תקין';
    }
    return '';
  }

  // ✅ SIMPLE: Helper method to check time validation only for day rides
  hasTimeRangeError(): boolean {
    if (!this.isDayRide) return false; // Night rides never have time range errors
    
    const startTime = this.rideForm.get('start_time')?.value;
    const endTime = this.rideForm.get('end_time')?.value;
    
    if (!startTime || !endTime) return false;
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    return endMinutes <= startMinutes || endMinutes - startMinutes < 15;
  }
}
