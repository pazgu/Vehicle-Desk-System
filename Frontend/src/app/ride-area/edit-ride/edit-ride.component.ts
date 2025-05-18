import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RideService } from '../../services/ride.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-edit-ride',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './edit-ride.component.html',
  styleUrl: './edit-ride.component.css'
})
export class EditRideComponent implements OnInit {
  rideForm!: FormGroup;
  rideId!: string;
  minDate: string = '';
  estimated_distance_with_buffer: number = 0;
  submittedAt: Date | null = null;
  allCars = [
    { id: '1', name: 'Toyota Yaris', type: 'small' },
    { id: '2', name: 'Hyundai i10', type: 'small' },
    { id: '3', name: 'Mercedes Sprinter', type: 'van' },
    { id: '4', name: 'Ford Transit', type: 'van' },
    { id: '5', name: 'Chevy Tahoe', type: 'large' }
  ];
  availableCars: { id: string; name: string; type: string }[] = [];

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private rideService: RideService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.rideId = this.route.snapshot.paramMap.get('id') || '';
    this.minDate = this.calculateMinDate(2);
    this.buildForm();
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
    this.rideService.getRideById(this.rideId).subscribe({
      next: (ride) => {
        const now = new Date();
        const submitted = new Date(ride.submitted_at);
        this.submittedAt = submitted;
        const within3Hours = (now.getTime() - submitted.getTime()) <= 3 * 60 * 60 * 1000;

        if (!within3Hours) {
          this.toastService.show('לא ניתן לערוך הזמנה לאחר 3 שעות מהשליחה', 'error');
          this.router.navigate(['/home']);
          return;
        }

        const startDate = new Date(ride.start_datetime);
        const endDate = new Date(ride.end_datetime);

        this.rideForm.patchValue({
          ride_period: 'morning',
          ride_date: startDate.toISOString().split('T')[0],
          start_time: startDate.toTimeString().slice(0, 5),
          end_time: endDate.toTimeString().slice(0, 5),
          estimated_distance_km: ride.estimated_distance_km,
          ride_type: ride.ride_type,
          vehicle_type: '', // Optional: fill in based on backend data if needed
          start_location: ride.start_location,
          stop: ride.stop,
          destination: ride.destination
        });

        this.estimated_distance_with_buffer = +(ride.estimated_distance_km * 1.1).toFixed(2);
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
