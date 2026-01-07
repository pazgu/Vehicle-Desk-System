import { FormGroup } from '@angular/forms';

export function extractCityId(raw: any): string | null {
  if (!raw) return null;

  if (typeof raw === 'string') {
    return raw;
  }

  if (typeof raw === 'object' && raw.id) {
    return String(raw.id);
  }

  return null;
}

export function isTelAviv(raw: any): boolean {
  if (!raw) return false;

  if (typeof raw === 'object') {
    const name = raw.name || raw.city_name || raw.label;
    return typeof name === 'string' && name.trim() === 'תל אביב';
  }

  return false;
}

export function isTelAvivById(stopId: string, cities: { id: string; name: string }[]): boolean {
  if (!stopId || !cities || cities.length === 0) return false;
  const city = cities.find(c => c.id === stopId);
  return city?.name?.trim() === 'תל אביב';
}

export function buildRouteStops(
  extraStops: string[],
  finalStopId: string
): string[] {
  const cleanExtraStops = (extraStops || []).filter(
    (id) => !!id && typeof id === 'string' && id.trim() !== ''
  );

  return [...cleanExtraStops, finalStopId];
}

export function shouldResetDistance(
  startId: string | null,
  stopId: string | null
): boolean {
  if (!startId || !stopId) return true;
  return false;
}

export function applyDistanceBuffer(distance: number | null): number | null {
  if (distance == null) return null;
  return +(distance * 1.1).toFixed(2);
}

export function clearDistanceOnForm(form: FormGroup): void {
  form.get('estimated_distance_km')?.setValue(null, { emitEvent: false });
}
