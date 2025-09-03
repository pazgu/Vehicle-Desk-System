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
import { debounceTime, distinctUntilChanged } from 'rxjs/operators'; // ⭐️ ADDED: Operators for better performance

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
  minEndDate: string = '';
  estimated_distance_with_buffer: number = 0;
  rideRequestSub!: Subscription;
  vehicleTypes: string[] = [];
  isDayRide: boolean = true;
  rideTypeNote: string = '';
  isLoadingDistance = false;
  private isLoadingExistingRide: boolean = false;
  private originalEndTime: string = '';
  private originalStartTime: string = '';
  fetchedDistance: number | null = null;

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
    if (endDate && startDate !== endDate) {
      return null;
    }
    if (endMinutes < startMinutes) {
      return null;
    }
    if (endMinutes - startMinutes < 15) {
      return { invalidTimeRange: true };
    }

    return null;
  }
  private updateMinEndDate(): void {
    const startDate = this.rideForm.get('ride_date')?.value;
    if (startDate) {
      const nextDay = new Date(startDate);
      nextDay.setDate(nextDay.getDate() + 1);
      this.minEndDate = nextDay.toISOString().split('T')[0];
    }
  }

  private updateRideTypeNote(): void {
    const startDate = this.rideForm.get('ride_date')?.value;
    const endDate = this.rideForm.get('ride_date_night_end')?.value;
    const startTime = this.rideForm.get('start_time')?.value;
    const endTime = this.rideForm.get('end_time')?.value;

    if (startDate && startTime) {
      if (endDate && startDate !== endDate) {
        this.isDayRide = false;
        this.rideTypeNote = 'נסיעה ליותר מיום - נבחר תאריך סיום שונה';
        return;
      }

      if (endTime) {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);

        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes < startMinutes) {
          this.isDayRide = false;
          this.rideTypeNote = 'נסיעה יותר מיום - הנסיעה חוצה חצות';
          if (!endDate) {
            const nextDay = new Date(startDate);
            nextDay.setDate(nextDay.getDate() + 1);
            this.rideForm.get('ride_date_night_end')?.setValue(nextDay.toISOString().split('T')[0], { emitEvent: false });
          }
          return;
        }
      }

      this.isDayRide = true;
      this.rideTypeNote = 'נסיעה יומית - התחלה וסיום באותו היום';
      if (endDate && startDate === endDate) {
        this.rideForm.get('ride_date_night_end')?.setValue('', { emitEvent: false });
      }
    }
  }
  private ensureOriginalEndTimeAvailable(): void {
    if (this.originalEndTime && !this.filteredEndTimes.includes(this.originalEndTime)) {
      this.filteredEndTimes = [this.originalEndTime, ...this.filteredEndTimes.filter(time => time !== this.originalEndTime)];
    }
  }
  private updateFilteredEndTimes(startTime?: string): void {
    const currentStartTime = startTime || this.rideForm.get('start_time')?.value;

    if (!currentStartTime) {
      this.filteredEndTimes = [...this.timeOptions];
      this.ensureOriginalEndTimeAvailable();
      return;
    }

    if (this.isDayRide) {
      const [startHour, startMin] = currentStartTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;

      this.filteredEndTimes = this.timeOptions.filter(time => {
        const [timeHour, timeMin] = time.split(':').map(Number);
        const timeMinutes = timeHour * 60 + timeMin;
        return timeMinutes >= startMinutes + 15;
      });
      const currentEndTime = this.rideForm.get('end_time')?.value;
      if (currentEndTime && !this.filteredEndTimes.includes(currentEndTime)) {
        if (!this.isLoadingExistingRide && currentEndTime !== this.originalEndTime) {
          this.rideForm.get('end_time')?.setValue('');
        }
      }
    } else {
      this.filteredEndTimes = [...this.timeOptions];
    }
    this.ensureOriginalEndTimeAvailable();
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

    this.rideForm.get('start_time')?.valueChanges.subscribe(startTime => {
      if (!startTime) {
        this.filteredEndTimes = [...this.timeOptions];
        return;
      }
      this.updateRideTypeNote();
      this.updateFilteredEndTimes(startTime);
    });

    this.rideForm.get('ride_date')?.valueChanges.subscribe(() => {
      this.updateMinEndDate();
      this.updateRideTypeNote();
      this.filterAvailableVehicles();
    });

    this.rideForm.get('ride_date_night_end')?.valueChanges.subscribe((endDate) => {
      if (endDate) {
        const startDate = this.rideForm.get('ride_date')?.value;
        if (startDate && endDate === startDate) {
          this.toastService.show('בנסיעה ליותר מיום, תאריך הסיום חייב להיות שונה מתאריך ההתחלה', 'error');
          this.rideForm.get('ride_date_night_end')?.setValue(this.minEndDate, { emitEvent: false });
          return;
        }
      }
      this.updateRideTypeNote();
      this.updateFilteredEndTimes();
    });

    this.rideForm.get('end_time')?.valueChanges.subscribe(endTime => {
      this.updateRideTypeNote();
      this.filterAvailableVehicles();
      this.updateFilteredEndTimes();
    });

    this.setupDistanceCalculationSubscriptions();

    this.rideForm.get('vehicle_type')?.valueChanges.subscribe(value => {
    });
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
      ride_date_night_end: [''],
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
    });

    this.rideForm.get('vehicle_type')?.valueChanges.subscribe(value => {
      this.filterAvailableVehicles();
      this.rideForm.get('car')?.setValue('');
    });
  }

  private filterAvailableVehicles(): void {
    const vehicleType = this.rideForm.get('vehicle_type')?.value;
    const selectedDate = this.rideForm.get('ride_date')?.value;
    const startTime = this.rideForm.get('start_time')?.value;
    const endTime = this.rideForm.get('end_time')?.value;

    if (!vehicleType) {
      this.availableCars = [];
      return;
    }

    let filteredCars = this.allCars.filter(car =>
      car.type === vehicleType &&
      car.status === 'available' &&
      !car.freeze_reason
    );

    if (selectedDate && startTime && endTime) {
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
    this.isLoadingExistingRide = true;

    this.rideService.getRideById(this.rideId).subscribe({
      next: (ride) => {
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
        this.originalStartTime = startDate.toTimeString().slice(0, 5);
        this.originalEndTime = endDate.toTimeString().slice(0, 5);

        const selectedVehicle = this.allCars.find(car =>
          car.type === ride.vehicle_type && car.vehicle_model === ride.vehicle_model
        );

        if (!selectedVehicle) {
          this.toastService.show('הרכב שבוצעה בו ההזמנה אינו זמין יותר', 'error');
          return;
        }

        this.availableCars = this.allCars.filter(car =>
          car.status === 'available' && car.type === selectedVehicle.type
        );

        const isOvernightRide = startDate.toDateString() !== endDate.toDateString();
        const nightEndDate = isOvernightRide ? endDate.toISOString().split('T')[0] : '';
        const startDateStr = startDate.toISOString().split('T')[0];
        this.rideForm.get('ride_date')?.setValue(startDateStr);
        this.updateMinEndDate();

        this.rideForm.patchValue({
          ride_period: 'morning',
          ride_date: startDateStr,
          ride_date_night_end: nightEndDate,
          start_time: this.originalStartTime,
          end_time: this.originalEndTime,
          estimated_distance_km: parseFloat(ride.estimated_distance || '0'),
          ride_type: ride.ride_type || 'operational',
          vehicle_type: ride.vehicle_type,
          car: selectedVehicle.id,
          start_location: ride.start_location ?? 'מיקום התחלה לא ידוע',
          destination: ride.destination ?? 'יעד לא ידוע'
        });

        if (ride.stop) {
          this.cityService.getCityNameById(ride.stop).subscribe({
            next: city => {
              const cityName = city?.name ?? 'תחנה לא ידועה';
              this.stopName = cityName;
              this.rideForm.get('stop')?.setValue(ride.stop);
            },
            error: (err) => {
              this.stopName = 'תחנה לא ידועה';
              this.rideForm.get('stop')?.setValue('');
            }
          });
        }

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

        this.updateRideTypeNote();
        this.updateFilteredEndTimes();
        setTimeout(() => {
          this.isLoadingExistingRide = false;
        }, 100);
      },
      error: (err) => {
        this.isLoadingExistingRide = false;
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

  // ⭐️ IMPROVED: Single, consistent normalization function for all city inputs
  private getCityId(value: any): string | null {
    if (!value) return null;
    // If it's already a UUID, return it
    if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim())) {
      return value;
    }
    // If it's an object with an id, return the id
    if (typeof value === 'object' && value.id) {
      return value.id;
    }
    // If it's a string name, find the corresponding ID
    const city = this.cities.find(c => c.name === value);
    return city?.id || null;
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

  private setupDistanceCalculationSubscriptions(): void {
    // ⭐️ FIXED: Use debounceTime to avoid multiple rapid API calls
    this.rideForm.get('stop')?.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.calculateRouteDistance();
    });
    this.extraStops.valueChanges.pipe(debounceTime(300), distinctUntilChanged()).subscribe(() => {
      this.calculateRouteDistance();
    });
    this.rideForm.get('estimated_distance_km')?.valueChanges.subscribe((value) => {
      if (value) {
        this.estimated_distance_with_buffer = +(value * 1.1).toFixed(2);
      }
    });
  }

  // ⭐️ FIXED: Call the consistent normalization function before fetching
  private calculateRouteDistance(): void {
    const startRaw = this.rideForm.get('start_location')?.value;
    const stopRaw = this.rideForm.get('stop')?.value;

    const startId = this.getCityId(startRaw);
    const stopId = this.getCityId(stopRaw);

    const extraStopIds = this.extraStops.controls
      .map(ctrl => this.getCityId(ctrl.get('stop')?.value))
      .filter((id): id is string => !!id);

    // ✅ FIXED: Add the destination to the route calculation as the final stop
    const destinationId = this.getCityId(this.rideForm.get('destination')?.value);

    // ✅ NEW: Consolidate all stops into one array
    const allStops = [...extraStopIds, stopId, destinationId].filter((id): id is string => !!id);

    if (!startId || allStops.length === 0) {
      this.resetDistanceValues();
      return;
    }

    this.fetchEstimatedDistance(startId, allStops);
  }

  private resetDistanceValues(): void {
    this.fetchedDistance = null;
    this.estimated_distance_with_buffer = 0;
    this.rideForm.get('estimated_distance_km')?.setValue(null, { emitEvent: false });
  }

  private fetchEstimatedDistance(from: string, toArray: string[]): void {
    if (!from || !toArray || toArray.length === 0) return;
    this.isLoadingDistance = true;
    this.rideService.getRouteDistance(from, toArray).subscribe({
      next: (response) => {
        const realDistance = response.distance_km;
        this.fetchedDistance = realDistance;
        this.estimated_distance_with_buffer = +(realDistance * 1.1).toFixed(2);
        this.rideForm.get('estimated_distance_km')?.setValue(realDistance, { emitEvent: false });
        this.isLoadingDistance = false;
      },
      error: (err) => {
        console.error('❌ Failed to fetch distance:', err);
        this.toastService.show('שגיאה בחישוב מרחק בין הערים', 'error');
        this.resetDistanceValues();
        this.isLoadingDistance = false;
      }
    });
  }

  submit(): void {
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

    if (!this.isDayRide) {
      if (!endDate) {
        this.toastService.show('בנסיעה שיותר מיום חובה לבחור תאריך סיום', 'error');
        return;
      }
      if (endDate === startDate) {
        this.toastService.show('בנסיעה ליותר מיום, תאריך הסיום חייב להיות שונה מתאריך ההתחלה', 'error');
        return;
      }
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);

      if (endDateObj <= startDateObj) {
        this.toastService.show('בנסיעה שיותר מיום: תאריך הסיום חייב להיות לאחר תאריך ההתחלה', 'error');
        return;
      }
    }
    if (this.isDayRide) {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      if (endMinutes <= startMinutes || endMinutes - startMinutes < 15) {
        this.toastService.show('בנסיעה יומית: שעת הסיום חייבת להיות לפחות 15 דקות אחרי שעת ההתחלה', 'error');
        return;
      }
    }

    const rideDate = this.rideForm.get('ride_date')?.value;
    const nightEndDate = this.rideForm.get('ride_date_night_end')?.value;

    const start_datetime = `${rideDate}T${startTime}`;
    const end_datetime = `${nightEndDate || rideDate}T${endTime}`;

    // ⭐️ FIXED: Use the consistent normalization function for all location fields
    const startUUID = this.getCityId(this.rideForm.get('start_location')?.value);
    const stopUUID = this.getCityId(this.rideForm.get('stop')?.value);
    const extraStopsUUIDs = this.extraStops.controls
      .map(ctrl => this.getCityId(ctrl.get('stop')?.value))
      .filter((id): id is string => !!id);

    if (!startUUID || !stopUUID) {
      this.toastService.show('יש לבחור נקודת התחלה ונקודת עצירה תקפות', 'error');
      return;
    }

    const payload = {
      id: this.rideId,
      user_id: localStorage.getItem('employee_id'),
      vehicle_id: this.rideForm.get('car')?.value,
      ride_type: this.rideForm.get('ride_type')?.value,
      start_datetime,
      end_datetime,
      estimated_distance_km: this.rideForm.get('estimated_distance_km')?.value,
      start_location: startUUID,
      stop: stopUUID,
      extra_stops: extraStopsUUIDs,
      destination: this.getCityId(this.rideForm.get('destination')?.value), // ⭐️ FIXED: Normalize destination
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
      }
    });
  }

  close(): void {
    this.router.navigate(['/home']);
  }

  getFieldError(fieldName: string): string {
    const field = this.rideForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return 'שדה חובה';
      if (field.errors['min']) return 'ערך מינימלי לא תקין';
    }
    return '';
  }

  hasTimeRangeError(): boolean {
    if (!this.isDayRide) return false;
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