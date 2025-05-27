import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../services/toast.service';
import { ActivatedRoute } from '@angular/router';
import { RideReportService } from '../../../services/completion-form.service';

@Component({
  selector: 'app-your-component',
  templateUrl: './ride-completion-form.component.html',
  styleUrls: ['./ride-completion-form.component.css'],
  imports: [ReactiveFormsModule, CommonModule],
})
export class RideCompletionFormComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  errorMessage = '';
  rideId!: string;

  constructor(private fb: FormBuilder, private http: HttpClient,
    private toastService:ToastService,private route: ActivatedRoute,private rideReportService:RideReportService) {}

  ngOnInit(): void {
  this.rideId = this.route.snapshot.paramMap.get('ride_id')!;

    this.form = this.fb.group({
    emergency_event: [''],         
    freeze_details: [''],              
    completed: [false],                
    fueled: [false]                    
  });
  }

setEmergencyEvent(value: string): void {
  this.form.get('emergency_event')?.setValue(value);
  if (value === 'false') {
    this.form.get('freeze_details')?.setValue('');
  }
}

setFormValue(controlName: string, value: string): void {
  this.form.get(controlName)?.setValue(value);
  if (controlName === 'emergency_event' && value === 'false') {
    this.form.get('freeze_details')?.setValue('');
  }
}

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
     const formData = {
    ...this.form.value,
    ride_id: this.rideId,
  };
    const token = localStorage.getItem('access_token') || ''   
    this.rideReportService.submitCompletionForm(formData,token).subscribe({
      next: (response) => {
      this.toastService.show('הטופס נשלח בהצלחה',"success");        
        this.loading = false;
      },
      error: () => {
      this.toastService.show('אירעה שגיאה בשליחת הטופס',"error");
        this.loading = false;
      },
    });
  }
}
