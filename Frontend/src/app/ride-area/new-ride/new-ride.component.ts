import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidatorFn,
  FormControl,
  ReactiveFormsModule
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-new-ride',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './new-ride.component.html',
  styleUrl: './new-ride.component.css',
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
      ride_date: ['', [Validators.required, this.minDateValidator(2), this.validYearRangeValidator(2025, 2099)]],
      start_time: ['', Validators.required],
      end_time: ['', Validators.required],
      estimated_distance_km: [null, [Validators.required, Validators.min(1)]],
      ride_type: ['', Validators.required],
    });

    this.rideForm.get('estimated_distance_km')?.valueChanges.subscribe(() => {
      this.updateDistance();
    });
  }

  updateDistance(): void {
    const distance = this.rideForm.get('estimated_distance_km')?.value || 0;
    this.estimated_distance_with_buffer = distance * 1.1;
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

  const formData = {
    ...this.rideForm.value,
    estimated_distance_with_buffer: this.estimated_distance_with_buffer,
  };

  // Extra validation: end time must be after start time
  const startTime = this.rideForm.get('start_time')?.value;
  const endTime = this.rideForm.get('end_time')?.value;
  if (startTime >= endTime) {
    this.toastService.show('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'error');
    return;
  }

  // Distance edge case (manually entered wrong value)
  const distance = this.rideForm.get('estimated_distance_km')?.value;
  if (distance > 1000) {
    this.toastService.show('מרחק לא הגיוני - נא להזין ערך סביר', 'error');
    return;
  }

  console.log('Submitted ride:', formData);
  this.toastService.show('הבקשה נשלחה בהצלחה! ✅', 'success');
  this.router.navigate(['/']);
}

  get f() {
    return {
      ride_date: this.rideForm.get('ride_date') as FormControl,
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
