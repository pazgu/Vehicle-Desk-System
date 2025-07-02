import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';

interface RenderableRide {
  top: number;
  height: number;
  status: string;
  first_name: string;
  last_name: string;
  purpose: string;
  start_datetime: string;
  end_datetime: string;
  user_id: string;
  [key: string]: any;
}

@Component({
  selector: 'app-vehicle-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vehicle-timeline.component.html',
  styleUrl: './vehicle-timeline.component.css'
})
export class VehicleTimelineComponent implements OnInit {
  vehicleId: string | null = null;
  vehicleTimelineData: any[] = [];

  processedRides = new Map<string, RenderableRide[]>();

  currentWeekStart: Date; // Initialized in ngOnInit
  weekEnd: Date; // Initialized in ngOnInit

  private HOUR_SLOT_HEIGHT = 40;
  private VERTICAL_GAP_PX = 4;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {
    // Initialize with dummy values, will be overwritten in ngOnInit
    this.currentWeekStart = new Date();
    this.weekEnd = new Date();
  }

  ngOnInit(): void {
    this.vehicleId = this.route.snapshot.paramMap.get('id');

    const fromParam = this.route.snapshot.queryParamMap.get('from');

    let initialDesiredDate: Date;

    if (fromParam && this.isValidDateString(fromParam)) {
      // If 'from' param exists and is valid, use it as the starting point
      initialDesiredDate = new Date(fromParam + 'T00:00:00'); // Parse as start of that day in local time
      console.log('✅ Initializing based on URL query param "from":', fromParam);
    } else {
      // If no valid 'from' param, default to current logic for today's view
      // This is the core logic that determines *which* week's Sunday you want to show
      const today = new Date();
      // If today is Saturday (getDay() returns 6), we want the NEXT Sunday.
      // Otherwise (Sunday-Friday), we want *this* Sunday.
      if (today.getDay() === 6) { // Saturday
        initialDesiredDate = new Date(today);
        initialDesiredDate.setDate(today.getDate() + 1); // Advance to Sunday
        console.log('Detected Saturday, setting initial desired date to next Sunday:', this.formatDateToYYYYMMDD(initialDesiredDate));
      } else {
        // Sunday (0) to Friday (5) - use today's date to find its Sunday
        initialDesiredDate = new Date(today);
        console.log('Detected Sunday-Friday, setting initial desired date to today:', this.formatDateToYYYYMMDD(initialDesiredDate));
      }
    }

    // Now, derive currentWeekStart (Sunday) from the initialDesiredDate
    this.currentWeekStart = this.getStartOfWeek(initialDesiredDate);
    // And calculate the corresponding weekEnd (Saturday)
    this.weekEnd = this.getWeekEnd(this.currentWeekStart);

    // Always ensure the URL reflects the currently determined week.
    this.updateUrlQueryParams();

    if (this.vehicleId) {
      this.loadVehicleTimeline(this.currentWeekStart);
    }
  }

  // --- Utility Functions for Date Handling ---

  // Converts a Date object to YYYY-MM-DD format (local time)
  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Checks if a string is a valid YYYY-MM-DD date string
  private isValidDateString(dateString: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    // Attempt to parse and check if it's a valid date
    const d = new Date(dateString + 'T00:00:00'); // Use 'T00:00:00' to force local day start
    return !isNaN(d.getTime()) && this.formatDateToYYYYMMDD(d) === dateString;
  }

  // --- Core Scheduler Logic (unchanged from last correct version) ---

  loadVehicleTimeline(weekStart: Date): void {
    if (!this.vehicleId) return;

    // Use component's properties, which are already correct Sunday-Saturday range
    const from = this.formatDateToYYYYMMDD(this.currentWeekStart);
    const to = this.formatDateToYYYYMMDD(this.weekEnd);

    const params = new HttpParams()
      .set('from', from)
      .set('to', to);

    console.log('🚀 Requesting timeline with API params (from, to):', from, to);
    console.log('📡 Full URL for API call:', `${environment.apiUrl}/vehicles/${this.vehicleId}/timeline?${params}`);

    this.http.get<any[]>(`${environment.apiUrl}/vehicles/${this.vehicleId}/timeline`, { params })
      .subscribe({
        next: data => {
          this.vehicleTimelineData = data;
          this.processRidesForDisplay();
        },
        error: err => {
          console.error('❌ Error loading vehicle timeline:', err);
          this.vehicleTimelineData = [];
          this.processRidesForDisplay();
        }
      });
  }

