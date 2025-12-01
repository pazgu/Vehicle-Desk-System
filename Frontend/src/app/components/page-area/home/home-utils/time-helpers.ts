import { FormGroup } from '@angular/forms';

export function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (const minutes of [0, 15, 30, 45]) {
      const formatted = `${hour.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}`;
      options.push(formatted);
    }
  }
  return options;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') {
    return 0;
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

export function addHoursToTime(timeString: string, hoursToAdd: number): string {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  date.setHours(date.getHours() + hoursToAdd);

  const newHours = date.getHours();
  const newMinutes = date.getMinutes();

  return `${newHours.toString().padStart(2, '0')}:${newMinutes
    .toString()
    .padStart(2, '0')}`;
}

export function checkTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = timeToMinutes(end1);
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = timeToMinutes(end2);

  const end1Adjusted =
    end1Minutes < start1Minutes ? end1Minutes + 1440 : end1Minutes;
  const end2Adjusted =
    end2Minutes < start2Minutes ? end2Minutes + 1440 : end2Minutes;

  return start1Minutes < end2Adjusted && start2Minutes < end1Adjusted;
}

export function isValidQuarterHourTime(time: string): boolean {
  const parts = time.split(':');
  if (parts.length !== 2) return false;
  const minutes = Number(parts[1]);
  return [0, 15, 30, 45].includes(minutes);
}

export function correctToNearestQuarter(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const quarterIntervals = [0, 15, 30, 45];

  let closestQuarter = quarterIntervals.reduce((prev, curr) =>
    Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev
  );

  if (minutes > 52) {
    closestQuarter = 0;
    const newHours = hours === 23 ? 0 : hours + 1;
    return `${newHours.toString().padStart(2, '0')}:00`;
  }

  return `${hours.toString().padStart(2, '0')}:${closestQuarter
    .toString()
    .padStart(2, '0')}`;
}

export function normalizeDateString(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr;
    }
    return date.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

export function calculateMinDate(): string {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

export function padTo2(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) {
    return '00';
  }
  return num.toString().padStart(2, '0');
}

export function buildDateTime(
  dateStr: string,
  hour: string | number,
  minute: string | number
): string {
  return `${dateStr} ${padTo2(hour)}:${padTo2(minute)}:00`;
}

export function toIsoDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    return dateStr;
  }
  return d.toISOString().split('T')[0];
}

export function isDuringInspectorClosure(startTime: string): boolean {
  if (!startTime) return false;

  const startMinutes = timeToMinutes(startTime);
  const startRange = timeToMinutes('11:15');
  const endRange = timeToMinutes('12:15');

  return startMinutes >= startRange && startMinutes <= endRange;
}
export function setClosestQuarterHourTimeOnForm(
  form: FormGroup,
  timeOptions: string[]
): void {
  const now = new Date();
  now.setHours(now.getHours() + 2);

  const minutes = now.getMinutes();
  const remainder = minutes % 15;
  const addMinutes = remainder === 0 ? 15 : 15 - remainder;

  now.setMinutes(minutes + addMinutes);
  now.setSeconds(0, 0);

  const startHour = now.getHours();
  const startMinute = now.getMinutes();

  let endHour = startHour + 1;
  let endMinute = startMinute;

  if (endHour >= 24) {
    endHour = 0;
  }

  const formattedStartTime = `${padTo2(startHour)}:${padTo2(startMinute)}`;
  const startTimeIndex = timeOptions.indexOf(formattedStartTime);
  const fallbackEnd = `${padTo2(endHour)}:${padTo2(endMinute)}`;
  const formattedEndTime = timeOptions[startTimeIndex + 1] || fallbackEnd;

  form.patchValue({
    start_time: formattedStartTime,
    end_time: formattedEndTime,
    start_hour: padTo2(startHour),
    start_minute: padTo2(startMinute),
    end_hour: padTo2(endHour),
    end_minute: padTo2(endMinute),
  });
}
