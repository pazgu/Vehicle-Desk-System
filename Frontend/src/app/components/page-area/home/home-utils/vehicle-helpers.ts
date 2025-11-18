import { AbstractControl } from '@angular/forms';
import {
  normalizeDateString,
  addHoursToTime,
  checkTimeOverlap,
} from './time-helpers';

export interface PendingVehicle {
  vehicle_id: string;
  date: string;
  period: string;
  start_time?: string;
  end_time?: string;
}

export interface Vehicle {
  id: string;
  plate_number: string;
  type: string;
  fuel_type: string;
  status: string;
  freeze_reason?: string | null;
  last_used_at?: string;
  mileage: number;
  image_url: string;
  vehicle_model: string;
}

export function normalizeVehiclesResponse(raw: any[]): Vehicle[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((v: any) => ({
    ...v,
    image_url: v?.image_url || 'assets/default-car.png',
    vehicle_model: v?.vehicle_model || 'רכב ללא דגם',
    freeze_reason: v?.freeze_reason ?? null,
  }));
}

export function normalizePendingVehiclesResponse(response: any): PendingVehicle[] {
  let pendingData: any[] = [];

  if (Array.isArray(response)) {
    pendingData = response;
  } else if (response && Array.isArray(response.data)) {
    pendingData = response.data;
  } else if (response && Array.isArray(response.pending_vehicles)) {
    pendingData = response.pending_vehicles;
  }

  return pendingData
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      vehicle_id: String(item.vehicle_id || item.vehicleId || item.car_id || ''),
      date: String(item.date || item.ride_date || ''),
      period: String(item.period || item.ride_period || ''),
      start_time: item.start_time || item.startTime || undefined,
      end_time: item.end_time || item.endTime || undefined,
    }))
    .filter((item) => item.vehicle_id && item.date && item.period);
}

export function filterAvailableCars(
  allCars: Vehicle[],
  selectedType: string | null | undefined
): Vehicle[] {
  if (!selectedType) return [];
  return allCars.filter((car) => car.type === selectedType);
}

export function syncCarControlWithAvailableCars(
  carControl: AbstractControl | null | undefined,
  availableCars: Vehicle[],
  isPendingVehicle: (id: string) => boolean
): void {
  if (!carControl) return;

  if (availableCars.length === 1) {
    const onlyCar = availableCars[0];
    carControl.setValue(onlyCar.id);
    carControl.markAsTouched();
    carControl.updateValueAndValidity();

    if (carControl.errors?.['pending'] && !isPendingVehicle(onlyCar.id)) {
      carControl.setErrors(null);
      carControl.updateValueAndValidity();
    }
  } else {
    const selectedCar = carControl.value;

    if (selectedCar && !availableCars.some((car) => car.id === selectedCar)) {
      carControl.setValue(null);
    }
    if (availableCars.length === 0) {
      if (selectedCar !== null) {
        carControl.setValue(null);
        carControl.markAsTouched();
        carControl.markAsDirty();
        carControl.setErrors({ required: true });
      }

      if ((carControl.touched || carControl.dirty) && !carControl.value) {
        carControl.setErrors({ required: true });
      }
    }
  }

  const carId = carControl.value;
  if (carId && isPendingVehicle(carId)) {
    setTimeout(() => {
      carControl.setErrors({ pending: true });
      carControl.markAsTouched();
      carControl.markAsDirty();
    });
  } else if (carControl.errors?.['pending'] && !isPendingVehicle(carId)) {
    carControl.setErrors(null);
    carControl.updateValueAndValidity();
  }
}

export function isVehiclePendingForRide(
  vehicleId: string,
  rideDate: string,
  startTime: string,
  endTime: string,
  pendingVehicles: PendingVehicle[]
): boolean {
  if (!vehicleId || !rideDate || !startTime || !endTime) return false;

  const normalizedRideDate = normalizeDateString(rideDate);

  return pendingVehicles.some((pv) => {
    const normalizedPendingDate = normalizeDateString(pv.date);

    const basicMatch =
      pv.vehicle_id === vehicleId && normalizedPendingDate === normalizedRideDate;

    if (!basicMatch) return false;
    if (!pv.start_time || !pv.end_time) {
      return true;
    }

    const pendingEndTimeWithBuffer = addHoursToTime(pv.end_time, 2);

    const hasTimeOverlap = checkTimeOverlap(
      startTime,
      endTime,
      pv.start_time,
      pendingEndTimeWithBuffer
    );

    return hasTimeOverlap;
  });
}