  processRidesForDisplay(): void {
    this.processedRides.clear();
    const daysInView = this.getDaysRange();

    daysInView.forEach(day => {
      this.processedRides.set(this.getDateKey(day), []);
    });

    for (const ride of this.vehicleTimelineData) {
      const rideStart = new Date(ride.start_datetime);
      const rideEnd = new Date(ride.end_datetime);

      let loopDay = new Date(rideStart);
      loopDay.setHours(0, 0, 0, 0);

      while (loopDay <= rideEnd) {
        const dayKey = this.getDateKey(loopDay);

        if (this.processedRides.has(dayKey)) {
          const blockStart = (rideStart > loopDay) ? rideStart : loopDay;
          const endOfDay = new Date(loopDay);
          endOfDay.setHours(23, 59, 59, 999);
          const blockEnd = (rideEnd < endOfDay) ? rideEnd : endOfDay;

          const startMinutes = blockStart.getHours() * 60 + blockStart.getMinutes();
          const endMinutes = blockEnd.getHours() * 60 + blockEnd.getMinutes();
          let durationMinutes = Math.max(1, endMinutes - startMinutes);

          let baseTop = (startMinutes / 60) * this.HOUR_SLOT_HEIGHT;
          let baseHeight = (durationMinutes / 60) * this.HOUR_SLOT_HEIGHT;

          const top = baseTop + this.VERTICAL_GAP_PX;
          const height = Math.max(1, baseHeight - (2 * this.VERTICAL_GAP_PX));

          const dayRides = this.processedRides.get(dayKey)!;
          dayRides.push({
            ...ride,
            top: top,
            height: height,
            status: ride.status,
            first_name: ride.first_name,
            last_name: ride.last_name,
            purpose: ride.purpose,
            user_id: ride.user_id
          });
        }
        loopDay.setDate(loopDay.getDate() + 1);
      }
    }
  }

  getColorByStatus(status: string): string {
    switch (status?.toLowerCase()) {
      case 'approved': return '#a4d1ae';
      case 'pending': return '#f5e2a8';
      case 'in_progress': return '#6aa5d6';
      case 'rejected': return '#f1b5b5';
      case 'completed': return '#b7dbf3';
      case 'cancelled': return '#bfb9b9';
      default: return '#90a4ae';
    }
  }

  getDateKey(date: Date): string {
    // Uses the new utility function
    return this.formatDateToYYYYMMDD(date);
  }

  getDaysRange(): Date[] {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(this.currentWeekStart);
      day.setDate(this.currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }

  getHoursRange(): number[] {
    return Array.from({ length: 24 }, (_, i) => i);
  }

  getStartOfWeek(date: Date): Date {
    // Ensure we start from a clean date at 00:00:00 to avoid timezone shifts
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); // Set to start of the day in local time

    const day = d.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
    d.setDate(d.getDate() - day); // Backtrack to Sunday of the week

    console.log('🧮 Calculated week start (Sunday):', this.formatDateToYYYYMMDD(d));
    return d;
  }

  getWeekEnd(startOfWeek: Date): Date {
    const end = new Date(startOfWeek);
    end.setDate(end.getDate() + 6); // Advance 6 days from Sunday to Saturday
    end.setHours(23, 59, 59, 999); // Set to very end of Saturday
    console.log('🧮 Calculated week end (Saturday):', this.formatDateToYYYYMMDD(end));
    return end;
  }

  navigateWeek(offset: number): void {
    const newDate = new Date(this.currentWeekStart);
    newDate.setDate(newDate.getDate() + offset * 7); // Advance/rewind by full weeks

    // Re-calculate the start and end of the new week
    this.currentWeekStart = this.getStartOfWeek(newDate);
    this.weekEnd = this.getWeekEnd(this.currentWeekStart);

    console.log('🧭 Navigating to new week start:', this.formatDateToYYYYMMDD(this.currentWeekStart));
    console.log('📅 Navigating to new week end:', this.formatDateToYYYYMMDD(this.weekEnd));

    this.loadVehicleTimeline(this.currentWeekStart);
    this.updateUrlQueryParams();
  }

  private updateUrlQueryParams(): void {
    const fromDateString = this.formatDateToYYYYMMDD(this.currentWeekStart);
    const toDateString = this.formatDateToYYYYMMDD(this.weekEnd);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        from: fromDateString,
        to: toDateString,
      },
      queryParamsHandling: 'merge',
    });
    console.log('🔗 URL query params updated to:', fromDateString, 'to', toDateString);
  }
}