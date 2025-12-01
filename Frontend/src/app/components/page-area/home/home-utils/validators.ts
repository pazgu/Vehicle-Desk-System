import {
  AbstractControl,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { timeToMinutes } from './time-helpers';

export function createRideDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (!value) return null;

    const selectedDate = new Date(value);
    if (isNaN(selectedDate.getTime())) {
      return { invalidDate: true };
    }

    const year = selectedDate.getFullYear();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (year < 2025 || year > 2099) {
      return { invalidYear: true };
    }

    if (selectedDate < today) {
      return { pastDate: true };
    }

    return null;
  };
}

export function createTripDurationValidator(): ValidatorFn {
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
    return null;
  };
}

export function createSameDayValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control as FormGroup;
    const ridePeriod = formGroup.get('ride_period')?.value;
    const rideDate = formGroup.get('ride_date')?.value;

    if (ridePeriod !== 'morning' || !rideDate) {
      return null;
    }
    return null;
  };
}

export function createSameDateNightRideValidator(): ValidatorFn {
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
        sameDateNightRide: {
          message: 'נסיעה מעבר ליום חייבת להיות בין שני תאריכים שונים.',
        },
      };
    }

    if (endDate.getTime() < startDate.getTime()) {
      return {
        sameDateNightRide: {
          message: 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה.',
        },
      };
    }

    return null;
  };
}

export function createFutureDateTimeValidator(
  isRebookMode: boolean = false
): ValidatorFn {
  return (formGroup: AbstractControl): ValidationErrors | null => {
    if (isRebookMode) {
      return null;
    }

    const rideDateControl = formGroup.get('ride_date');
    const startHourControl = formGroup.get('start_hour');
    const startMinuteControl = formGroup.get('start_minute');

    if (
      !rideDateControl?.value ||
      !startHourControl?.value ||
      !startMinuteControl?.value
    ) {
      return null;
    }

    const selectedDate = new Date(rideDateControl.value);
    const selectedHour = Number(startHourControl.value);
    const selectedMinute = Number(startMinuteControl.value);

    selectedDate.setHours(selectedHour, selectedMinute, 0, 0);

    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    if (selectedDate.getTime() < twoHoursFromNow.getTime()) {
      return {
        futureDateTime: {
          message: 'לא ניתן להזמין נסיעה לשעתיים הקרובות.',
        },
      };
    }

    return null;
  };
}

export function createInspectorClosureTimeValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const formGroup = control as FormGroup;
    const startHour = formGroup.get('start_hour')?.value;
    const startMinute = formGroup.get('start_minute')?.value;
    const endHour = formGroup.get('end_hour')?.value;
    const endMinute = formGroup.get('end_minute')?.value;

    if (!startHour || !startMinute || !endHour || !endMinute) {
      return null;
    }

    const startTime = `${startHour}:${startMinute}`;
    const endTime = `${endHour}:${endMinute}`;

    const isInClosureRange = (time: string): boolean => {
      const timeInMinutes = timeToMinutes(time);
      const closureStart = timeToMinutes('11:15');
      const closureEnd = timeToMinutes('12:15');
      return timeInMinutes >= closureStart && timeInMinutes <= closureEnd;
    };

    if (isInClosureRange(startTime)) {
      return {
        inspectorClosureTime: {
          message:
            'שגיאה: זמן תחילת הנסיעה לא יכול להיות בין השעות 11:15 ל-12:15 (מנהל רכבים בהפסקה)',
        },
      };
    }

    if (isInClosureRange(endTime)) {
      return {
        inspectorClosureTime: {
          message:
            'שגיאה: זמן סיום הנסיעה לא יכול להיות בין השעות 11:15 ל-12:15 (מנהל רכבים בהפסקה)',
        },
      };
    }

    return null;
  };
}

export function timeStepValidator(
  control: AbstractControl
): ValidationErrors | null {
  if (!control.value) return null;
  const [, minutesStr] = (control.value as string).split(':');
  const minutes = Number(minutesStr);
  const isValid = [0, 15, 30, 45].includes(minutes);
  return isValid ? null : { invalidTimeStep: true };
}
