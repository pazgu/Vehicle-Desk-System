import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ReactiveFormsModule, FormsModule, FormArray } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastService } from '../../../services/toast.service';
import { RideService } from '../../../services/ride.service';
import { MyRidesService, RebookRequest } from '../../../services/myrides.service';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../../services/vehicle.service';
import { SocketService } from '../../../services/socket.service';
import { CityService } from '../../../services/city.service';
import { Location } from '@angular/common';
import { FuelType, FuelTypeResponse } from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { ValidationErrors } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ButtonModule } from 'primeng/button';
import { QuotaIndicatorComponent } from '../../../ride-area/all-rides/quota-indicator/quota-indicator.component';
import { HostListener } from '@angular/core';
import { GuidelinesModalComponent } from '../../page-area/guidelines-modal/guidelines-modal.component';
import { AcknowledgmentService, RideAcknowledgmentPayload } from '../../../services/acknowledgment.service';
import {
  generateTimeOptions,
  correctToNearestQuarter,
  isValidQuarterHourTime,
  calculateMinDate,
  buildDateTime,
  toIsoDate,
  setClosestQuarterHourTimeOnForm,
} from './home-utils/time-helpers';
import { getUserIdFromToken } from './home-utils/auth-helpers';
import { timeStepValidator } from './home-utils/validators';
import { buildRideForm, resetRideForm, getRideFormControls } from './home-utils/form-helpers';
import {
  extractCityId,
  buildRouteStops,
  shouldResetDistance,
  applyDistanceBuffer,
  clearDistanceOnForm,
} from './home-utils/route-helpers';
import { RideUserChecksService } from '../../../services/ride-user-checks.service';
import {
  PendingVehicle,
  Vehicle,
  normalizeVehiclesResponse,
  normalizePendingVehiclesResponse,
  filterAvailableCars,
  syncCarControlWithAvailableCars,
  isVehiclePendingForRide,
} from './home-utils/vehicle-helpers';
import {
  buildRideFormPayload,
  RideFormPayload,
  getRideSubmitErrorMessage,
  runPreSubmitChecks,
} from './home-utils/submit-helpers';
import {
  City,
  normalizeCitiesResponse,
  getSelectedStopNameFromList,
  getExtraStopNamesFromList,
} from './home-utils/city-helpers';
import { MatDialog } from '@angular/material/dialog';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../page-area/confirm-dialog/confirm-dialog.component';
import { RebookData } from '../../../services/myrides.service';

interface Employee { id: string; full_name: string; }




@Component({
    selector: 'app-new-ride',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, HttpClientModule, NgSelectModule, ButtonModule ,GuidelinesModalComponent, QuotaIndicatorComponent],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css']
})
export class NewRideComponent implements OnInit {
    timeOptions: string[] = [];
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
    orders: any[] = [];
    vehicleTypes: string[] = [];
    pendingVehicles: PendingVehicle[] = [];
    disableRequest: boolean = false;
    hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    quarterHours = ['00', '15', '30', '45'];
    orderSubmitted = false;
    showGuidelines = false;
    pendingConfirmation = false;
    createdRideId: string | null = null;
    disableDueToDepartment: boolean = false;
    departmentCheckCompleted: boolean = false;
    currentUserId: string | null = null;
    disableDueToBlock: boolean = false;
    blockExpirationDate: string | null = null;
    currentUserBlocked: boolean = false;
    currentUserBlockExpirationDate: string | null = null;
    isRebookMode = false;
    rebookOriginalRideId: string | null = null;

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private toastService: ToastService,
        private rideService: RideService,
        private vehicleService: VehicleService,
        private socketService: SocketService,
        private location: Location,
        private cityService: CityService,
        private myRidesService: MyRidesService,
        private cdr: ChangeDetectorRef,
        private acknowledgmentService: AcknowledgmentService,
        private rideUserChecksService: RideUserChecksService,  
        private dialog: MatDialog, 

    ) { }

   ngOnInit(): void {
  this.currentUserId = getUserIdFromToken(localStorage.getItem('access_token'));
  this.initializeComponent();
    if (this.currentUserId){
      this.rideUserChecksService.checkUserBlock(this.currentUserId).subscribe((result) => {
        this.currentUserBlocked = result.isBlocked;
        this.currentUserBlockExpirationDate = result.blockExpirationDate;
        if (this.currentUserBlocked) {
          this.disableDueToBlock = true;
          this.disableRequest = true;
          this.disableDueToDepartment = true;
          this.showBlockedUserMessage();

        }});
    }
   this.myRidesService.checkPendingRebook().subscribe({
  next: (res) => {
    if (res.has_pending && !rebookData) {
      this.toastService.show('יש נסיעות ממתינות לשחזור, יש להשלים את החידוש לפני הזמנת נסיעה חדשה', 'error');
      this.router.navigate(['/all-rides']);
    }
  },
  error: (err) => console.error(err)
});
  const rebookData = this.myRidesService.getRebookDatafromService();


  if (rebookData) {
    this.applyRebookData(rebookData);  
    this.rideForm.get('target_type')?.setValue('self');
      this.handleStep1Next();

  }
 

  
  this.loadUserOrders();
  const initialTargetType = this.rideForm.get('target_type')?.value;
  if (initialTargetType === 'self') {
    if (this.currentUserId) {
      this.checkUserDepartment(this.currentUserId);
      this.checkGovernmentLicence(this.currentUserId);
    } else {
      this.toastService.show('שגיאה: מזהה משתמש נוכחי לא נמצא.', 'error');
      this.disableRequest = true;
  }
}}
    hasTouchedVehicleType(): boolean {
        const value = this.rideForm.get('vehicle_type')?.value;
        if (value) {
            return true
        }
        return false;
    }

    @HostListener('window:beforeunload', ['$event'])
