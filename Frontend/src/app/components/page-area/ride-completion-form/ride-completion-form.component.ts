import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../services/toast.service';
import { RideReportService } from '../../../services/completion-form.service';
import { Location } from '@angular/common';

@Component({
  selector: 'app-ride-completion-form',
  templateUrl: './ride-completion-form.component.html',
  styleUrls: ['./ride-completion-form.component.css'],
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
})
export class RideCompletionFormComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  rideId!: string;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private rideReportService: RideReportService,
    private location: Location
  ) {}
  goBack(): void {
  this.location.back();
}

  ngOnInit(): void {
    this.rideId = this.route.snapshot.paramMap.get('ride_id')!;

    this.form = this.fb.group({
      emergency_event: ['', Validators.required],
      freeze_details: [''], // conditionally required
      completed: ['', Validators.required],
      fueled: ['', Validators.required],
    });

    this.form.get('emergency_event')?.valueChanges.subscribe((value) => {
      const freezeDetails = this.form.get('freeze_details');
      if (value === 'true') {
        freezeDetails?.setValidators([Validators.required]);
      } else {
        freezeDetails?.clearValidators();
        freezeDetails?.setValue('');
      }
      freezeDetails?.updateValueAndValidity();
    });
  }

  setEmergencyEvent(value: string): void {
    this.form.get('emergency_event')?.setValue(value);
  }

  setFormValue(controlName: string, value: string): void {
    this.form.get(controlName)?.setValue(value);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastService.show('אנא השלם את כל השדות הנדרשים', 'error');
      return;
    }

    const rawForm = this.form.value;

    const formData = {
      ride_id: this.rideId,
      emergency_event: rawForm.emergency_event === 'true',
      freeze_details: rawForm.freeze_details || '',
      completed: rawForm.completed === 'true',
      fueled: rawForm.fueled === 'true',
    };

    const token = localStorage.getItem('access_token') || '';
    this.loading = true;

    this.rideReportService.submitCompletionForm(formData, token).subscribe({
      next: () => {
        this.toastService.show('הטופס נשלח בהצלחה', 'success');
        this.loading = false;
      },
      error: () => {
        this.toastService.show('אירעה שגיאה בשליחת הטופס', 'error');
        this.loading = false;
      },
    });
  }
}
