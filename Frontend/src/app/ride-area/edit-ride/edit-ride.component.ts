import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RideService } from '../../services/ride.service';
import { ToastService } from '../../services/toast.service';
import { VehicleService } from '../../services/vehicle.service';

@Component({
  selector: 'app-edit-ride',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-ride.component.html',
  styleUrl: './edit-ride.component.css'
})
export class EditRideComponent implements OnInit {
  rideForm!: FormGroup;
  rideId!: string;
  minDate: string = '';
  estimated_distance_with_buffer: number = 0;
  submittedAt: Date | null = null;
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

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private rideService: RideService,
    private toastService: ToastService,
    private vehicleService: VehicleService
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
    this.vehicleService.getAllVehicles().subscribe({
  next: (vehicles) => {
    this.allCars = vehicles
      .filter(v =>
        v.status === 'available' &&
        !!v.id &&
        !!v.type &&
        !!v.vehicle_model &&
        typeof v.odometer_reading === 'number'
      );
  },
  error: () => {
    this.toastService.show('שגיאה בטעינת רכבים זמינים', 'error');
  }
});

    this.loadRide();
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
  console.log('employee_id from localStorage:', user_id);
  if (!user_id) {
    this.toastService.show('שגיאת זיהוי משתמש - התחבר מחדש', 'error');
    this.router.navigate(['/login']); // Or fallback to /home
    return;
  }

    this.rideService.getRideById(this.rideId).subscribe({
      next: (ride) => {

       console.log('👀 Ride status:', ride.status);

       console.log('🚗 ride.vehicle_id:', ride.vehicle_id); // ✅ Add this

       console.log('🚚 Full ride object:', ride); // 👈 ADD THIS


      // const isPending = ride.status?.toLowerCase?.() === 'pending';
      const isPending = ride.status && ride.status.toLowerCase() === 'pending';

        console.log('🟡 isPending:', isPending);

      

// const isOwner = String(ride.user_id) === localStorage.getItem('employee_id');
const isOwner = String(ride.user_id) === localStorage.getItem('employee_id');


if (!isPending) {
  this.toastService.show('אין לך הרשאה לגשת לדף זה', 'error');
  this.router.navigate(['/home']);
  return;
}

        const startDate = new Date(ride.start_datetime);
        const endDate = new Date(ride.end_datetime);

const vehicleType = ride.vehicle;
this.availableCars = this.allCars.filter(car => car.type === vehicleType);

if (this.availableCars.length === 0) {
  this.toastService.show('לא נמצאו רכבים מתאימים עבור סוג הרכב שבוצעה בו ההזמנה', 'error');
  return;
}

const selectedCar = this.availableCars[0]; // fallback to the first car of that type


if (selectedCar) {
  this.rideForm.patchValue({
    ride_period: 'morning',
    ride_date: startDate.toISOString().split('T')[0],
    start_time: startDate.toTimeString().slice(0, 5),
    end_time: endDate.toTimeString().slice(0, 5),
    estimated_distance_km: parseFloat(ride.estimated_distance),
    ride_type: ride.ride_type,
    vehicle_type: selectedCar.type,
    car: selectedCar.id,
    start_location: ride.start_location,
    stop: ride.stop,
    destination: ride.destination
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
      ride_type: this.rideForm.get('ride_type')?.value,
      vehicle_id: this.rideForm.get('car')?.value,
      start_datetime,
      end_datetime,
      estimated_distance_km: this.rideForm.get('estimated_distance_km')?.value,
      start_location: this.rideForm.get('start_location')?.value,
      stop: this.rideForm.get('stop')?.value,
      destination: this.rideForm.get('destination')?.value
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

