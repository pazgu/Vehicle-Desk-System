import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ReactiveFormsModule,
  FormsModule,
  FormArray,
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastService } from '../../../services/toast.service';
import { RideService } from '../../../services/ride.service';
import {
  MyRidesService,
  RebookRequest,
} from '../../../services/myrides.service';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../../services/vehicle.service';
import { SocketService } from '../../../services/socket.service';
import { CityService } from '../../../services/city.service';
import { Location } from '@angular/common';
import {
  FuelType,
  FuelTypeResponse,
} from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { ValidationErrors } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ButtonModule } from 'primeng/button';
import { QuotaIndicatorComponent } from '../../../ride-area/all-rides/quota-indicator/quota-indicator.component';
import { HostListener } from '@angular/core';
import { GuidelinesModalComponent } from '../../page-area/guidelines-modal/guidelines-modal.component';
import {
  AcknowledgmentService,
  RideAcknowledgmentPayload,
} from '../../../services/acknowledgment.service';
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
import { createRebookDateTimeValidator, timeStepValidator } from './home-utils/validators';
import {
  buildRideForm,
  resetRideForm,
  getRideFormControls,
} from './home-utils/form-helpers';
import {
  extractCityId,
  buildRouteStops,
  shouldResetDistance,
  applyDistanceBuffer,
  clearDistanceOnForm,
  isTelAviv,
  isTelAvivById
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
import { Supervisor } from '../../../models/user.model';
import {debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { createInspectorClosureTimeValidator } from './home-utils/validators';

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
    HttpClientModule,
    NgSelectModule,
    ButtonModule,
    GuidelinesModalComponent,
    QuotaIndicatorComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
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
  private destroy$ = new Subject<void>();

  rebookOriginalRideId: string | null = null;
  rideTypes = [
    { value: 'administrative', label: 'מנהלתית' },
    { value: 'operational', label: 'מבצעית' },
  ];
  supervisors: Supervisor[] = [];
  selectedSupervisor: string | null = null;
  departmentId = '';
  fuelTypeTranslations: { [key: string]: string } = {};
  isVIP = false;
  isSupervisor = false;
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
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this, this.checkVipStatus();
    this.currentUserId = getUserIdFromToken(
      localStorage.getItem('access_token')
    );
    this.departmentId = localStorage.getItem('department_id') || '';

    const role = localStorage.getItem('role');
    this.isSupervisor = role === 'supervisor';

    this.initializeComponent();
    if (this.currentUserId) {
      this.rideUserChecksService
        .checkUserBlock(this.currentUserId)
        .subscribe((result) => {
          this.currentUserBlocked = result.isBlocked;
          this.currentUserBlockExpirationDate = result.blockExpirationDate;
          if (this.currentUserBlocked) {
            this.disableDueToBlock = true;
            this.disableRequest = true;
            this.disableDueToDepartment = true;
            this.showBlockedUserMessage();
          }
        });

        this.rideUserChecksService
    .checkUserDepartment(this.currentUserId)
    .subscribe((result) => {
      if(result.disableDueToDepartment === true) {
         this.toastService.showPersistent(
            'לא ניתן לשלוח בקשה: אינך משויך למחלקה. יש ליצור קשר עם המנהל להשמה במחלקה.',
            'error'
          );
          this.disableRequest = true;
          this.disableDueToDepartment = true;
      }
      else{
        this.disableDueToDepartment = false;
        this.disableRequest = false;
      }
    });
    }

    this.myRidesService.getSupervisors(this.departmentId).subscribe({
      next: (data) => {
        this.supervisors = data;
      },
      error: (err) => console.error('Failed to load supervisors:', err),
    });

    this.myRidesService.checkPendingRebook().subscribe({
      next: (res) => {
        if (res.has_pending && !rebookData) {
          this.toastService.show(
            'יש נסיעות ממתינות לשחזור, יש להשלים את החידוש לפני הזמנת נסיעה חדשה',
            'error'
          );
          this.router.navigate(['/all-rides']);
        }
      },
      error: (err) => console.error(err),
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
    }

    this.vehicleService.getFuelTypeTranslations().subscribe({
      next: (translations) => {
        this.fuelTypeTranslations = translations;
      },
      error: (err) => {
        console.error('Failed to load fuel type translations:', err);
        this.fuelTypeTranslations = {
          electric: 'חשמלי',
          hybrid: 'היברידי',
          gasoline: 'בנזין',
        };
      },
    });
  }

    ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getFuelTypeLabel(fuelType: string): string {
    return this.fuelTypeTranslations[fuelType] || fuelType;
  }

  hasTouchedVehicleType(): boolean {
    const value = this.rideForm.get('vehicle_type')?.value;
    if (value) {
      return true;
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

  checkVipStatus(): void {
    this.myRidesService.isVip().subscribe({
      next: (res) => {
        this.isVIP = res.is_vip;
      },
      error: (err) => {
        console.error('Failed to check VIP status', err);
        this.isVIP = false;
      },
    });
  }
  hasValidTimesForRebook(): boolean {
  if (!this.isRebookMode) return true;
  
  const startHour = this.rideForm.get('start_hour')?.value;
  const startMinute = this.rideForm.get('start_minute')?.value;
  const endHour = this.rideForm.get('end_hour')?.value;
  const endMinute = this.rideForm.get('end_minute')?.value;
  
  return !!(startHour && startMinute !== null && startMinute !== '' && 
            endHour && endMinute !== null && endMinute !== '');
}
showTimeRequiredToast(): void {
  this.toastService.show(
    'יש להזין שעות התחלה וסיום לפני בחירת סוג רכב ורכב',
    'warning'
  );
}
onVehicleTypeClick(event: Event): void {
  if (this.isRebookMode && !this.hasValidTimesForRebook()) {
    event.preventDefault();
    event.stopPropagation();
    this.showTimeRequiredToast();
  }
}
toggleDropdown() {
  if (this.isRebookMode && !this.hasValidTimesForRebook()) {
    this.showTimeRequiredToast();
    return;
  }
  this.isDropdownOpen = !this.isDropdownOpen;
}



  canChooseVehicle(): boolean {
    const distance = this.rideForm.get('estimated_distance_km')?.value;
    const rideDate = this.rideForm.get('ride_date')?.value;
    const vehicleType = this.rideForm.get('vehicle_type')?.value;
    const rideDateNight = this.rideForm.get('ride_date_night_end')?.value;
    const period = this.rideForm.get('ride_period')?.value;
    if (period != 'morning') {
      if (distance && rideDateNight && vehicleType) {
        return true;
      } else {
        return false;
      }
    } else {
      if (distance && rideDate && vehicleType) {
        return true;
      } else {
        return false;
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
    this.rebookOriginalRideId = data.id;

    const extraStopsArray = this.rideForm.get('extraStops') as FormArray;
    extraStopsArray.clear();

    if (data.extra_stops && Array.isArray(data.extra_stops)) {
      data.extra_stops.forEach((stopId) => {
        extraStopsArray.push(this.fb.control(stopId));
      });
    }

    const start = new Date(data.start_datetime);
    const end = new Date(data.end_datetime);

    const now = new Date();

// if start time already passed -> push it to now and keep duration
if (start.getTime() < now.getTime()) {
  const durationMs = end.getTime() - start.getTime();

  const roundedNow = new Date(now);
  const minutes = roundedNow.getMinutes();
  const roundedMinutes = Math.ceil(minutes / 15) * 15;
  roundedNow.setMinutes(roundedMinutes % 60);
  if (roundedMinutes >= 60) roundedNow.setHours(roundedNow.getHours() + 1);
  roundedNow.setSeconds(0, 0);

  start.setTime(roundedNow.getTime());

  if (durationMs > 0) {
    end.setTime(roundedNow.getTime() + durationMs);
  }

 this.toastService.show(
  'שעת ההתחלה שבחרת כבר עברה, שינינו אותה לשעה הנוכחית. בדוק שהשעה החדשה מתאימה לך.',
  'error'
);

}

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

      start_hour: '',
      start_minute: '',
      end_hour: '',
      end_minute: '',

      start_time: null,
      end_time: null,

      approving_supervisor: data.approving_supervisor ?? null,
    });

    this.rideForm.setValidators([
      createInspectorClosureTimeValidator(),
      createRebookDateTimeValidator()
    ]);

    this.rideForm.updateValueAndValidity({ emitEvent: false });

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
  private refreshVehiclesIfReady(): void {
    const distance = this.rideForm.get('estimated_distance_km')?.value;
    const rideDate = this.rideForm.get('ride_date')?.value;
    const vehicleType = this.rideForm.get('vehicle_type')?.value;
    const rideDateNight = this.rideForm.get('ride_date_night_end')?.value;
    const period = this.rideForm.get('ride_period')?.value; 
    const startHour = this.rideForm.get('start_hour')?.value;
    const startMinute = this.rideForm.get('start_minute')?.value;
    const endHour = this.rideForm.get('end_hour')?.value;
    const endMinute = this.rideForm.get('end_minute')?.value;

    if (!distance || !rideDate || !vehicleType || 
        !startHour || !startMinute || !endHour || !endMinute) {
      return;
    }
    if (period === 'night' && !rideDateNight) {
      return;
    }
    const startDateTime = buildDateTime(rideDate, startHour, startMinute);
    const endDateTime = period === 'night' 
      ? buildDateTime(rideDateNight, endHour, endMinute)
      : buildDateTime(rideDate, endHour, endMinute);
    const isoDate = toIsoDate(rideDate);
    this.loadVehicles(distance, isoDate, vehicleType, startDateTime, endDateTime);
  }

  private openVehicleFrozenDialog(): void {
    const dialogData: ConfirmDialogData = {
      title: 'הרכב שנבחר אינו זמין',
      message: 'הרכב שבחרת מוקפא או אינו זמין כרגע. אנא בחר/י רכב אחר להזמנה.',
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
            user_id: order.user_id,
          }));
        } else {
          this.orders = [];
        }
      },
      error: (err: any) => {
        console.error('Error loading orders for quota:', err);
        this.orders = [];
      },
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
    this.rideForm = buildRideForm(this.fb, this.isRebookMode);
    this.setDefaultStartAndDestination();
   this.socketService.usersLicense$
  .pipe(takeUntil(this.destroy$))
  .subscribe((update) => {
    const { id, has_government_license, license_expiry_date } = update;
    const selfUserId =
      this.currentUserId ??
      getUserIdFromToken(localStorage.getItem('access_token'));
    const selectedUserId =
      this.rideForm.get('target_type')?.value === 'self'
        ? selfUserId
        : this.rideForm.get('target_employee_id')?.value;

    if (id !== selectedUserId) return;

    const expiryDate = license_expiry_date
      ? new Date(license_expiry_date)
      : null;
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
      console.warn('License is missing or expired via socket');
      this.toastService.showPersistent(
        'לא ניתן לשלוח בקשה: למשתמש שנבחר אין רישיון ממשלתי תקף. לעדכון פרטים יש ליצור קשר עם המנהל.',
        'error'
      );
    }
  });

this.socketService.usersBlockStatus$
  .pipe(takeUntil(this.destroy$))
  .subscribe((update) => {
    const { id, is_blocked, block_expires_at } = update;
    const selfUserId =
      this.currentUserId ??
      getUserIdFromToken(localStorage.getItem('access_token'));
    const selectedUserId =
      this.rideForm.get('target_type')?.value === 'self'
        ? selfUserId
        : this.rideForm.get('target_employee_id')?.value;
    if (id !== selectedUserId) return;

    this.disableDueToBlock = is_blocked;
    this.blockExpirationDate = block_expires_at
      ? block_expires_at.toISOString()
      : null;

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

  this.rideForm.get('target_type')?.valueChanges
    .pipe(takeUntil(this.destroy$))
    .subscribe(type => {
      if (this.currentUserBlocked) return;

      this.showStep1Error = false;
      this.toastService.clearAll();
      this.disableRequest = false;
      this.disableDueToBlock = false;
      this.disableDueToDepartment = false;
      this.blockExpirationDate = null;

      if (type === 'other') {
        this.fetchDepartmentEmployees();
        this.rideForm.get('target_employee_id')
          ?.setValue(null, { emitEvent: true });
      } else if (type === 'self') {
        if (this.currentUserId && !this.currentUserBlocked) {
          this.checkUserDepartment(this.currentUserId);
          this.checkGovernmentLicence(this.currentUserId);
        }
        this.rideForm.get('target_employee_id')
          ?.setValue(null, { emitEvent: false });
      }
    });

  this.rideForm.get('target_employee_id')?.valueChanges
    .pipe(takeUntil(this.destroy$))
    .subscribe(employeeId => {
      if (this.currentUserBlocked) return;

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

  this.rideForm.get('ride_period')?.valueChanges
    .pipe(takeUntil(this.destroy$))
    .subscribe(value => {
      this.onPeriodChange(value);
      this.updateAvailableCars();
      this.updateExtendedRideReasonValidation();
    });

  this.rideForm.get('ride_date')?.valueChanges
    .pipe(
      debounceTime(800),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    )
    .subscribe(() => this.refreshVehiclesIfReady());

  this.rideForm.get('ride_date_night_end')?.valueChanges
    .pipe(
      debounceTime(800),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    )
    .subscribe(() => this.refreshVehiclesIfReady());

  ['start_hour', 'start_minute', 'end_hour', 'end_minute'].forEach(control => {
    this.rideForm.get(control)?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.refreshVehiclesIfReady());
  });

  this.rideForm.get('vehicle_type')?.valueChanges
    .pipe(takeUntil(this.destroy$))
    .subscribe(value => {
      this.updateAvailableCars();
      this.updateVehicleTypeValidation(value);
    });

  this.setupDistanceCalculationSubscriptions();
  if (this.isRebookMode) {
  ['start_hour', 'start_minute'].forEach(control => {
    this.rideForm.get(control)?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {

        const startHour = this.rideForm.get('start_hour')?.value;
        const startMinute = this.rideForm.get('start_minute')?.value;
        const rideDate = this.rideForm.get('ride_date')?.value;

        if (startHour && startMinute && rideDate) {
          const now = new Date();
          const startDateTime = new Date(rideDate);
          startDateTime.setHours(parseInt(startHour, 10));
          startDateTime.setMinutes(parseInt(startMinute, 10));
          startDateTime.setSeconds(0, 0);

          if (startDateTime.getTime() <= now.getTime()) {
            this.rideForm.get('start_hour')?.setErrors({ pastTime: true });
          } else {
            const errors = this.rideForm.get('start_hour')?.errors;
            if (errors && errors['pastTime']) {
              delete errors['pastTime'];
              this.rideForm.get('start_hour')?.setErrors(
                Object.keys(errors).length > 0 ? errors : null
              );
            }
          }
        }

        
        this.rideForm.updateValueAndValidity({ emitEvent: false });
      });
  });
}

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

  this.rideForm.get('stop')?.valueChanges
    .pipe(takeUntil(this.destroy$))
    .subscribe(() => {
      this.extraStops.updateValueAndValidity();
      this.calculateRouteDistance();
    });

  this.extraStops.valueChanges
    .pipe(takeUntil(this.destroy$))
    .subscribe(() => {
      this.calculateRouteDistance();
    });

  this.rideForm.get('estimated_distance_km')?.valueChanges
    .pipe(
      debounceTime(800),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    )
    .subscribe(distance => {
      const rideDate = this.rideForm.get('ride_date')?.value;
      const vehicleType = this.rideForm.get('vehicle_type')?.value;
      const startHour = this.rideForm.get('start_hour')?.value;
      const startMinute = this.rideForm.get('start_minute')?.value;
      const endHour = this.rideForm.get('end_hour')?.value;
      const endMinute = this.rideForm.get('end_minute')?.value;

      if (distance && rideDate && vehicleType && startHour && startMinute && endHour && endMinute) {
        this.refreshVehiclesIfReady();
      } else if (distance && this.allCars.length > 0 && this.availableCars.length > 0) {
        this.updateAvailableCars();
      }
    });
}


  private calculateRouteDistance(): void {
    const startRaw = this.rideForm.get('start_location')?.value;
    const stopRaw = this.rideForm.get('stop')?.value;
    const extraStops = this.extraStops.value || [];

    const startId = extractCityId(startRaw);
    const stopId = extractCityId(stopRaw);

    if (!startId || !stopId) {
      this.resetDistanceValues();
      return;
    }

    const mainStopIsTelAviv = isTelAviv(stopRaw) || isTelAvivById(stopId, this.cities);
    const extraStopIsTelAviv = extraStops.some((s: string) => s && isTelAvivById(s, this.cities));
    
    const hasTelAvivAsStop = mainStopIsTelAviv || extraStopIsTelAviv;


    if (startId === stopId && extraStops.length === 0) {
      const oneWayDistance = 20;
      const roundTripDistance = oneWayDistance * 2;
      this.fetchedDistance = roundTripDistance;
      this.estimated_distance_with_buffer = +(roundTripDistance * 1.1).toFixed(2);
      this.rideForm.get('estimated_distance_km')?.setValue(roundTripDistance, { emitEvent: false });
      return;
    }

    const routeStops = buildRouteStops(extraStops, stopId);
    this.fetchEstimatedDistance(startId, routeStops, hasTelAvivAsStop);
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
      this.toastService.showPersistent(
        'לא ניתן להמשיך: המשתמש שנבחר אינו משויך למחלקה. יש ליצור קשר עם המנהל להשמה במחלקה.',
        'error'
      );
      return;
    }
    if (this.disableDueToBlock) {
      this.showBlockedUserMessage(this.blockExpirationDate);
      return;
    }
    if (this.disableRequest) {
      this.toastService.showPersistent(
        'לא ניתן לשלוח בקשה: למשתמש שנבחר אין רישיון ממשלתי תקף. לעדכון פרטים יש ליצור קשר עם המנהל.',
        'error'
      );
      return;
    }
    this.showStep1Error = false;
    this.step = 2;
  }
  canProceedToDetails(): boolean {
    const type = this.rideForm.get('target_type')?.value;
    const selectedEmp = this.rideForm.get('target_employee_id')?.value;
    if (type === 'self') {
      return (
        !this.disableRequest &&
        !this.disableDueToDepartment &&
        !this.currentUserBlocked
      );
    }
    if (type === 'other' && selectedEmp) {
      return (
        !this.disableDueToBlock &&
        !this.disableRequest &&
        !this.disableDueToDepartment
      );
    }
    return false;
  }
  private fetchVehicleTypes(): void {
    this.vehicleService.getVehicleTypes().subscribe((types) => {
      this.vehicleTypes = types;
    });
  }
  private fetchCities(): void {
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
      },
    });
  }

  private loadVehicles(
    distance: number,
    rideDate: string,
    vehicleType: string,
    startTime: string,
    endTime: string
  ): void {
    const request$ = this.isVIP
      ? this.vehicleService.getVIPVehiclesForNewRide(
          distance,
          rideDate,
          vehicleType,
          startTime,
          endTime
        )
      : this.vehicleService.getAllVehiclesForNewRide(
          distance,
          rideDate,
          vehicleType,
          startTime,
          endTime
        );

    request$.subscribe({
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
      error: (err) => console.error('Failed to load fuel type', err),
    });
  }

  private fetchEstimatedDistance(
    from: string,
    toArray: string[],
    hasTelAviv: boolean
  ): void {
    if (!from || !toArray || toArray.length === 0) return;
    this.isLoadingDistance = true;
    this.rideService.getRouteDistance(from, toArray).subscribe({
      next: (response) => {
        let realDistance = response.distance_km;

        if (hasTelAviv) {
          realDistance += 20;
        }

        this.fetchedDistance = realDistance;
        this.estimated_distance_with_buffer = +(realDistance * 1.1).toFixed(2);
        this.rideForm
          .get('estimated_distance_km')
          ?.setValue(realDistance);
        this.isLoadingDistance = false;
      },
      error: (err) => {
        console.error('Failed to fetch distance:', err);
        this.toastService.show('שגיאה בחישוב מרחק בין הערים', 'error');
        this.resetDistanceValues();
        this.isLoadingDistance = false;
      },
    });
  }

  private updateAvailableCars(): void {
    const selectedType = this.rideForm.get('vehicle_type')?.value;
    const carControl = this.rideForm.get('car');
    if (!selectedType) {
      this.availableCars = [];
      this.selectedCarId = '';
      carControl?.setValue(null, { emitEvent: false });
      return;
    }
    this.availableCars = this.allCars.filter((car) => car.type === selectedType);

if (carControl?.errors?.['noAvailableCars'] && this.availableCars.length > 0) {
  const errors = { ...(carControl.errors || {}) };
  delete errors['noAvailableCars'];
  carControl.setErrors(Object.keys(errors).length ? errors : null);
}

    if (this.availableCars.length === 0) {
  this.selectedCarId = '';
  carControl?.setValue(null, { emitEvent: false });

  carControl?.setErrors({ ...(carControl?.errors || {}), noAvailableCars: true });
  carControl?.markAsTouched();
  carControl?.markAsDirty();

  return;
}


    const firstRecommended = this.availableCars.find(
      (car) => car.is_recommended && !this.isPendingVehicle(car.id)
    );
    if (firstRecommended) {
      this.selectedCarId = firstRecommended.id;
      carControl?.setValue(firstRecommended.id, { emitEvent: false });
      carControl?.markAsDirty();
      carControl?.markAsTouched();
      this.loadFuelType(firstRecommended.id);
    } else {
      const firstAvailable = this.availableCars.find(
        (car) => !this.isPendingVehicle(car.id)
      );
      if (firstAvailable) {
        this.selectedCarId = firstAvailable.id;
        carControl?.setValue(firstAvailable.id, { emitEvent: false });
        carControl?.markAsDirty();
        carControl?.markAsTouched();
        this.loadFuelType(firstAvailable.id);
      } else {
        this.selectedCarId = '';
        carControl?.setValue(null, { emitEvent: false });
      }
    }
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

  const hasNoCarsError = carControl.errors?.['noAvailableCars'];
  const hasValidationErrors = carControl.invalid;

  return (
    (carControl.touched || carControl.dirty) &&
    (hasValidationErrors || hasNoCarsError)
  );
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
    const hasDistance = distance !== null && distance !== undefined && distance !== '';

    if (period !== 'morning') {
      if (hasDistance && rideDateNight && vehicleType) {
        const isoDate = toIsoDate(rideDate);
        this.loadVehicles(
          distance,
          isoDate,
          vehicleType,
          startDateTime,
          endDateTime
        );
      } else if (!isPrefilled) {
        this.toastService.show('אנא הזן תאריך ותחנה לפני סינון רכבים', 'error');
        this.availableCars = [];
        this.rideForm.get('car')?.setValue(null);
      }
    } else {
      if (hasDistance && rideDate && vehicleType) {
        const isoDate = toIsoDate(rideDate);
        this.loadVehicles(
          distance,
          isoDate,
          vehicleType,
          startDateTime,
          endDateTime
        );
      } else if (!isPrefilled) {
        this.toastService.show('אנא הזן תאריך ותחנה לפני סינון רכבים', 'error');
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
    const userContext = this.isCurrentUserContext()
      ? 'אתה חסום'
      : 'המשתמש שנבחר חסום';
    this.toastService.showPersistent(
      `לא ניתן לשלוח בקשה: לצערנו ${userContext} מהאתר ולא ניתן לבצע הזמנות ממשתמש זה${expiryMsg}.`,
      'error'
    );
  }
  private isCurrentUserContext(): boolean {
    return this.rideForm.get('target_type')?.value === 'self';
  }
  private validateRebookTimes(): boolean {
  const startHour = this.rideForm.get('start_hour')?.value;
  const startMinute = this.rideForm.get('start_minute')?.value;
  const endHour = this.rideForm.get('end_hour')?.value;
  const endMinute = this.rideForm.get('end_minute')?.value;
  const rideDate = this.rideForm.get('ride_date')?.value;

  if (!startHour || !startMinute || !endHour || !endMinute || !rideDate) {
    return false;
  }

  // בדיקה אם יש שגיאות של זמן סגירה
  if (this.rideForm.get('start_hour')?.errors?.['inspectorClosure'] ||
      this.rideForm.get('end_hour')?.errors?.['inspectorClosure']) {
    return false;
  }

  const now = new Date();
  const startDateTime = new Date(rideDate);
  startDateTime.setHours(parseInt(startHour, 10));
  startDateTime.setMinutes(parseInt(startMinute, 10));
  startDateTime.setSeconds(0, 0);

  if (startDateTime.getTime() <= now.getTime()) {
    this.toastService.show(
      'שעת ההתחלה שנבחרה כבר עברה. אנא בחר/י שעה עתידית.',
      'error'
    );
    return false;
  }

  return true;
}

  checkUserBlock(userId: string): void {
    if (!userId) {
      this.disableDueToBlock = false;
      return;
    }
    this.rideUserChecksService.checkUserBlock(userId).subscribe((result) => {
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
        'No employeeId provided for license check. Setting disableRequest to false.'
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
    this.selectedCarId = '';
    this.isDropdownOpen = false;
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
  onGuidelinesConfirmed(ev: {
    rideId: string;
    userId: string;
    timestamp: string;
  }) {
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
    if (this.isRebookMode && !this.validateRebookTimes()) {
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
    const ridePeriod = this.rideForm.get('ride_period')?.value as
      | 'morning'
      | 'night';
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

      this.loadVehicles(
        distance,
        isoDate,
        vehicleType,
        startDateTime,
        endDateTime
      );
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

    const approvingSupervisor = this.rideForm.get(
      'approving_supervisor'
    )?.value;

    const formData: RideFormPayload = {
      ...buildRideFormPayload({
        form: this.rideForm,
        riderId: rider_id,
        requesterId: requester_id,
        start_datetime,
        end_datetime,
        vehicleId,
        isExtendedRequest: this.isExtendedRequest,
        estimatedDistanceWithBuffer: this.estimated_distance_with_buffer,
      }),
      approving_supervisor: approvingSupervisor || null,
    };
    const role = localStorage.getItem('role');
    if (this.isRebookMode) {
      const rebookD = this.myRidesService.getRebookDatafromService();
      if (!rebookD) {
        console.error('rebookD is undefined');
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
          actual_distance_km: formData.actual_distance_km,
          user_id: formData.user_id,
          status: 'pending',
          submitted_at: new Date().toISOString(),
          approving_supervisor: formData.approving_supervisor || null,
        },
      };

      this.myRidesService.rebookReservation(payload).subscribe({
        next: (res) => {
          this.toastService.show('הנסיעה עודכנה בהצלחה', 'success');
          this.router.navigate(['/all-rides']);
          this.myRidesService.clearRebookData();
        },
        error: (err) => {
          this.toastService.show('שגיאה בעדכון הנסיעה', 'error');
        },
      });
    } else {
      if (role === 'employee') {
        this.rideService.createRide(formData, user_id).subscribe({
          next: (createdRide) => {
            this.orderSubmitted = true;
            this.loadFuelType(formData.vehicle_id);
            this.socketService.sendMessage('new_ride_request', {
              ...createdRide,
              user_id,
            });

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
    }
  }

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

  selectedCarId: string = '';
  isDropdownOpen: boolean = false;
  isRecommendedVehicle(vehicleId: string): boolean {
    const vehicle = this.availableCars.find(v => v.id === vehicleId);
    return vehicle?.is_recommended ?? false;
  }

  selectCar(carId: string) {
  if (this.isRebookMode && !this.hasValidTimesForRebook()) {
    this.showTimeRequiredToast();
    return;
  }

  if (this.isPendingVehicle(carId)) {
    return;
  }

  this.selectedCarId = carId;
  this.isDropdownOpen = false;

  const carControl = this.rideForm.get('car');
  carControl?.setValue(carId);
  carControl?.markAsDirty();
  carControl?.markAsTouched();

  this.loadFuelType(carId);
  const selectedCar = this.availableCars.find(c => c.id === carId);
  if (selectedCar && !selectedCar.is_recommended) {
    const recommendedCar = this.availableCars.find(c => c.is_recommended);
    if (recommendedCar) {
      this.toastService.show(
        `שים לב: בחרת רכב שאינו מומלץ. הרכב המומלץ למרחק זה הוא ${recommendedCar.vehicle_model}`,
        'info',
      );
    }
  }
}

  getSelectedCar(): any | undefined {
    return this.availableCars.find((car) => car.id === this.selectedCarId);
  }
 

  closeDropdown() {
    this.isDropdownOpen = false;
  }
  goBackToMyRides(): void {
    if (this.isRebookMode) {
      this.myRidesService.clearRebookData();
      this.router.navigate(['/all-rides']);
    }
  }
}
