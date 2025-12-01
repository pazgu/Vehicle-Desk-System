import { FormArray, FormGroup } from '@angular/forms';
import { ToastService } from '../../../../services/toast.service';
import {
  PendingVehicle,
  Vehicle,
  isVehiclePendingForRide,
} from './vehicle-helpers';
import { isDuringInspectorClosure } from './time-helpers';

export interface RideFormPayload {
  user_id: string;
  override_user_id: string | null;
  ride_type: string;
  start_datetime: string;
  vehicle_id: string;
  end_datetime: string;
  start_location: string;
  stop: string;
  extra_stops: string[];
  destination: string;
  estimated_distance_km: number;
  actual_distance_km: number;
  four_by_four_reason: string | null;
  extended_ride_reason: string | null;
  is_extended_request: boolean;
  approving_supervisor : string |null;
}

function extractCityName(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && raw.name) return String(raw.name);
  return '';
}

export function buildRideFormPayload(params: {
  form: FormGroup;
  riderId: string;
  requesterId: string | null;
  start_datetime: string;
  end_datetime: string;
  vehicleId: string;
  isExtendedRequest: boolean;
  estimatedDistanceWithBuffer: number | null;
}): RideFormPayload {
  const {
    form,
    riderId,
    requesterId,
    start_datetime,
    end_datetime,
    vehicleId,
    isExtendedRequest,
    estimatedDistanceWithBuffer,
  } = params;

  const extraStopsControl = form.get('extraStops') as FormArray | null;

  const distance = form.get('estimated_distance_km')?.value;
  const startLocationRaw = form.get('start_location')?.value;
  const destinationRaw = form.get('destination')?.value;
  const approvingSupervisor = form.get('approving_supervisor')?.value;

  return {
    user_id: riderId,
    override_user_id: requesterId,
    ride_type: form.get('ride_type')?.value,
    start_datetime,
    vehicle_id: vehicleId,
    end_datetime,
    start_location: extractCityName(startLocationRaw),
    stop: form.get('stop')?.value,
    extra_stops: (extraStopsControl?.value as string[]) ?? [],
    destination: extractCityName(destinationRaw),
    estimated_distance_km: Number(distance),
    actual_distance_km: Number(estimatedDistanceWithBuffer),
    four_by_four_reason: form.get('four_by_four_reason')?.value || null,
    extended_ride_reason: form.get('extended_ride_reason')?.value || null,
    is_extended_request: isExtendedRequest,
    approving_supervisor:approvingSupervisor || null,
  };
}

export function getRideSubmitErrorMessage(err: any): string {
  const errorMessage: string =
    err?.error?.detail || err?.message || 'שגיאה לא ידועה';

  if (errorMessage.includes('currently blocked')) {
    const match = errorMessage.match(/until (\d{4}-\d{2}-\d{2})/);
    const blockUntil = match ? match[1] : '';
    return blockUntil
      ? `אתה חסום עד ${blockUntil}`
      : 'אינך יכול ליצור נסיעה כרגע (חסימה זמנית).';
  }

  if (errorMessage.includes('אין לך רישיון בתוקף')) {
    return 'אין לך רישיון בתוקף במועד זה. יש ליצור קשר עם המנהל לעדכון פרטי הרישיון.';
  }

  if (errorMessage.includes('לא הוזן תוקף לרישיון המשתמש')) {
    return 'לא הוזן תוקף לרישיון המשתמש. יש ליצור קשר עם המנהל.';
  }

  if (errorMessage.includes('משתמש לא נמצא')) {
    return 'שגיאת זיהוי משתמש - התחבר מחדש';
  }

  if (
    errorMessage.includes('אינו משויך למחלקה') ||
    errorMessage.includes('not assigned to')
  ) {
    return 'לא ניתן ליצור נסיעה: אינך משויך למחלקה. יש ליצור קשר עם המנהל.';
  }

  return 'שגיאה בשליחת הבקשה';
}
export interface PreSubmitCheckParams {
  form: FormGroup;
  disableDueToDepartment: boolean;
  disableRequest: boolean;
  allCars: Vehicle[];
  pendingVehicles: PendingVehicle[];
  isExtendedRequest: boolean;
  confirmedWarning: boolean;
  toastService: ToastService;
}

export interface PreSubmitCheckResult {
  blocked: boolean;
  showInspectorWarning: boolean;
}

