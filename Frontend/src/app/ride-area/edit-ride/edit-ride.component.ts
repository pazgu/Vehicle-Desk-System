import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RideService } from '../../services/ride.service';
import { ToastService } from '../../services/toast.service';
import { VehicleService } from '../../services/vehicle.service';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-edit-ride',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-ride.component.html',
  styleUrl: './edit-ride.component.css'
})
export class EditRideComponent implements OnInit {
  status: string = 'pending';
  licenseCheckPassed: boolean = true;
  submittedAt: string = new Date().toISOString();

  rideForm!: FormGroup;
  rideId!: string;
  minDate: string = '';
  estimated_distance_with_buffer: number = 0;
  rideRequestSub!: Subscription; 
 allCars: {
  id: string;
  plate_number: string;
  type: string;
  fuel_type: string;
  status: string;
  freeze_reason?: string | null;
  last_used_at?: string;
  current_location?: string;
  mileage: number;
  image_url: string;
  vehicle_model: string;
  
}[] = [];

availableCars: typeof this.allCars = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private rideService: RideService,
    private toastService: ToastService,
    private vehicleService: VehicleService,
    private socketService: SocketService 
  ) {}

    calculateMinDate(daysAhead: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.rideId = this.route.snapshot.paramMap.get('id') || '';
    this.minDate = this.calculateMinDate(2);
    this.buildForm();

    // ✅ Socket listener moved outside vehicle block
    this.rideRequestSub = this.socketService.rideRequests$.subscribe((rideData) => {
      if (rideData) {
        this.toastService.show('🚗 התקבלה הזמנת נסיעה חדשה', 'success');
        const audio = new Audio('assets/sounds/notif.mp3');
        audio.play();
      }
    });


this.vehicleService.getAllVehicles().subscribe({
  next: (vehicles) => {
    this.allCars = vehicles.filter(v =>
      !!v.id &&
      !!v.type &&
      !!v.vehicle_model &&
      typeof v.mileage === 'number'
    );

    // 🔑 Only call loadRide after cars are loaded
    this.loadRide();
    // ✅ Socket listener for new ride requests
this.socketService.rideRequests$.subscribe((rideData) => {
  if (rideData) {
    this.toastService.show('🚗 התקבלה הזמנת נסיעה חדשה', 'success');

    const audio = new Audio('assets/sounds/notif.mp3');
    audio.play();
  }
});

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
      destination: ['', Validators.required]
    });

    this.rideForm.get('estimated_distance_km')?.valueChanges.subscribe(() => {
      const d = this.rideForm.get('estimated_distance_km')?.value || 0;
      this.estimated_distance_with_buffer = +(d * 1.1).toFixed(2);
    });

    this.rideForm.get('vehicle_type')?.valueChanges.subscribe(value => {
      this.availableCars = this.allCars.filter(car => car.type === value);
      this.rideForm.get('car')?.setValue('');
    });
  }

  loadRide(): void {
     const user_id = localStorage.getItem('employee_id');
  if (!user_id) {
    this.toastService.show('שגיאת זיהוי משתמש - התחבר מחדש', 'error');
    this.router.navigate(['/login']); // Or fallback to /home
    return;
  }

    this.rideService.getRideById(this.rideId).subscribe({
      next: (ride) => {

     
      this.status = ride.status || 'pending';
      this.submittedAt = ride.submitted_at || new Date().toISOString();
      this.licenseCheckPassed = ride.license_check_passed ?? true;



      // const isPending = ride.status?.toLowerCase?.() === 'pending';
      const isPending = ride.status && ride.status.toLowerCase() === 'pending';


      

// const isOwner = String(ride.user_id) === localStorage.getItem('employee_id');
const isOwner = String(ride.user_id) === localStorage.getItem('employee_id');


if (!isPending) {
  this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
  this.router.navigate(['/home']);
  return;
}

        const startDate = new Date(ride.start_datetime);
        const endDate = new Date(ride.end_datetime);

// ✅ MODIFIED: Try to find car by multiple fallbacks
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

      // ✅ MODIFIED: Only now filter available cars by type
      this.availableCars = this.allCars.filter(car =>
        car.status === 'available' && car.type === selectedVehicle.type
      );

if (selectedVehicle) {
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
  stop: ride.stop ?? 'תחנה לא ידועה',
  destination: ride.destination ?? 'יעד לא ידוע'
});




  this.estimated_distance_with_buffer = +(parseFloat(ride.estimated_distance) * 1.1).toFixed(2);
} else {
  this.toastService.show('הרכב שבוצעה בו ההזמנה אינו זמין יותר', 'error');
}



      },
      error: (err) => {
        this.toastService.show('שגיאה בטעינת ההזמנה לעריכה', 'error');
        this.router.navigate(['/home']);
      }
    });
  }

  submit(): void {
    
    if (this.rideForm.invalid) {
      this.rideForm.markAllAsTouched();
      this.toastService.show('נא למלא את כל השדות הנדרשים', 'error');
      return;
    }

    const rideDate = this.rideForm.get('ride_date')?.value;
    const startTime = this.rideForm.get('start_time')?.value;
    const endTime = this.rideForm.get('end_time')?.value;

    const start_datetime = `${rideDate}T${startTime}`;
    const end_datetime = `${rideDate}T${endTime}`;

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
  destination: this.rideForm.get('destination')?.value,
  status: this.status,
  // license_check_passed: this.licenseCheckPassed,
  submitted_at: this.submittedAt
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
}