onBeforeUnload(e: BeforeUnloadEvent) {
  if (this.showGuidelines) {
    e.preventDefault();
    e.returnValue = '';
  }
}
    canChooseVehicle(): boolean {
        const distance = this.rideForm.get('estimated_distance_km')?.value;
        const rideDate = this.rideForm.get('ride_date')?.value;
        const vehicleType = this.rideForm.get('vehicle_type')?.value;
        const rideDateNight = this.rideForm.get('ride_date_night_end')?.value;
        const period = this.rideForm.get('ride_period')?.value;
        if (period != 'morning') {
            if (distance && rideDateNight && vehicleType) {
                return true
            } else {
                return false
            }
        }
        else {
            if (distance && rideDate && vehicleType) {
                return true
            } else {
                return false
            }
        }
    }

    

    private initializeComponent(): void {
  this.fetchVehicleTypes();
  this.minDate = calculateMinDate();
  this.initializeForm();
  this.setupFormSubscriptions();
  this.fetchCities();
  this.loadPendingVehicles();
  this.timeOptions = generateTimeOptions();
  setClosestQuarterHourTimeOnForm(this.rideForm, this.timeOptions);
}

private applyRebookData(data: RebookData): void {
  this.isRebookMode = true;
  this.rebookOriginalRideId = data.user_id;

  const extraStopsArray = this.rideForm.get('extraStops') as FormArray;
  extraStopsArray.clear();

  if (data.extra_stops && Array.isArray(data.extra_stops)) {
    data.extra_stops.forEach(stopId => {
      extraStopsArray.push(this.fb.control(stopId));
    });
  }

  const start = new Date(data.start_datetime);
  const end = new Date(data.end_datetime);
  const pad = (num: number) => num.toString().padStart(2, '0');

  this.rideForm.patchValue({
    start_location: data.start_location,
    stop: data.stop,               
    destination: data.destination,   

    ride_type: data.ride_type,
    estimated_distance_km: data.estimated_distance,

    four_by_four_reason: data.four_by_four_reason ?? '',
    extended_ride_reason: data.extended_ride_reason ?? '',

    car: null,

    ride_date: start.toISOString().split('T')[0],   
    start_hour: pad(start.getHours()),
    start_minute: pad(start.getMinutes()),
    end_hour: pad(end.getHours()),
    end_minute: pad(end.getMinutes()),

    start_time: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    end_time: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  });

}



private isVehicleFrozenError(err: any): boolean {
  const detail =
    err?.error?.detail ||
    err?.error?.message ||
    (typeof err?.error === 'string' ? err.error : '');

  if (typeof detail !== 'string') return false;

  const lower = detail.toLowerCase();

  return (
    lower.includes('selected vehicle is currently unavailable') || 
    lower.includes('vehicle is frozen') ||
    lower.includes('הרכב אינו זמין') ||       
    lower.includes('הרכב מוקפא')
  );
}