export function runPreSubmitChecks(
  params: PreSubmitCheckParams
): PreSubmitCheckResult {
  const {
    form,
    disableDueToDepartment,
    disableRequest,
    allCars,
    pendingVehicles,
    isExtendedRequest,
    confirmedWarning,
    toastService,
  } = params;

  if (disableDueToDepartment) {
    toastService.showPersistent(
      'לא ניתן לשלוח בקשה: אינך משויך למחלקה. יש ליצור קשר עם המנהל להשמה במחלקה.',
      'error'
    );
    return { blocked: true, showInspectorWarning: false };
  }

  if (disableRequest) {
    toastService.showPersistent(
      'לא ניתן לשלוח בקשה: למשתמש שנבחר אין רישיון ממשלתי תקף. לעדכון פרטים יש ליצור קשר עם המנהל.',
      'error'
    );
    return { blocked: true, showInspectorWarning: false };
  }

  const carControl = form.get('car');
  const selectedCarId = carControl?.value;
  const selectedCar = allCars.find((car) => car.id === selectedCarId);
  const selectedCarType = selectedCar?.type?.toLowerCase() || '';
  const reasonControl = form.get('four_by_four_reason');

  if (form.errors?.['inspectorClosureTime']) {
    toastService.show(
      'לא ניתן לשלוח בקשה: זמני הנסיעה חופפים לזמני הפסקה של מנהל רכבים (11:15-12:15)',
      'error'
    );
    return { blocked: true, showInspectorWarning: false };
  }

  if (
    (selectedCarType.includes('4x4') ||
      selectedCarType.includes('jeep') ||
      selectedCarType.includes('van')) &&
    (!reasonControl?.value || reasonControl.value.trim() === '')
  ) {
    reasonControl?.setErrors({ required: true });
    reasonControl?.markAsTouched();
    return { blocked: true, showInspectorWarning: false };
  } else if (reasonControl?.hasError('required')) {
    reasonControl.setErrors(null);
  }

  const extendedReasonControl = form.get('extended_ride_reason');
  if (
    isExtendedRequest &&
    (!extendedReasonControl?.value || extendedReasonControl.value.trim() === '')
  ) {
    extendedReasonControl?.setErrors({ required: true });
    extendedReasonControl?.markAsTouched();
    toastService.show('נא לפרט את הסיבה לנסיעה ממושכת', 'error');
    return { blocked: true, showInspectorWarning: false };
  } else if (
    extendedReasonControl?.hasError('required') &&
    !isExtendedRequest
  ) {
    extendedReasonControl.setErrors(null);
  }

  const extraStopsControl = form.get('extraStops');
  if (extraStopsControl?.errors?.['consecutiveDuplicateStops']) {
    toastService.show('תחנות עוקבות לא יכולות להיות זהות.', 'error');
    extraStopsControl.markAsTouched();
    return { blocked: true, showInspectorWarning: false };
  }

  if (form.invalid) {
    form.markAllAsTouched();
    toastService.show('יש להשלים את כל שדות הטופס כנדרש', 'error');
    return { blocked: true, showInspectorWarning: false };
  }

  if (!selectedCarId) {
    toastService.show('יש לבחור רכב מהתפריט', 'error');
    return { blocked: true, showInspectorWarning: false };
  }

  const rideDate = form.get('ride_date')?.value;
  const startHour = form.get('start_hour')?.value;
  const startMinute = form.get('start_minute')?.value;
  const endHour = form.get('end_hour')?.value;
  const endMinute = form.get('end_minute')?.value;

  const startTime =
    startHour && startMinute ? `${startHour}:${startMinute}` : null;
  const endTime = endHour && endMinute ? `${endHour}:${endMinute}` : null;

  if (rideDate && startTime && endTime && selectedCarId) {
    const isPending = isVehiclePendingForRide(
      selectedCarId,
      rideDate,
      startTime,
      endTime,
      pendingVehicles
    );

    if (isPending) {
      toastService.show('הרכב שבחרת ממתין לעיבוד ולא זמין כרגע', 'error');
      return { blocked: true, showInspectorWarning: false };
    }
  }

  const ridePeriod = form.get('ride_period')?.value as 'morning' | 'night';
  if (
    ridePeriod === 'morning' &&
    startTime &&
    endTime &&
    startTime >= endTime
  ) {
    toastService.show('שעת הסיום חייבת להיות אחרי שעת ההתחלה', 'error');
    return { blocked: true, showInspectorWarning: false };
  }

  if (
    !confirmedWarning &&
    ridePeriod === 'morning' &&
    startTime &&
    isDuringInspectorClosure(startTime)
  ) {
    return { blocked: true, showInspectorWarning: true };
  }

  return { blocked: false, showInspectorWarning: false };
}
