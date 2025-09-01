import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn, FormControl, ReactiveFormsModule, FormsModule, FormArray } from '@angular/forms';
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
import { UserService } from '../../../services/user_service';
import { AuthService } from '../../../services/auth.service';
import { ValidationErrors } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { formatDate } from '@angular/common';

interface PendingVehicle { vehicle_id: string; date: string; period: string; start_time?: string; end_time?: string; }
interface Vehicle { id: string; plate_number: string; type: string; fuel_type: string; status: string; freeze_reason?: string | null; last_used_at?: string; mileage: number; image_url: string; vehicle_model: string; }
interface City { id: string; name: string; }
interface Employee { id: string; full_name: string; }

@Component({
    selector: 'app-new-ride',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule, HttpClientModule, NgSelectModule],
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
    vehicleTypes: string[] = [];
    pendingVehicles: PendingVehicle[] = [];
    disableRequest: boolean = false;
    hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    quarterHours = ['00', '15', '30', '45'];
    formReady = false;

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private toastService: ToastService,
        private rideService: RideService,
        private vehicleService: VehicleService,
        private socketService: SocketService,
        private location: Location,
        private cityService: CityService,
        private UserService: UserService,
        private AuthService: AuthService
    ) { }

    ngOnInit(): void {
        this.initializeComponent();
        const initialTargetType = this.rideForm.get('target_type')?.value;
        if (initialTargetType === 'self') {
            const currentUserId = this.getUserIdFromAuthService();
            if (currentUserId) {
                this.checkGovernmentLicence(currentUserId);
            } else {
                console.warn('Current user ID not found in AuthService during ngOnInit. Disabling request.');
                this.toastService.show('שגיאה: מזהה משתמש נוכחי לא נמצא.', 'error');
                this.disableRequest = true;
            }
        }
    }

    sameStopAndDestinationValidator(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const extraStopsArray = control as FormArray;
            if (!extraStopsArray || extraStopsArray.length === 0) {
                return null;
            }

            const destinationId = this.rideForm?.get('stop')?.value;
            const extraStopIds = extraStopsArray.value;

            if (extraStopIds.some((stopId: string) => stopId && stopId === destinationId)) {
                return { sameStopAsDestination: true };
            }
            const uniqueExtraStops = new Set(extraStopIds.filter((stopId: string) => stopId));
            if (uniqueExtraStops.size !== extraStopIds.filter((stopId: string) => stopId).length) {
                return { duplicateExtraStops: true };
            }

            return null;
        };
    }

    hasTouchedVehicleType(): boolean {
        const value = this.rideForm.get('vehicle_type')?.value;
        if (value) {
            return true
        }
        return false;
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
        this.minDate = this.calculateMinDate();
        this.initializeForm();
        this.setupFormSubscriptions();
        this.fetchCities();
        this.loadPendingVehicles();
        this.generateTimeOptions();
        this.setClosestQuarterHourTime();
    }
    private initializeForm(): void {
        this.rideForm = this.fb.group({
            target_type: ['self', Validators.required],
            target_employee_id: [null],
            ride_period: ['morning'],
            ride_date: ['', [Validators.required, this.validYearRangeValidator(2025, 2099)]],
            ride_date_night_end: [''],
            start_hour: ['', Validators.required],
            start_minute: ['', Validators.required],
            end_hour: ['', Validators.required],
            end_minute: ['', Validators.required],
            start_time: ['', Validators.required],
            end_time: ['', Validators.required],
            estimated_distance_km: [null, Validators.required],
            ride_type: ['', Validators.required],
            vehicle_type: ['', Validators.required],
            car: ['', Validators.required],
            start_location: [null],
            stop: ['', Validators.required],
            extraStops: this.fb.array([], this.sameStopAndDestinationValidator()),
            destination: [null],
            four_by_four_reason: ['']
        }, { 
            validators: [
        this.futureDateTimeValidator(),
        this.tripDurationValidator(),
        this.sameDayValidator(),
        this.sameDateNightRideValidator()
    ]
        });
        this.cityService.getCity('תל אביב').subscribe((city) => {
            this.rideForm.patchValue({
                start_location: city,
                destination: city
            });
        });
        this.socketService.usersLicense$.subscribe(update => {
            const { id, has_government_license, license_expiry_date } = update;
            const selectedUserId =
                this.rideForm.get('target_type')?.value === 'self'
                    ? this.getUserIdFromAuthService()
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
    }
    tripDurationValidator(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const formGroup = control as FormGroup;
            const ridePeriod = formGroup.get('ride_period')?.value;
            const rideDate = formGroup.get('ride_date')?.value;
            const nightEndDate = formGroup.get('ride_date_night_end')?.value;

            if (ridePeriod !== 'night' || !rideDate || !nightEndDate) {
                return null;
            }

            const startDate = new Date(rideDate);
            const endDate = new Date(nightEndDate);

            const timeDiff = endDate.getTime() - startDate.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

            if (daysDiff > 1) {
                return { 'tripTooLong': { message: 'לא ניתן להזמין נסיעה לותר מיום אחד.' } };
            }

            return null;
        };
    }

    sameDayValidator(): ValidatorFn {
        return (control: AbstractControl): ValidationErrors | null => {
            const formGroup = control as FormGroup;
            const ridePeriod = formGroup.get('ride_period')?.value;
            const rideDate = formGroup.get('ride_date')?.value;

            if (ridePeriod !== 'morning' || !rideDate) {
                return null;
            }

            const selectedDate = new Date(rideDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            selectedDate.setHours(0, 0, 0, 0);

            return null;
        };
    }
    sameDateNightRideValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
        const formGroup = control as FormGroup;
        const ridePeriod = formGroup.get('ride_period')?.value;
        const rideDate = formGroup.get('ride_date')?.value;
        const nightEndDate = formGroup.get('ride_date_night_end')?.value;

        if (ridePeriod !== 'night' || !rideDate || !nightEndDate) {
            return null;
        }

        const startDate = new Date(rideDate);
        const endDate = new Date(nightEndDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        if (startDate.getTime() === endDate.getTime()) {
            return { 
                'sameDateNightRide': { 
                    message: 'נסיעה מעבר ליום חייבת להיות בין שני תאריכים שונים.' 
                } 
            };
        }
        return null;
    };
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
    generateTimeOptions() {
        for (let hour = 0; hour < 24; hour++) {
            for (let minutes of [0, 15, 30, 45]) {
                const formatted = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                this.timeOptions.push(formatted);
            }
        }
    }
    getUserIdFromAuthService(): string | null {
        const token = localStorage.getItem('access_token');
        if (!token) {
            return null;
        }
        try {
            const payloadJson = atob(token.split('.')[1]);
            const payload = JSON.parse(payloadJson);
            return payload.sub || null;
        } catch (err) {
            console.error('[GET USER ID] Error parsing token payload:', err);
            return null;
        }
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
            return diffInDays >= 3;
        }
        return false;
    }
    setClosestQuarterHourTime() {
        const now = new Date();
        now.setHours(now.getHours() + 2);
        const minutes = now.getMinutes();
        const remainder = minutes % 15;
        const addMinutes = remainder === 0 ? 15 : 15 - remainder;
        now.setMinutes(minutes + addMinutes);
        now.setSeconds(0);
        now.setMilliseconds(0);
        const startHour = now.getHours();
        const startMinute = now.getMinutes();
        let endHour = startHour + 1;
        let endMinute = startMinute;
        if (endHour >= 24) {
            endHour = 0;
        }
        const format = (num: number) => num.toString().padStart(2, '0');
        const formattedStartTime = `${format(startHour)}:${format(startMinute)}`;
        const startTimeIndex = this.timeOptions.indexOf(formattedStartTime);
        const formattedEndTime = this.timeOptions[startTimeIndex + 1] || `${format(endHour)}:${format(endMinute)}`;
        this.rideForm.patchValue({
            start_time: formattedStartTime,
            end_time: formattedEndTime,
            start_hour: format(startHour),
            start_minute: format(startMinute),
            end_hour: format(endHour),
            end_minute: format(endMinute),
        });
    }
    private setupFormSubscriptions(): void {
        this.rideForm.get('target_type')?.valueChanges.subscribe(type => {
            if (type === 'other') {
                this.fetchDepartmentEmployees();
                this.rideForm.get('target_employee_id')?.setValue(null, { emitEvent: true });
            } else {
                const currentUserId = this.getUserIdFromAuthService();
                if (currentUserId) {
                    this.checkGovernmentLicence(currentUserId);
                } else {
                    console.warn('Current user ID not found in AuthService (target_type subscription). Disabling request.');
                    this.toastService.show('שגיאה: מזהה משתמש נוכחי לא נמצא.', 'error');
                    this.disableRequest = true;
                } this.rideForm.get('target_employee_id')?.setValue(null, { emitEvent: false });
            }
        });
        this.rideForm.get('target_employee_id')?.valueChanges.subscribe(employeeId => {
            const targetType = this.rideForm.get('target_type')?.value;
            if (targetType === 'other' && employeeId) {
                this.checkGovernmentLicence(employeeId);
            } else if (!employeeId) {
                this.disableRequest = false;
            }
        });
        this.rideForm.get('ride_period')?.valueChanges.subscribe(value => {
            this.onPeriodChange(value);
        });
        this.rideForm.get('ride_date')?.valueChanges.subscribe(() => {
            this.updateAvailableCars();
        });
        this.rideForm.get('ride_period')?.valueChanges.subscribe(() => {
            this.updateAvailableCars();
        });
        this.setupDistanceCalculationSubscriptions();
        this.rideForm.get('vehicle_type')?.valueChanges.subscribe(value => {
            this.updateVehicleTypeValidation(value);
        });
        this.rideForm.get('stop')?.valueChanges.subscribe(() => {
            this.extraStops.updateValueAndValidity();
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
            if (value) {
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
        let routeStops = [...extraStops];
        routeStops = routeStops.filter((id: string) => !!id && typeof id === 'string' && id.trim() !== '');
        routeStops.push(stop);
        this.fetchEstimatedDistance(start, routeStops);
    }
    private resetDistanceValues(): void {
        this.fetchedDistance = null;
        this.estimated_distance_with_buffer = null;
        this.rideForm.get('estimated_distance_km')?.setValue(null, { emitEvent: false });
    }
    handleStep1Next(): void {
        const targetType = this.rideForm.get('target_type')?.value;
        const targetEmployeeId = this.rideForm.get('target_employee_id')?.value;
        if (!targetType || (targetType === 'other' && !targetEmployeeId)) {
            this.showStep1Error = true;
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
        if (type === 'self') return true;
        if (type === 'other' && selectedEmp) return true;
        return false;
    }
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
        const currentUserId = this.getUserIdFromAuthService();
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
    private loadVehicles(distance: number, rideDate: string, vehicleType: string): void {
        this.vehicleService.getAllVehiclesForNewRide(distance, rideDate, vehicleType).subscribe({
            next: (vehicles) => {
                this.allCars = vehicles
                    .filter(v =>
                        v.status === 'available' &&
                        !!v.id &&
                        !!v.type &&
                        !!v.plate_number &&
                        typeof v.mileage === 'number')
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
    private formatDateForComparison(dateStr: string): string {
        const date = new Date(dateStr);
        return formatDate(date, 'dd.MM.yyyy', 'en-US');
    }
    private updateAvailableCars(): void {
        const selectedType = this.rideForm.get('vehicle_type')?.value;
        this.availableCars = this.allCars.filter(car =>
            car.type === selectedType &&
            (car as any).can_order !== false &&
            !this.isPendingVehicle(car.id));
        const rideDate = this.rideForm.get('ride_date')?.value;
        const startTime = this.rideForm.get('start_time')?.value;
        const endTime = this.rideForm.get('end_time')?.value;
        if (rideDate && startTime && endTime) {
            const storedOrders = localStorage.getItem('user_orders');
            const existingOrders = storedOrders ? JSON.parse(storedOrders) : [];
            this.availableCars = this.availableCars.filter(car =>
                !existingOrders.some((order: any) =>
                    order.type === car.type &&
                    order.date === this.formatDateForComparison(rideDate) &&
                    order.status === 'approved'));
        }
        else {
            this.availableCars = [];
        }
        const carControl = this.rideForm.get('car');
        if (this.availableCars.length === 1) {
            const onlyCar = this.availableCars[0];
            carControl?.setValue(onlyCar.id);
            carControl?.markAsTouched();
            carControl?.updateValueAndValidity();
            if (carControl?.errors?.['pending'] && !this.isPendingVehicle(onlyCar.id)) {
                carControl.setErrors(null);
                carControl.updateValueAndValidity();
            }
        } else {
            const selectedCar = carControl?.value;
            if (selectedCar && !this.availableCars.some(car => car.id === selectedCar)) {
                carControl?.setValue(null);
            }
            if (this.availableCars.length === 0) {
                if (selectedCar !== null) {
                    carControl?.setValue(null);
                    carControl?.markAsTouched();
                    carControl?.markAsDirty();
                    carControl?.setErrors({ required: true });
                }
                if (carControl && (carControl.touched || carControl.dirty) && !carControl.value) {
                    carControl?.setErrors({ required: true });
                }
            }
        }
        const carId = carControl?.value;
        if (carId && this.isPendingVehicle(carId)) {
            carControl?.setErrors({ pending: true });
            carControl?.markAsTouched();
            carControl?.markAsDirty();
        } else if (carControl?.errors?.['pending'] && !this.isPendingVehicle(carId)) {
            carControl.setErrors(null);
            carControl.updateValueAndValidity();
        }
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
        const distance = this.rideForm.get('estimated_distance_km')?.value;
        const rideDate = this.rideForm.get('ride_date')?.value;
        const vehicleType = this.rideForm.get('vehicle_type')?.value;
        const rideDateNight = this.rideForm.get('ride_date_night_end')?.value;
        const period = this.rideForm.get('ride_period')?.value;
        if (period != 'morning') {
            if (distance && rideDateNight && vehicleType) {
                const isoDate = new Date(rideDate).toISOString().split('T')[0];
                this.loadVehicles(distance, isoDate, vehicleType);
            } else {
                this.toastService.show('אנא הזן מרחק, תאריך וסוג רכב לפני סינון רכבים', 'error');
                this.availableCars = [];
                this.rideForm.get('car')?.setValue(null);
            }
        }
        else {
            if (distance && rideDate && vehicleType) {
                const isoDate = new Date(rideDate).toISOString().split('T')[0];
                this.loadVehicles(distance, isoDate, vehicleType);
            } else {
                this.toastService.show('אנא הזן מרחק, תאריך וסוג רכב לפני סינון רכבים', 'error');
                this.availableCars = [];
                this.rideForm.get('car')?.setValue(null);
            }
        }
    }
    private updateVehicleTypeValidation(value: string): void {
        const vehicleTypeReason = this.rideForm.get('four_by_four_reason');
        if (value?.toLowerCase().includes('jeep') ||
            value?.toLowerCase().includes('van') ||
            value?.toLowerCase().includes('4x4')) {
            vehicleTypeReason?.setValidators([Validators.required]);
        } else {
            vehicleTypeReason?.clearValidators();
        }
        // vehicleTypeReason?.updateValueAndValidity();
        // const fourByFourReason = this.rideForm.get('four_by_four_reason');
        // if (!value?.toLowerCase().includes('4x4')) {
        //     fourByFourReason?.setValue('');
        // }
    }
    isPendingVehicle(vehicle_id: string): boolean {
        const rideDate = this.rideForm.get('ride_date')?.value;
        const ridePeriod = this.rideForm.get('ride_period')?.value;
        const startTime = this.startTime;
        const endTime = this.endTime;
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
                return true;
            }
            const pendingEndTimeWithBuffer = this.addHoursToTime(pv.end_time, 2);
            const hasTimeOverlap = this.checkTimeOverlap(
                startTime, endTime,
                pv.start_time, pendingEndTimeWithBuffer);
            return hasTimeOverlap;
        });
    }
    onTimeInput(event: Event, controlName: string): void {
        const input = event.target as HTMLInputElement;
        const time = input.value;
        if (time) {
            const correctedTime = this.correctToNearestQuarter(time);
            if (correctedTime !== time) {
                this.rideForm.get(controlName)?.setValue(correctedTime);
            }
        }
    }
    validateTimeStep(controlName: string): void {
        const control = this.rideForm.get(controlName);
        if (control?.value) {
            const isValid = this.isValidQuarterHourTime(control.value);
            if (!isValid) {
                control.setErrors({ ...control.errors, invalidTimeStep: true });
            } else {
                if (control.errors) {
                    delete control.errors['invalidTimeStep'];
                    if (Object.keys(control.errors).length === 0) {
                        control.setErrors(null);
                    }
                }
            }
        }
    }
    private isValidQuarterHourTime(time: string): boolean {
        const [hours, minutes] = time.split(':').map(Number);
        return [0, 15, 30, 45].includes(minutes);
    }
    private correctToNearestQuarter(time: string): string {
        const [hours, minutes] = time.split(':').map(Number);
        const quarterIntervals = [0, 15, 30, 45];
        let closestQuarter = quarterIntervals.reduce((prev, curr) =>
            Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev);
        if (minutes > 52) {
            closestQuarter = 0;
            const newHours = hours === 23 ? 0 : hours + 1;
            return `${newHours.toString().padStart(2, '0')}:00`;
        }
        return `${hours.toString().padStart(2, '0')}:${closestQuarter.toString().padStart(2, '0')}`;
    }
    static timeStepValidator(control: AbstractControl): ValidationErrors | null {
        if (!control.value) return null;
        const [minutes] = control.value.split(':').map(Number);
        const isValid = [0, 15, 30, 45].includes(minutes);
        return isValid ? null : { invalidTimeStep: true };
    }
    private addHoursToTime(timeString: string, hoursToAdd: number): string {
        const [hours, minutes] = timeString.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        date.setHours(date.getHours() + hoursToAdd);
        const newHours = date.getHours();
        const newMinutes = date.getMinutes();
        return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    }
    private timeToMinutes(timeStr: string): number {
        if (!timeStr || typeof timeStr !== 'string') {
            return 0;
        }
        const [hours, minutes] = timeStr.split(':').map(Number);
        return (hours * 60) + (minutes || 0);
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
    onPeriodChange(value: string): void {
        const nightEndControl = this.rideForm.get('ride_date_night_end');
        const rideDateControl = this.rideForm.get('ride_date');
        if (value === 'night') {
            nightEndControl?.setValidators([Validators.required]);
            rideDateControl?.clearValidators();
        } else {
            nightEndControl?.clearValidators();
            nightEndControl?.setValue('');
            rideDateControl?.setValidators([
                Validators.required,
                this.validYearRangeValidator(2025, 2099)]);
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
    checkGovernmentLicence(employeeId: string): void {
        if (!employeeId) {
            console.warn('⚠️ No employeeId provided for license check. Setting disableRequest to false.');
            this.disableRequest = false;
            return;
        }
       this.UserService.getUserById(employeeId).subscribe({
    next: (user) => {
        if ('has_government_license' in user) {
            const hasLicense = user.has_government_license;
            const expiryDateStr = user.license_expiry_date; // Assuming it's a string like "2025-07-01"

            if (hasLicense) {
                let isExpired = false;

                if (expiryDateStr) {
                    const expiryDate = new Date(expiryDateStr);
                    const today = new Date();

                    // Remove time for accurate day comparison
                    expiryDate.setHours(0, 0, 0, 0);
                    today.setHours(0, 0, 0, 0);

                    if (expiryDate < today) {
                        isExpired = true;
                    }
                }

                if (isExpired) {
                    this.toastService.showPersistent(
                        'לא ניתן לשלוח בקשה: למשתמש שנבחר רישיון ממשלתי פג תוקף. לעדכון פרטים יש ליצור קשר עם המנהל.',
                        'error'
                    );
                    this.disableRequest = true;
                } else {
                    this.disableRequest = false; // ✅ License valid
                }

            } else {
                this.toastService.showPersistent(
                    'לא ניתן לשלוח בקשה: למשתמש שנבחר אין רישיון ממשלתי תקף. לעדכון פרטים יש ליצור קשר עם המנהל.',
                    'error'
                );
                this.disableRequest = true;
            }

        } else {
            console.error('🚨 user object missing has_government_license property:', user);
            this.toastService.show('שגיאה: פרטי רישיון ממשלתי לא נמצאו.', 'error');
            this.disableRequest = true;
        }
    },
    error: (err) => {
        console.error('❌ Failed to fetch user data from API:', err);
        this.toastService.show('שגיאה בבדיקת רישיון ממשלתי', 'error');
        this.disableRequest = true;
    }
});

    }
futureDateTimeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control as FormGroup;
    const rideDateControl = formGroup.get('ride_date');
    const startHourControl = formGroup.get('start_hour');
    const startMinuteControl = formGroup.get('start_minute');

    // Return null if any of the controls are empty, allowing other validators to handle 'required' checks
    if (!rideDateControl?.value || !startHourControl?.value || !startMinuteControl?.value) {
      return null;
    }

    const selectedDate = new Date(rideDateControl.value);
    const selectedHour = Number(startHourControl.value);
    const selectedMinute = Number(startMinuteControl.value);

    // Set the selected time on the date
    selectedDate.setHours(selectedHour, selectedMinute, 0, 0);

    const now = new Date();

    // If selected time is before now => error
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000); // Add 2 hours in milliseconds
    if (selectedDate.getTime() < twoHoursFromNow.getTime()) {
      // The selected time is less than two hours from the current time.
      return { 'futureDateTime': { message: 'לא ניתן להזמין נסיעה לשעתיים הקרובות.' } };
    }

    return null; // valid
  };
}
    submit(confirmedWarning = false): void {
        if (this.disableRequest) {
            this.toastService.show('לא ניתן לשלוח בקשה: למשתמש שנבחר אין רישיון ממשלתי תקףץ לעדכון פרטים יש ליצור קשר עם המנהל.', 'error');
            return;
        }
        const extraStopsControl = this.rideForm.get('extraStops');
        if (extraStopsControl?.errors?.['sameStopAsDestination']) {
            this.toastService.show('תחנות נוספות לא יכולות להיות כפולות.', 'error');
            extraStopsControl.markAsTouched();
            return;
        }
        if (extraStopsControl?.errors?.['duplicateExtraStops']) {
            this.toastService.show('תחנות נוספות לא יכולות להיות כפולות.', 'error');
            extraStopsControl.markAsTouched();
            return;
        }
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
        const ridePeriod = this.rideForm.get('ride_period')?.value as 'morning' | 'night';
        const rideDate = this.rideForm.get('ride_date')?.value;
        const nightEndDate = this.rideForm.get('ride_date_night_end')?.value;
        const startHour = this.rideForm.get('start_hour')?.value;
        const startMinute = this.rideForm.get('start_minute')?.value;
        const endHour = this.rideForm.get('end_hour')?.value;
        const endMinute = this.rideForm.get('end_minute')?.value;
        const startTime = `${startHour}:${startMinute}`;
        const endTime = `${endHour}:${endMinute}`;
        const distance = this.rideForm.get('estimated_distance_km')?.value;
        const vehicleType = this.rideForm.get('vehicle_type')?.value;
        if (distance && rideDate && vehicleType) {
            const isoDate = new Date(rideDate).toISOString().split('T')[0];
            this.loadVehicles(distance, isoDate, vehicleType);
        }
        if (ridePeriod === 'morning' && startTime && endTime && startTime >= endTime) {
            this.toastService.show('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'error');
            return;
        }
        if (!confirmedWarning && ridePeriod === 'morning' && this.isDuringInspectorClosure(startTime)) {
            this.showInspectorWarningModal = true;
        }
        const user_id = this.getUserIdFromAuthService();
        if (!user_id) {
            this.toastService.show('שגיאת זיהוי משתמש - התחבר מחדש', 'error');
            return;
        } const targetType = this.rideForm.get('target_type')?.value;
        const targetEmployeeId = this.rideForm.get('target_employee_id')?.value;
        let rider_id = user_id;
        let requester_id = null;
        if (targetType === 'other' && targetEmployeeId) {
            rider_id = targetEmployeeId;
            requester_id = user_id;
        }
        if (!startHour || !startMinute || !endHour || !endMinute) {
            this.toastService.show('יש לבחור שעת התחלה ושעת סיום תקינה', 'error');
            return;
        }
        const start_datetime = `${rideDate}T${startTime}`;
        const end_datetime = ridePeriod === 'morning'
            ? `${rideDate}T${endTime}`
            : `${nightEndDate}T${endTime}`;
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
            is_extended_request: this.isExtendedRequest,
        };
        const role = localStorage.getItem('role');
        if(role=='employee'){
            this.rideService.createRide(formData, user_id).subscribe({
            next: (createdRide) => {
                this.toastService.show('הבקשה נשלחה בהצלחה! ✅', 'success');
                this.loadFuelType(formData.vehicle_id);
                this.showFuelTypeMessage();
                this.socketService.sendMessage('new_ride_request', {
                    ...createdRide,
                    user_id
                });
                this.router.navigate(['/']);
            },
            error: (err) => {
                const errorMessage = err.error?.detail || err.message || 'שגיאה לא ידועה';
                
                if (errorMessage.includes('currently blocked')) {
                    const match = errorMessage.match(/until (\d{4}-\d{2}-\d{2})/);
                    const blockUntil = match ? match[1] : '';
                    const translated = `אתה חסום עד ${blockUntil}`;
                    this.toastService.show(translated, 'error');
                } else if (errorMessage.includes('אין לך רישיון בתוקף')) {
                    this.toastService.show('אין לך רישיון בתוקף במועד זה. יש ליצור קשר עם המנהל לעדכון פרטי הרישיון.', 'error');
                } else if (errorMessage.includes('לא הוזן תוקף לרישיון המשתמש')) {
                    this.toastService.show('לא הוזן תוקף לרישיון המשתמש. יש ליצור קשר עם המנהל.', 'error');
                } else if (errorMessage.includes('משתמש לא נמצא')) {
                    this.toastService.show('שגיאת זיהוי משתמש - התחבר מחדש', 'error');
                } else {
                    this.toastService.show('שגיאה בשליחת הבקשה', 'error');
                }
                console.error('Submit error:', err);
            }
        });  
        }
        else{
            if(role=='supervisor'){
                     this.rideService.createSupervisorRide(formData, user_id).subscribe({
            next: () => {
                this.toastService.show('הבקשה נשלחה בהצלחה! ✅', 'success');
                this.loadFuelType(formData.vehicle_id);
                this.showFuelTypeMessage();
                this.router.navigate(['/']);
            },
            error: (err) => {
                const errorMessage = err.error?.detail || err.message || 'שגיאה לא ידועה';
                if (errorMessage.includes('currently blocked')) {
                    const match = errorMessage.match(/until (\d{4}-\d{2}-\d{2})/);
                    const blockUntil = match ? match[1] : '';
                    const translated = `אתה חסום עד ${blockUntil}`;
                    this.toastService.show(translated, 'error');
                } else if (errorMessage.includes('אין לך רישיון בתוקף')) {
                    this.toastService.show('אין לך רישיון בתוקף במועד זה. יש ליצור קשר עם המנהל לעדכון פרטי הרישיון.', 'error');
                } else if (errorMessage.includes('לא הוזן תוקף לרישיון המשתמש')) {
                    this.toastService.show('לא הוזן תוקף לרישיון המשתמש. יש ליצור קשר עם המנהל.', 'error');
                } else if (errorMessage.includes('משתמש לא נמצא')) {
                    this.toastService.show('שגיאת זיהוי משתמש - התחבר מחדש', 'error');
                } else {
                    this.toastService.show('שגיאה בשליחת הבקשה', 'error');
                }
                console.error('Submit error:', err);
            }
        });  
            }
        }
      
    }
    private showFuelTypeMessage(): void {
        if (localStorage.getItem('role') == 'employee') {
            if (this.vehicleFuelType === 'electric') {
                this.toastService.showPersistent('אנא ודא כי הרכב טעון לפני ההחזרה.', 'neutral');
            } else if (this.vehicleFuelType === 'hybrid') {
                this.toastService.showPersistent('אנא ודא כי יש מספיק דלק וטעינה לפני ההחזרה.', 'neutral');
            } else if (this.vehicleFuelType === 'gasoline') {
                this.toastService.showPersistent('אנא ודא כי מיכל הדלק מלא לפני ההחזרה.', 'neutral');
            }
        }
    }
    get f() {
        return {
            ride_period: this.rideForm.get('ride_period') as FormControl,
            ride_date: this.rideForm.get('ride_date') as FormControl,
            ride_date_night_end: this.rideForm.get('ride_date_night_end') as FormControl,
            start_time: this.rideForm.get('start_time') as FormControl,
            end_time: this.rideForm.get('end_time') as FormControl,
            start_hour: this.rideForm.get('start_hour') as FormControl,
            start_minute: this.rideForm.get('start_minute') as FormControl,
            end_hour: this.rideForm.get('end_hour') as FormControl,
            end_minute: this.rideForm.get('end_minute') as FormControl,
            estimated_distance_km: this.rideForm.get('estimated_distance_km') as FormControl,
            ride_type: this.rideForm.get('ride_type') as FormControl,
            vehicle_type: this.rideForm.get('vehicle_type') as FormControl,
            car: this.rideForm.get('car') as FormControl,
            start_location: this.rideForm.get('start_location') as FormControl,
            stop: this.rideForm.get('stop') as FormControl,
            extra_stops: this.rideForm.get('extraStops') as FormArray,
            destination: this.rideForm.get('destination') as FormControl
        };
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
