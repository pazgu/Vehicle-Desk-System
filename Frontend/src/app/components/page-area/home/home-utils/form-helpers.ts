import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
  AbstractControl
} from '@angular/forms';

import {
  createRideDateValidator,
  createTripDurationValidator,
  createSameDayValidator,
  createSameDateNightRideValidator,
  createFutureDateTimeValidator,
  createInspectorClosureTimeValidator,
} from './validators';

function createSameStopAndDestinationValidator(form: FormGroup): ValidatorFn {
  return (control: any): ValidationErrors | null => {
    const extraStopsArray = control as FormArray;

    if (!extraStopsArray || extraStopsArray.length === 0) {
      return null;
    }

    const destinationId = form.get('stop')?.value;
    const extraStopIds = (extraStopsArray.value || []).filter(
      (stopId: string) => stopId
    );

    if (extraStopIds.length === 0) {
      return null;
    }

    if (destinationId === extraStopIds[0]) {
      return {
        duplicateExtraStops: { message: 'תחנות עוקבות לא יכולות להיות זהות.' },
      };
    } else {
      if (extraStopIds[0] === extraStopIds[1]) {
        return {
          consecutiveDuplicateStops: {
            message: 'תחנות עוקבות לא יכולות להיות זהות.',
          },
        };
      }
    }

    return null;
  };
}

function createExtraStopsValidator(form: FormGroup): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const formArray = control as FormArray;

    if (!formArray || formArray.length === 0) {
      return null;
    }

    const stopIds = formArray.controls
      .map(ctrl => ctrl.value)
      .filter(Boolean);

    if (stopIds.length !== new Set(stopIds).size) {
      return { duplicateExtraStops: true };
    }

    const mainStop = form.get('stop')?.value;
    if (mainStop && stopIds.includes(mainStop)) {
      return { consecutiveDuplicateStops: true };
    }

    return null;
  };
}


export function buildRideForm(
  fb: FormBuilder,
  isRebook: boolean = false
): FormGroup {
  const validators = [
    createTripDurationValidator(),
    createSameDayValidator(),
    createSameDateNightRideValidator(),
    createInspectorClosureTimeValidator(),
  ];

  if (!isRebook) {
    validators.unshift(createFutureDateTimeValidator());
  }

  const form = fb.group(
    {
      target_type: ['self', Validators.required],
      target_employee_id: [null],
      ride_period: ['morning'],
      ride_date: ['', [Validators.required, createRideDateValidator()]],
      ride_date_night_end: [''],

      start_hour: ['', Validators.required],
      start_minute: ['', Validators.required],
      end_hour: ['', Validators.required],
      end_minute: ['', Validators.required],

      start_time: [''],
      end_time: [''],


      estimated_distance_km: [null, Validators.required],
      ride_type: ['', Validators.required],
      vehicle_type: ['', Validators.required],
      car: ['', Validators.required],

      start_location: [null],
      stop: ['', Validators.required],
      extraStops: fb.array([]),
      destination: [null],

      four_by_four_reason: [''],
      extended_ride_reason: [''],
      
      approving_supervisor: [null],
    },
    { validators }
  );

  const extraStopsArray = form.get('extraStops') as FormArray;
  extraStopsArray.setValidators([
    createSameStopAndDestinationValidator(form),
    createExtraStopsValidator(form),
  ]);
  return form;
}

export function resetRideForm(form: FormGroup): void {
  form.reset();

  const extraStops = form.get('extraStops') as FormArray | null;
  if (extraStops) {
    extraStops.clear();
  }

  form.patchValue({
    target_type: 'self',
    target_employee_id: null,
    ride_period: 'morning',
    ride_date: '',
    ride_date_night_end: '',
    start_hour: '',
    start_minute: '',
    end_hour: '',
    end_minute: '',
    start_time: '',
    end_time: '',
    estimated_distance_km: null,
    ride_type: '',
    vehicle_type: '',
    car: '',
    stop: '',
    four_by_four_reason: '',
    extended_ride_reason: '',
  });
}

export function getRideFormControls(form: FormGroup) {
  return {
    ride_period: form.get('ride_period') as FormControl,
    ride_date: form.get('ride_date') as FormControl,
    ride_date_night_end: form.get('ride_date_night_end') as FormControl,
    start_time: form.get('start_time') as FormControl,
    end_time: form.get('end_time') as FormControl,
    start_hour: form.get('start_hour') as FormControl,
    start_minute: form.get('start_minute') as FormControl,
    end_hour: form.get('end_hour') as FormControl,
    end_minute: form.get('end_minute') as FormControl,
    estimated_distance_km: form.get('estimated_distance_km') as FormControl,
    ride_type: form.get('ride_type') as FormControl,
    vehicle_type: form.get('vehicle_type') as FormControl,
    car: form.get('car') as FormControl,
    start_location: form.get('start_location') as FormControl,
    stop: form.get('stop') as FormControl,
    extra_stops: form.get('extraStops') as FormArray,
    destination: form.get('destination') as FormControl,
    extended_ride_reason: form.get('extended_ride_reason') as FormControl,
  };
}
