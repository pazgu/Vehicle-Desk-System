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
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-new-ride',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterModule
  ],
  templateUrl: './new-ride.component.html',
  styleUrl: './new-ride.component.css'
})
export class NewRideComponent implements OnInit {
  rideForm!: FormGroup;
  public estimated_distance_with_buffer: number = 0;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.rideForm = this.fb.group({
      ride_period: ['morning'],
      ride_date: ['', [Validators.required, this.minDateValidator(2), this.validYearRangeValidator(2025, 2099)]],
      ride_date_night_end: [''],
      start_time: [''],
      end_time: [''],
      estimated_distance_km: [null, [Validators.required, Validators.min(1)]],
      ride_type: ['', Validators.required],
    });

    this.rideForm.get('estimated_distance_km')?.valueChanges.subscribe(() => {
      this.updateDistance();
    });

    // React to ride period changes dynamically
    this.rideForm.get('ride_period')?.valueChanges.subscribe(value => {
      this.onPeriodChange(value);
    });
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
        this.minDateValidator(2),
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

  minDateValidator(minDaysAhead: number): ValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return null;
      const selectedDate = new Date(control.value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const minDate = new Date(today);
      minDate.setDate(today.getDate() + minDaysAhead);
      return selectedDate >= minDate ? null : { tooSoon: true };
    };
  }

  validYearRangeValidator(minYear: number, maxYear: number): ValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value) return null;
      const selectedYear = new Date(control.value).getFullYear();
      return selectedYear >= minYear && selectedYear <= maxYear ? null : { invalidYear: true };
    };
  }

  submit(): void {
    if (this.rideForm.invalid) {
      this.rideForm.markAllAsTouched();
      this.toastService.show('יש להשלים את כל שדות הטופס כנדרש', 'error');
      return;
    }

    const ridePeriod = this.rideForm.get('ride_period')?.value as 'morning' | 'night';
    const rideDate = this.rideForm.get('ride_date')?.value;
    const nightEndDate = this.rideForm.get('ride_date_night_end')?.value;
    const startTime = this.rideForm.get('start_time')?.value;
    const endTime = this.rideForm.get('end_time')?.value;

    if (ridePeriod === 'morning' && startTime && endTime && startTime >= endTime) {
      this.toastService.show('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'error');
      return;
    }

    const distance = this.rideForm.get('estimated_distance_km')?.value;
    if (distance > 1000) {
      this.toastService.show('מרחק לא הגיוני - נא להזין ערך סביר', 'error');
      return;
    }

    const start_datetime = `${rideDate}T${startTime}`;
    const end_datetime = ridePeriod === 'morning'
      ? `${rideDate}T${endTime}`
      : `${nightEndDate}T${endTime}`;

    const formData = {
      ride_type: this.rideForm.get('ride_type')?.value,
      start_datetime,
      end_datetime,
      start_location: '', // TODO
      stop: '',           // TODO
      destination: '',    // TODO
      estimated_distance_km: distance,
      estimated_distance_with_buffer: this.estimated_distance_with_buffer,
      ride_period: ridePeriod
    };

    console.log('Submitted ride:', formData);
    this.toastService.show('הבקשה נשלחה בהצלחה! ✅', 'success');
    this.router.navigate(['/']);
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
    };
  }

  close(): void {
    this.router.navigate(['/home']);
  }
}
