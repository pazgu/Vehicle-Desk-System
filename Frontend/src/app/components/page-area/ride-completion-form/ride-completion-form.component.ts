import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ToastService } from '../../../services/toast.service';
import { RideReportService } from '../../../services/completion-form.service';
import { Location } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { RideService } from '../../../services/ride.service';
import { RideDashboardItem } from '../../../models/ride-dashboard-item/ride-dashboard-item.module';
import { RideLocationItem } from '../../../models/ride.model';
import { FuelType, FuelTypeResponse } from '../../../models/vehicle-dashboard-item/vehicle-out-item.module';
import { VehicleService } from '../../../services/vehicle.service';
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
  currentRide! :any;
  ridesWithLocations: RideLocationItem[] = [];
  start_location_name: string = '';
  stop_name: string = '';
  destination_name: string = '';
  VehicleFuelType:FuelType=FuelType.Gasoline

  // rideId!: string;
  showForm = true;
  @Input() rideId!: string;
  @Output() formCompleted = new EventEmitter<void>();


  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private toastService: ToastService,
    private route: ActivatedRoute,
    private rideReportService: RideReportService,
    private location: Location,
    private rideService: RideService ,
    private vehicleService:VehicleService
  ) {}

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.rideId = this.rideId || this.route.snapshot.paramMap.get('ride_id')!;
    const submittedKey = `feedback_submitted_${this.rideId}`;

 
   
    this.rideService.getRideById(this.rideId).subscribe(ride => {
      console.log('Fetched ride:', ride);
    this.currentRide = ride;

       this.rideReportService.getRidesWithLocations().subscribe(ridesWithLocations => {
        console.log('ride with loc:',ridesWithLocations)
        const matchingRide = ridesWithLocations.find(r => r.id === this.currentRide?.ride_id);

    console.log('match ride',matchingRide)

    if (matchingRide) {
      this.start_location_name = matchingRide.start_location_name;
      this.stop_name = matchingRide.stop_name;
      this.destination_name = matchingRide.destination_name;
      console.log(`start:${this.start_location_name},des:${this.destination_name},stop:${this.stop_name}`)
    }
  });
  });    
  if (localStorage.getItem(submittedKey) === 'true') {
      this.showForm = false;
      return;
    }
  console.log('rideId:', this.rideId);
  console.log('currentRide:', this.currentRide);


    this.form = this.fb.group({
      emergency_event: ['', Validators.required],
      freeze_details: [''],
      completed: ['', Validators.required],
      fueled: ['', Validators.required],
    });


    this.form.get('emergency_event')?.valueChanges.subscribe((value) => {
      const freezeDetails = this.form.get('freeze_details');
      console.log('emergency event?',value)
      if (value === 'true') {
        freezeDetails?.setValidators([Validators.required]);
      } else {
        freezeDetails?.clearValidators();
        freezeDetails?.setValue('');
      }
      freezeDetails?.updateValueAndValidity();
    });
  }

 
loadFuelType(vehicleId: string) {
    this.vehicleService.getFuelTypeByVehicleId(vehicleId).subscribe({
      next: (res: FuelTypeResponse) => {
        this.VehicleFuelType = res.fuel_type;
        console.log('Fuel Type:', this.VehicleFuelType);
      },
      error: err => console.error('Failed to load fuel type', err)
    });}

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
      this.loadFuelType(this.currentRide.vehicle_id)

     if (!this.form.value.fueled) {
    if (this.VehicleFuelType === 'electric') {
      this.toastService.show('הרכב טרם נטען. אנא טען לפני ההחזרה.', 'error');
    } else if (this.VehicleFuelType === 'hybrid') {
      this.toastService.show('הרכב לא תודלק ולא נטען. יש להשלים לפני ההחזרה.', 'error');
    } else if (this.VehicleFuelType === 'gasoline') {
      this.toastService.show('הרכב לא תודלק. יש לתדלק לפני ההחזרה.', 'error');
    }}
    

    const rawForm = this.form.value;
    const formData = {
      ride_id: this.rideId,
      emergency_event: rawForm.emergency_event === 'true' ? 'true' : 'false',
      freeze_details: rawForm.freeze_details || '',
      completed: rawForm.completed === 'true',
      fueled: rawForm.fueled === 'true',
        changed_by: localStorage.getItem('user_id') || '' // Make sure this is a string!

    };
    console.log('Form Data:', formData);

    const token = localStorage.getItem('access_token') || '';
    this.loading = true;

    this.rideReportService.submitCompletionForm(formData, token).subscribe({
      next: () => {
        const submittedKey = `feedback_submitted_${this.rideId}`;
        localStorage.setItem(submittedKey, 'true');
        this.toastService.show('הטופס נשלח בהצלחה', 'success');
        this.showForm = false;
        this.loading = false;
        localStorage.removeItem('pending_feedback_ride');
      },
      error: () => {
        this.toastService.show('אירעה שגיאה בשליחת הטופס', 'error');
        this.loading = false;
      },
    });
  }
}