private openVehicleFrozenDialog(): void {
  const dialogData: ConfirmDialogData = {
    title: 'הרכב שנבחר אינו זמין',
    message:
      'הרכב שבחרת מוקפא או אינו זמין כרגע. אנא בחר/י רכב אחר להזמנה.',
    confirmText: 'הבנתי',
    cancelText: 'סגור',
    noRestoreText: '',
    isDestructive: false,
  };

  this.dialog.open(ConfirmDialogComponent, {
    width: '420px',
    height: 'auto',
    data: dialogData,
  });
}


    private loadUserOrders(): void {
        const userId = localStorage.getItem('employee_id');
        if (!userId) {
            this.orders = [];
            return;
        }
        this.myRidesService.getAllOrders(userId, {}).subscribe({
            next: (res: any) => {
                if (Array.isArray(res)) {
                    this.orders = res.map((order: any) => ({
                        ride_id: order.ride_id,
                        date: this.formatDateDisplay(order.start_datetime),
                        time: this.formatTimeDisplay(order.start_datetime),
                        type: order.vehicle,
                        distance: order.estimated_distance,
                        status: order.status.toLowerCase(),
                        start_datetime: order.start_datetime,
                        end_datetime: order.end_datetime,
                        submitted_at: order.submitted_at,
                        user_id: order.user_id
                    }));
                } else {
                    this.orders = [];
                }
            },
            error: (err: any) => {
                console.error('Error loading orders for quota:', err);
                this.orders = [];
            }
        });
    }

    private formatDateDisplay(datetime: string): string {
        if (!datetime) return '';
        const date = new Date(datetime);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    private formatTimeDisplay(datetime: string): string {
        if (!datetime) return '';
        const date = new Date(datetime);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
}

    private initializeForm(): void {
  this.rideForm = buildRideForm(this.fb);
  this.setDefaultStartAndDestination();
  this.socketService.usersLicense$.subscribe(update => {
  const { id, has_government_license, license_expiry_date } = update;
  const selfUserId =
    this.currentUserId ?? getUserIdFromToken(localStorage.getItem('access_token'));
  const selectedUserId =
    this.rideForm.get('target_type')?.value === 'self'
      ? selfUserId
      : this.rideForm.get('target_employee_id')?.value;

    if (id !== selectedUserId) return;

    const expiryDate = license_expiry_date ? new Date(license_expiry_date) : null;
    const now = new Date();

    const licenseValid =
      has_government_license === true &&
      expiryDate instanceof Date &&
      !isNaN(expiryDate.getTime()) &&
      expiryDate >= now;

    if (licenseValid) {
      this.disableRequest = false;
    } else {
      this.disableRequest = true;
      console.warn('🚫 License is missing or expired via socket');
      this.toastService.showPersistent(
        'לא ניתן לשלוח בקשה: למשתמש שנבחר אין רישיון ממשלתי תקף. לעדכון פרטים יש ליצור קשר עם המנהל.',
        'error'
      );
    }
  });
    this.socketService.usersBlockStatus$.subscribe(update => {
    const { id, is_blocked, block_expires_at } = update;
    const selfUserId =
      this.currentUserId ?? getUserIdFromToken(localStorage.getItem('access_token'));
    const selectedUserId =
      this.rideForm.get('target_type')?.value === 'self'
        ? selfUserId
        : this.rideForm.get('target_employee_id')?.value;
    if (id !== selectedUserId) return;
    this.disableDueToBlock = is_blocked;
    this.blockExpirationDate = block_expires_at ? block_expires_at.toISOString() : null;
    if (is_blocked) {
      this.disableRequest = true;
    } else {
      this.disableDueToBlock = false;
      this.blockExpirationDate = null;
      this.toastService.clearAll();
    }
    this.cdr.detectChanges();
  });
}
    get startTime() {
        const h = this.rideForm.get('start_hour')?.value;
        const m = this.rideForm.get('start_minute')?.value;
        return h && m ? `${h.padStart(2, '0')}:${m.padStart(2, '0')}` : null;
    }
    get endTime() {
        const h = this.rideForm.get('end_hour')?.value;
        const m = this.rideForm.get('end_minute')?.value;
        return h && m ? `${h.padStart(2, '0')}:${m.padStart(2, '0')}` : null;
    }
    
    get isExtendedRequest(): boolean {
        const period = this.rideForm.get('ride_period')?.value;
        const startDate = this.rideForm.get('ride_date')?.value;
        const endDate = this.rideForm.get('ride_date_night_end')?.value;
        if (period === 'night' && startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffInMs = end.getTime() - start.getTime();
            const diffInDays = diffInMs / (1000 * 60 * 60 * 24) + 1;
            return diffInDays >= 4;
        }
        return false;
    }
    private setupFormSubscriptions(): void {
    this.rideForm.get('target_type')?.valueChanges.subscribe(type => {
        if (this.currentUserBlocked) {
            return;
        }
        this.showStep1Error = false;
        this.toastService.clearAll();
        this.disableRequest = false;
        this.disableDueToBlock = false;
        this.disableDueToDepartment = false;
        this.blockExpirationDate = null;

        if (type === 'other') {
            this.fetchDepartmentEmployees();
            this.rideForm.get('target_employee_id')?.setValue(null, { emitEvent: true });
        } else if (type === 'self') {
            if (this.currentUserId && !this.currentUserBlocked) {
                this.checkUserDepartment(this.currentUserId);
                this.checkGovernmentLicence(this.currentUserId);
            }
            this.rideForm.get('target_employee_id')?.setValue(null, { emitEvent: false });
        }
    });
    this.rideForm.get('target_employee_id')?.valueChanges.subscribe(employeeId => {
        if (this.currentUserBlocked) {
            return;
        }
        const targetType = this.rideForm.get('target_type')?.value;
        this.toastService.clearAll();
        if (targetType === 'other' && employeeId) {
            this.disableRequest = false;
            this.disableDueToBlock = false;
            this.disableDueToDepartment = false;
            this.blockExpirationDate = null;
            this.checkUserDepartment(employeeId);
            this.checkGovernmentLicence(employeeId);
            this.checkUserBlock(employeeId);
        } else if (!employeeId) {
            this.disableRequest = false;
            this.disableDueToBlock = false;
            this.disableDueToDepartment = false;
            this.blockExpirationDate = null;
        }
    });
        this.rideForm.get('ride_period')?.valueChanges.subscribe(value => {
  this.onPeriodChange(value);
  this.updateAvailableCars();
  this.updateExtendedRideReasonValidation();
});
        this.rideForm.get('ride_date_night_end')?.valueChanges.subscribe(() => {
            this.updateExtendedRideReasonValidation();
        });
        this.setupDistanceCalculationSubscriptions();
        this.rideForm.get('vehicle_type')?.valueChanges.subscribe(value => {
            this.updateAvailableCars();
            this.updateVehicleTypeValidation(value);
        });
    }
    private updateExtendedRideReasonValidation(): void {
        const extendedReasonControl = this.rideForm.get('extended_ride_reason');
        
        if (this.isExtendedRequest) {
            extendedReasonControl?.setValidators([Validators.required]);
        } else {
            extendedReasonControl?.clearValidators();
            extendedReasonControl?.setValue('');
        }
        extendedReasonControl?.updateValueAndValidity();
    }
    private setupDistanceCalculationSubscriptions(): void {
  this.rideForm.get('stop')?.valueChanges.subscribe(() => {
  this.extraStops.updateValueAndValidity();
  this.calculateRouteDistance();
});


  this.extraStops.valueChanges.subscribe(() => {
    this.calculateRouteDistance();
  });

  this.rideForm.get('estimated_distance_km')?.valueChanges.subscribe((value) => {
    this.estimated_distance_with_buffer = applyDistanceBuffer(value);
  });
}
    private calculateRouteDistance(): void {
  const startRaw = this.rideForm.get('start_location')?.value;
  const stopRaw = this.rideForm.get('stop')?.value;
  const extraStops = this.extraStops.value || [];

  const startId = extractCityId(startRaw);
  const stopId = extractCityId(stopRaw);

  if (shouldResetDistance(startId, stopId)) {
    this.resetDistanceValues();
    return;
  }

  const routeStops = buildRouteStops(extraStops, stopId!);
  this.fetchEstimatedDistance(startId!, routeStops);
}

    private resetDistanceValues(): void {
  this.fetchedDistance = null;
  this.estimated_distance_with_buffer = null;
  clearDistanceOnForm(this.rideForm);
}

    handleStep1Next(): void {
        if (this.currentUserBlocked) {
            this.showBlockedUserMessage();
            return;
        }  
        const targetType = this.rideForm.get('target_type')?.value;
        const targetEmployeeId = this.rideForm.get('target_employee_id')?.value;
        if (!targetType || (targetType === 'other' && !targetEmployeeId)) {
            this.showStep1Error = true;
            return;
        }
        if (this.disableDueToDepartment) {
            this.toastService.showPersistent('לא ניתן להמשיך: המשתמש שנבחר אינו משויך למחלקה. יש ליצור קשר עם המנהל להשמה במחלקה.','error');
            return;
        }
        if (this.disableDueToBlock) {
            this.showBlockedUserMessage(this.blockExpirationDate);
            return;
        }
        if (this.disableRequest) {
            this.toastService.showPersistent('לא ניתן לשלוח בקשה: למשתמש שנבחר אין רישיון ממשלתי תקף. לעדכון פרטים יש ליצור קשר עם המנהל.', 'error');
            return;
        }
        this.showStep1Error = false;
        this.step = 2;
    }
    canProceedToDetails(): boolean {
        const type = this.rideForm.get('target_type')?.value;
        const selectedEmp = this.rideForm.get('target_employee_id')?.value;
        if (type === 'self') {
          return !this.disableRequest && !this.disableDueToDepartment && !this.currentUserBlocked;
        }
        if (type === 'other' && selectedEmp) {
          return !this.disableDueToBlock && 
                !this.disableRequest && 
                !this.disableDueToDepartment;
        }
        return false;
    }
    private fetchVehicleTypes(): void {
        this.vehicleService.getVehicleTypes().subscribe(types => {
            this.vehicleTypes = types;
        });
    } private fetchCities(): void {
  this.cityService.getCities().subscribe({
    next: (cities) => {
      this.cities = normalizeCitiesResponse(cities);
    },
    error: (err) => {
      console.error('Failed to fetch cities', err);
      this.toastService.show('שגיאה בטעינת ערים', 'error');
      this.cities = [];
    },
  });
}
    private fetchDepartmentEmployees(): void {
  if (!this.currentUserId) return;

  this.rideService.getDepartmentEmployees(this.currentUserId).subscribe({
    next: (employees) => {
      this.departmentEmployees = employees;
    },
    error: (err) => {
      console.error('Failed to load department employees', err);
      this.toastService.show('שגיאה בטעינת עובדים מהמחלקה', 'error');
    }
  });
}

    private loadVehicles(
  distance: number,
  rideDate: string,
  vehicleType: string,
  startTime: string,
  endTime: string
): void {
  this.vehicleService
    .getAllVehiclesForNewRide(distance, rideDate, vehicleType, startTime, endTime)
    .subscribe({
      next: (vehicles) => {
        this.allCars = normalizeVehiclesResponse(vehicles);
        this.updateAvailableCars();
      },
      error: () => {
        this.toastService.show('שגיאה בטעינת רכבים זמינים', 'error');
      },
    });
}

    private loadPendingVehicles(): void {
  this.vehicleService.getPendingCars().subscribe({
    next: (response: any) => {
      this.pendingVehicles = normalizePendingVehiclesResponse(response);
      this.updateAvailableCars();
    },
    error: (error) => {
      console.error('Error loading pending vehicles:', error);
      this.toastService.show('שגיאה בטעינת רכבים ממתינים', 'error');
    },
  });
}

    private loadFuelType(vehicleId: string): void {
        this.vehicleService.getFuelTypeByVehicleId(vehicleId).subscribe({
            next: (res: FuelTypeResponse) => {
                this.vehicleFuelType = res.fuel_type;
            },
            error: err => console.error('Failed to load fuel type', err)
        });
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
  private updateAvailableCars(): void {
  const selectedType = this.rideForm.get('vehicle_type')?.value;
  const carControl = this.rideForm.get('car');

  let filtered = filterAvailableCars(this.allCars, selectedType);

  filtered = filtered.filter(car => car.status === 'available');

  this.availableCars = filtered;

  syncCarControlWithAvailableCars(
    carControl,
    this.availableCars,
    (id: string) => this.isPendingVehicle(id)
  );
}


private setDefaultStartAndDestination(): void {
  this.cityService.getCity('תל אביב').subscribe((city) => {
    this.rideForm.patchValue({
      start_location: city,
      destination: city,
    });
  });
}

    shouldShowCarError(): boolean {
        const carControl = this.rideForm.get('car');
        if (!carControl) return false;
        const hasValidationErrors = carControl.invalid;
        const hasPendingError = carControl.errors?.['pending'];
        const hasRequiredError = carControl.errors?.['required'];
        return (carControl.touched || carControl.dirty) && (hasValidationErrors || hasPendingError || hasRequiredError);
    }
 onRideTypeChange(): void {
  const isPrefilled = this.isRebookMode;

  const distance = this.rideForm.get('estimated_distance_km')?.value;
  const rideDate = this.rideForm.get('ride_date')?.value;
  const vehicleType = this.rideForm.get('vehicle_type')?.value;
  const rideDateNight = this.rideForm.get('ride_date_night_end')?.value;
  const startHour = this.rideForm.get('start_hour')?.value;
  const startMinute = this.rideForm.get('start_minute')?.value;
  const endHour = this.rideForm.get('end_hour')?.value;
  const endMinute = this.rideForm.get('end_minute')?.value;
  const period = this.rideForm.get('ride_period')?.value;
  const startDateTime = buildDateTime(rideDate, startHour, startMinute);
  const endDateTime = buildDateTime(rideDate, endHour, endMinute);

  if (period !== 'morning') {
    if (distance && rideDateNight && vehicleType) {
      const isoDate = toIsoDate(rideDate);
      this.loadVehicles(distance, isoDate, vehicleType, startDateTime, endDateTime);
    } else if (!isPrefilled) {
      this.toastService.show('אנא הזן תאריך וסוג רכב לפני סינון רכבים', 'error');
      this.availableCars = [];
      this.rideForm.get('car')?.setValue(null);
    }
  } else {
    if (distance && rideDate && vehicleType) {
      const isoDate = toIsoDate(rideDate);
      this.loadVehicles(distance, isoDate, vehicleType, startDateTime, endDateTime);
    } else if (!isPrefilled) {
      this.toastService.show('אנא הזן תאריך וסוג רכב לפני סינון רכבים', 'error');
      this.availableCars = [];
      this.rideForm.get('car')?.setValue(null);
    }
  }
}

    private updateVehicleTypeValidation(value: string): void {
        const vehicleTypeReason = this.rideForm.get('four_by_four_reason');
        vehicleTypeReason?.clearValidators();
        vehicleTypeReason?.updateValueAndValidity();
    }
    isPendingVehicle(vehicle_id: string): boolean {
  const rideDate = this.rideForm.get('ride_date')?.value;
  const startTime = this.startTime;
  const endTime = this.endTime;

  if (!rideDate || !vehicle_id || !startTime || !endTime) {
    return false;
  }

  return isVehiclePendingForRide(
    vehicle_id,
    rideDate,
    startTime,
    endTime,
    this.pendingVehicles
  );
}
  private showBlockedUserMessage(expirationDate: string | null = null): void {
    const expiry = expirationDate || this.currentUserBlockExpirationDate;
    const expiryMsg = expiry
      ? ' עד תאריך ' + new Date(expiry).toLocaleDateString('he-IL')
      : '';
    const userContext = this.isCurrentUserContext() ? 'אתה חסום' : 'המשתמש שנבחר חסום';
    this.toastService.showPersistent(
      `לא ניתן לשלוח בקשה: לצערנו ${userContext} מהאתר ולא ניתן לבצע הזמנות${expiryMsg}.`,
      'error'
    );
}
  private isCurrentUserContext(): boolean {
    return this.rideForm.get('target_type')?.value === 'self';
}
  checkUserBlock(userId: string): void {
    if (!userId) {
      this.disableDueToBlock = false;
      return;
    }
    this.rideUserChecksService
      .checkUserBlock(userId)
      .subscribe((result) => {
        this.disableDueToBlock = result.isBlocked;
        this.blockExpirationDate = result.blockExpirationDate; 
        if (this.disableDueToBlock) {
          this.disableRequest = true;
          this.showBlockedUserMessage(this.blockExpirationDate);
        }
        this.cdr.detectChanges();
      });
}

    onTimeInput(event: Event, controlName: string): void {
  const input = event.target as HTMLInputElement;
  const time = input.value;

  if (time) {
    const correctedTime = correctToNearestQuarter(time);
    if (correctedTime !== time) {
      this.rideForm.get(controlName)?.setValue(correctedTime);
    }
  }
}

    validateTimeStep(controlName: string): void {
  const control = this.rideForm.get(controlName);
  if (control?.value) {
    const isValid = isValidQuarterHourTime(control.value);

    if (!isValid) {
      control.setErrors({ ...(control.errors || {}), invalidTimeStep: true });
    } else if (control.errors) {
      delete control.errors['invalidTimeStep'];
      if (Object.keys(control.errors).length === 0) {
        control.setErrors(null);
      }
    }
  }
}


    static timeStepValidator(control: AbstractControl): ValidationErrors | null {
  return timeStepValidator(control);
}
    onPeriodChange(value: string): void {
  const nightEndControl = this.rideForm.get('ride_date_night_end');
  const rideDateControl = this.rideForm.get('ride_date');

  if (value === 'night') {
    nightEndControl?.setValidators([Validators.required]);
    rideDateControl?.clearValidators(); 
  } else {
    nightEndControl?.clearValidators();
    nightEndControl?.setValue('');
    rideDateControl?.setValidators([Validators.required]);
  }

  rideDateControl?.updateValueAndValidity();
  nightEndControl?.updateValueAndValidity();
}

    get extraStops(): FormArray {
        return this.rideForm.get('extraStops') as FormArray;
    }
    addExtraStop(): void {
        if (this.extraStops.length < 2) {
            this.extraStops.push(this.fb.control('', Validators.required));
            this.extraStops.updateValueAndValidity();
        }
    }
    removeExtraStop(index: number): void {
        this.extraStops.removeAt(index);
        this.extraStops.updateValueAndValidity();

    }
    getSelectedStopName(): string {
  const stopId = this.rideForm.get('stop')?.value;
  return getSelectedStopNameFromList(stopId, this.cities);
}

    getExtraStopNames(): string[] {
  const stopsArray = this.rideForm?.get('extraStops');
  if (!stopsArray || !Array.isArray(stopsArray.value)) return [];

  const stopIds = stopsArray.value as string[];
  return getExtraStopNamesFromList(stopIds, this.cities);
}
    confirmInspectorWarning(): void {
        this.showInspectorWarningModal = false;
        this.submit(true);
    }

    checkGovernmentLicence(employeeId: string): void {
  if (!employeeId) {
    console.warn(
      '⚠️ No employeeId provided for license check. Setting disableRequest to false.'
    );
    this.disableRequest = false;
    return;
  }

  this.rideUserChecksService
    .checkGovernmentLicence(employeeId)
    .subscribe((isAllowed) => {
      this.disableRequest = !isAllowed;
    });
}

    checkUserDepartment(userId: string): void {
  if (!userId) {
    this.disableDueToDepartment = false;
    this.departmentCheckCompleted = true;
    return;
  }

  this.rideUserChecksService
    .checkUserDepartment(userId)
    .subscribe((result) => {
      this.disableDueToDepartment = result.disableDueToDepartment;
      this.disableRequest = result.disableRequest;
      this.departmentCheckCompleted = true;
      this.cdr.detectChanges();
    });
}
    resetOrderForm(): void {
  const wasBlockedUser = this.currentUserBlocked;
  resetRideForm(this.rideForm);
  this.step = 1;
  this.orderSubmitted = false;
  this.availableCars = [];
  this.showStep1Error = false;
  this.fetchedDistance = null;
  this.estimated_distance_with_buffer = null;
  if (!wasBlockedUser) {
    this.disableRequest = false;
    this.disableDueToBlock = false;
    this.disableDueToDepartment = false;
    this.blockExpirationDate = null;
  }
  this.setDefaultStartAndDestination();
  setClosestQuarterHourTimeOnForm(this.rideForm, this.timeOptions);
}
    openNewOrderForm(): void {
  this.resetOrderForm();
}
      onGuidelinesConfirmed(ev: { rideId: string; userId: string; timestamp: string }) {
    const rideId = ev.rideId || this.createdRideId;
    const userId = ev.userId || this.currentUserId;
    if (!rideId || !userId) {
      console.error('[ACK] Missing rideId or userId for acknowledgment', {
        rideId,
        userId,
      });
      this.toastService.show(
        'שגיאה: לא נמצא מזהה נסיעה או משתמש עבור אישור ההנחיות. נסה/י שוב.',
        'error'
      );
      return;
    }

    const payload: RideAcknowledgmentPayload = {
      ride_id: rideId,
      user_id: userId,
      confirmed: true,
      acknowledged_at: ev.timestamp,
      signature_data_url: null,
    };

    this.pendingConfirmation = true;
    this.acknowledgmentService.saveAcknowledgment(payload).subscribe({
      next: () => {
        this.pendingConfirmation = false;
        this.showGuidelines = false;
        this.toastService.show('אישור נקלט. נסיעה נעימה! ', 'success');
      },
      error: () => {
        this.pendingConfirmation = false;
        this.toastService.show('נרשמה שגיאה בשמירת האישור.', 'error');
        this.showGuidelines = false;
      },
    });
  }
        submit(confirmedWarning = false): void {
        if (this.currentUserBlocked) {
          this.showBlockedUserMessage();
          return;
        }
        const targetType = this.rideForm.get('target_type')?.value;
        const targetEmployeeId = this.rideForm.get('target_employee_id')?.value;
        const preCheckResult = runPreSubmitChecks({
            form: this.rideForm,
            disableDueToDepartment: this.disableDueToDepartment,
            disableRequest: this.disableRequest,
            allCars: this.allCars,
            pendingVehicles: this.pendingVehicles,
            isExtendedRequest: this.isExtendedRequest,
            confirmedWarning,
            toastService: this.toastService,
        });

        if (preCheckResult.blocked) {
            if (preCheckResult.showInspectorWarning) {
                this.showInspectorWarningModal = true;
            }
            return;
        }
        const ridePeriod = this.rideForm.get('ride_period')?.value as 'morning' | 'night';
const rideDate = this.rideForm.get('ride_date')?.value;
const nightEndDate = this.rideForm.get('ride_date_night_end')?.value;
const startTime = this.startTime;
const endTime = this.endTime;
const distance = this.rideForm.get('estimated_distance_km')?.value;
const vehicleType = this.rideForm.get('vehicle_type')?.value;
const vehicleId = this.rideForm.get('car')?.value;

if (!startTime || !endTime) {
  this.toastService.show('יש לבחור שעת התחלה ושעת סיום תקינה', 'error');
  return;
}

if (distance && rideDate && vehicleType) {
  const isoDate = new Date(rideDate).toISOString().split('T')[0];

  const startDateTime = `${rideDate} ${startTime}:00`;
  const endDateTime = `${rideDate} ${endTime}:00`;

  this.loadVehicles(distance, isoDate, vehicleType, startDateTime, endDateTime);
}
        const user_id = this.currentUserId;
        if (!user_id) {
            this.toastService.show('שגיאת זיהוי משתמש - התחבר מחדש', 'error');
            return;
        }
        let rider_id = user_id;
        let requester_id: string | null = null;
        if (targetType === 'other' && targetEmployeeId) {
            rider_id = targetEmployeeId;
            requester_id = user_id;
        }

        const start_datetime = `${rideDate}T${startTime}`;
        const end_datetime =
            ridePeriod === 'morning'
                ? `${rideDate}T${endTime}`
                : `${nightEndDate}T${endTime}`;

        const formData: RideFormPayload = buildRideFormPayload({
            form: this.rideForm,
            riderId: rider_id,
            requesterId: requester_id,
            start_datetime,
            end_datetime,
            vehicleId,
            isExtendedRequest: this.isExtendedRequest,
            estimatedDistanceWithBuffer: this.estimated_distance_with_buffer,
        });

        const role = localStorage.getItem('role');
          if (this.isRebookMode) {
            const rebookD=this.myRidesService.getRebookDatafromService()
            if (!rebookD) {
  console.error("rebookD is undefined");
  return;
}


  const payload: RebookRequest = {
    old_ride_id: rebookD.id,
    new_ride: {
      start_datetime: formData.start_datetime,
      end_datetime: formData.end_datetime,
      start_location: formData.start_location,
      destination: formData.destination,
      ride_type: formData.ride_type,
      stop: formData.stop,
      extra_stops: formData.extra_stops?.map((s: any) => s.id) || [],
      extended_ride_reason: formData.extended_ride_reason || undefined,
      four_by_four_reason: formData.four_by_four_reason || undefined,
      vehicle_id: formData.vehicle_id,
      estimated_distance_km: formData.estimated_distance_km,
      actual_distance_km:formData.actual_distance_km,
      user_id: formData.user_id,
      status: 'pending',
      submitted_at: new Date().toISOString(),
    }
  };

  this.myRidesService.rebookReservation(payload).subscribe({
    next: (res) => {
      this.toastService.show('הנסיעה עודכנה בהצלחה', 'success');
      this.router.navigate(['/all-rides']);
        this.myRidesService.clearRebookData();

    },
    error: (err) => {
      this.toastService.show('שגיאה בעדכון הנסיעה', 'error');
    }
  });

}else{
        if (role === 'employee') {
            this.rideService.createRide(formData, user_id).subscribe({
                next: (createdRide) => {
                    this.toastService.show('הבקשה נשלחה בהצלחה! ', 'success');
                    this.orderSubmitted = true;
                    this.loadFuelType(formData.vehicle_id);
                    this.socketService.sendMessage('new_ride_request', { ...createdRide, user_id });

                    this.loadUserOrders();

                    this.createdRideId =
                        createdRide?.id ??
                        createdRide?.ride_id ??
                        createdRide?.data?.id ??
                        'mock-ride';
                    this.showGuidelines = true;
                },
                  error: (err) => {
    if (this.isVehicleFrozenError(err)) {
      this.openVehicleFrozenDialog();
      return;
    }

    const translated = getRideSubmitErrorMessage(err);
    this.toastService.show(translated, 'error');
    console.error('Submit error:', err);
  },

            });
        } else if (role === 'supervisor') {
            this.rideService.createSupervisorRide(formData, user_id).subscribe({
                next: (createdRide) => {
                    this.toastService.show('הבקשה נשלחה בהצלחה! ', 'success');
                    this.orderSubmitted = true;

                    this.loadFuelType(formData.vehicle_id);

                    this.loadUserOrders();

                    this.createdRideId =
                        createdRide?.id ??
                        createdRide?.ride_id ??
                        createdRide?.data?.id ??
                        'mock-ride';
                    this.showGuidelines = true;
                },
                  error: (err) => {
    if (this.isVehicleFrozenError(err)) {
      this.openVehicleFrozenDialog();
      return;
    }

    const translated = getRideSubmitErrorMessage(err);
    this.toastService.show(translated, 'error');
    console.error('Submit error:', err);
  },

            });
        }
    }}

    get f() {
  return getRideFormControls(this.rideForm);
}

    goBack(): void {
        this.location.back();
    }
    close(): void {
        this.router.navigate(['/home']);
    }

    goBackToStep1(): void {
        this.step = 1;
        this.showStep1Error = false;
    }

    

    
}