import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CommonModule, Location } from '@angular/common';

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
  styleUrls: ['./vehicle-timeline.component.css'], // ✅ fixed plural
})
export class VehicleTimelineComponent implements OnInit {
  vehicleId: string | null = null;
  vehicleTimelineData: any[] = [];
  processedRides = new Map<string, RenderableRide[]>();

  currentWeekStart: Date;
  weekEnd: Date;
  private HOUR_SLOT_HEIGHT = 40;
  private VERTICAL_GAP_PX = 4;
  private HOVER_CARD_WIDTH = 350; 
  private HOVER_CARD_HEIGHT = 350; 
  private CARD_OFFSET = 12;

  statusLegend = [
    { status: 'approved', color: '#a4d1ae', label: 'מאושר' },
    { status: 'pending', color: '#f5e2a8', label: 'ממתין' },
    { status: 'in_progress', color: '#6aa5d6', label: 'בביצוע' },
    { status: 'rejected', color: '#f1b5b5', label: 'נדחה' },
    { status: 'completed', color: '#b7dbf3', label: 'הושלם' },
    { status: 'cancelled', color: '#bfb9b9', label: 'בוטל' },
  ];

  hoverCardVisible: boolean = false;
  hoveredRide: RenderableRide | null = null;
  hoverCardPosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private location: Location
  ) {
    this.currentWeekStart = new Date();
    this.weekEnd = new Date();
  }

  ngOnInit(): void {
    console.log('🔄 VehicleTimelineComponent initialized');

    this.vehicleId = this.route.snapshot.paramMap.get('id');
    console.log('📌 vehicleId from route:', this.vehicleId);

    const fromParam = this.route.snapshot.queryParamMap.get('from');
    console.log('📌 fromParam:', fromParam);

    let initialDesiredDate: Date;

    if (fromParam && this.isValidDateString(fromParam)) {
      initialDesiredDate = new Date(fromParam + 'T00:00:00');
      console.log('📅 Using fromParam as initial date:', initialDesiredDate);
    } else {
      const today = new Date();
      if (today.getDay() === 6) {
        initialDesiredDate = new Date(today);
        initialDesiredDate.setDate(today.getDate() + 1);
        console.log('📅 Today is Saturday, moving to next Sunday:', initialDesiredDate);
      } else {
        initialDesiredDate = new Date(today);
        console.log('📅 Defaulting to today’s week:', initialDesiredDate);
        window.scrollTo({ top: 0 });
      }
    }

    this.currentWeekStart = this.getStartOfWeek(initialDesiredDate);
    this.weekEnd = this.getWeekEnd(this.currentWeekStart);

    console.log('🗓️ Week range:', this.currentWeekStart, '→', this.weekEnd);

    this.updateUrlQueryParams();

    if (this.vehicleId) {
      this.loadVehicleTimeline(this.currentWeekStart);
    }
  }


onRideHover(event: MouseEvent, ride: RenderableRide): void {
  this.hoveredRide = ride;
  this.hoverCardVisible = true;

  const target = event.currentTarget as HTMLElement; // The ride-block
  const rect = target.getBoundingClientRect(); // ride-block's position relative to viewport

  const container = document.querySelector('.timeline-page-wrapper') as HTMLElement;
  if (!container) return;
  const containerRect = container.getBoundingClientRect();

  let x = rect.right - containerRect.left + this.CARD_OFFSET;
  
  let y = rect.top - containerRect.top;

  y += window.scrollY;

  const containerContentWidth = container.clientWidth;
  if (x + this.HOVER_CARD_WIDTH > containerContentWidth) {
    x = rect.left - containerRect.left - this.HOVER_CARD_WIDTH - this.CARD_OFFSET;
  }
  
  const timelineBody = container.querySelector('.timeline-body') as HTMLElement;
  const timelineContentHeight = timelineBody ? timelineBody.scrollHeight + timelineBody.offsetTop : container.scrollHeight;

  if (y + this.HOVER_CARD_HEIGHT > timelineContentHeight) {
    y = timelineContentHeight - this.HOVER_CARD_HEIGHT - this.CARD_OFFSET;
  }
  
  y = Math.max(timelineBody ? timelineBody.offsetTop : 0, y);


  this.hoverCardPosition = { x, y };
}


  onRideLeave(): void {
    console.log('👋 Leaving ride block');
    setTimeout(() => {
      if (!this.isHoveringOverCard()) {
        this.hoverCardVisible = false;
        this.hoveredRide = null;
      }
    }, 100);
  }

  onCloseHoverCard(): void {
    console.log('❌ Closing hover card');
    this.hoverCardVisible = false;
    this.hoveredRide = null;
  }

 private isHoveringOverCard(): boolean {
  const card = document.querySelector('.hover-card');
  return card ? card.matches(':hover') : false;
}


  onRideClick(ride: RenderableRide): void {
    console.log('🖱️ Clicked ride:', ride);
  }

  // --- API Calls ---
  loadVehicleTimeline(weekStart: Date): void {
    if (!this.vehicleId) {
      console.warn('⚠️ No vehicleId, skipping API call');
      return;
    }

    const from = this.formatDateToYYYYMMDD(this.currentWeekStart);
    const to = this.formatDateToYYYYMMDD(this.weekEnd);

    console.log(`📡 Fetching timeline: ${from} → ${to}`);

    const params = new HttpParams().set('from', from).set('to', to);

    this.http
      .get<any[]>(`${environment.apiUrl}/vehicles/${this.vehicleId}/timeline`, {
        params,
      })
      .subscribe({
        next: (data) => {
          console.log('✅ API response:', data);
          this.vehicleTimelineData = data;
          this.processRidesForDisplay();
        },
        error: (err) => {
          console.error('❌ Error loading vehicle timeline:', err);
          this.vehicleTimelineData = [];
          this.processRidesForDisplay();
        },
      });
  }

  processRidesForDisplay(): void {
    console.log('🔄 Processing rides for display');

    this.processedRides.clear();
    const daysInView = this.getDaysRange();

    daysInView.forEach((day) => {
      this.processedRides.set(this.getDateKey(day), []);
    });

    for (const ride of this.vehicleTimelineData) {
      console.log('⏳ Processing ride:', ride);

      const rideStart = new Date(ride.start_datetime);
      const rideEnd = new Date(ride.end_datetime);

      let loopDay = new Date(rideStart);
      loopDay.setHours(0, 0, 0, 0);

      while (loopDay <= rideEnd) {
        const dayKey = this.getDateKey(loopDay);

        if (this.processedRides.has(dayKey)) {
          const blockStart = rideStart > loopDay ? rideStart : loopDay;
          const endOfDay = new Date(loopDay);
          endOfDay.setHours(23, 59, 59, 999);
          const blockEnd = rideEnd < endOfDay ? rideEnd : endOfDay;

          const startMinutes =
            blockStart.getHours() * 60 + blockStart.getMinutes();
          const endMinutes = blockEnd.getHours() * 60 + blockEnd.getMinutes();
          let durationMinutes = Math.max(1, endMinutes - startMinutes);

          let baseTop = (startMinutes / 60) * this.HOUR_SLOT_HEIGHT;
          let baseHeight = (durationMinutes / 60) * this.HOUR_SLOT_HEIGHT;

          const top = baseTop + this.VERTICAL_GAP_PX;
          const height = Math.max(1, baseHeight - 2 * this.VERTICAL_GAP_PX);

          const dayRides = this.processedRides.get(dayKey)!;
          dayRides.push({
            ...ride,
            top,
            height,
            status: ride.status,
            first_name: ride.first_name,
            last_name: ride.last_name,
            purpose: ride.purpose,
            user_id: ride.user_id,
          });

          console.log(`📌 Added ride to ${dayKey}: top=${top}, height=${height}`);
        }

        loopDay.setDate(loopDay.getDate() + 1);
      }
    }
    console.log('✅ Finished processing rides:', this.processedRides);
  }

  // --- Date Helpers ---
  private formatDateToYYYYMMDD(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private isValidDateString(dateString: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
    const d = new Date(dateString + 'T00:00:00');
    return !isNaN(d.getTime()) && this.formatDateToYYYYMMDD(d) === dateString;
  }

  navigateBack(): void {
    const vehicleId = this.route.snapshot.paramMap.get('id');
    console.log('⬅️ Navigating back to vehicle:', vehicleId);
    this.router.navigate(['/vehicle-details', vehicleId]);
  }

  getColorByStatus(status: string): string {
    switch (status?.toLowerCase()) {
      case 'approved':
        return '#a4d1ae';
      case 'pending':
        return '#f5e2a8';
      case 'in_progress':
        return '#6aa5d6';
      case 'rejected':
        return '#f1b5b5';
      case 'completed':
        return '#b7dbf3';
      case 'cancelled':
        return '#bfb9b9';
      default:
        return '#90a4ae';
    }
  }

  getDateKey(date: Date): string {
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
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    d.setDate(d.getDate() - day);
    return d;
  }

  getWeekEnd(startOfWeek: Date): Date {
    const end = new Date(startOfWeek);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  navigateWeek(offset: number): void {
    const newDate = new Date(this.currentWeekStart);
    newDate.setDate(newDate.getDate() + offset * 7);

    this.currentWeekStart = this.getStartOfWeek(newDate);
    this.weekEnd = this.getWeekEnd(this.currentWeekStart);

    console.log('⏭️ Navigating weeks:', this.currentWeekStart, '→', this.weekEnd);

    this.loadVehicleTimeline(this.currentWeekStart);
    this.updateUrlQueryParams();
  }

  private updateUrlQueryParams(): void {
    const fromDateString = this.formatDateToYYYYMMDD(this.currentWeekStart);
    const toDateString = this.formatDateToYYYYMMDD(this.weekEnd);

    console.log('🔗 Updating query params:', fromDateString, toDateString);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        from: fromDateString,
        to: toDateString,
      },
      queryParamsHandling: 'merge',
    });
  }

  trackByDate(index: number, day: Date): string {
    return this.getDateKey(day);
  }

  trackRide(index: number, ride: RenderableRide): string {
    return `${ride.user_id}-${ride.start_datetime}`;
  }
  
  getStatusLabel(status: string): string {
  const statusMap: { [key: string]: string } = {
    'approved': 'מאושר',
    'pending': 'ממתין לאישור',
    'in_progress': 'בביצוע',
    'rejected': 'נדחה',
    'completed': 'הושלם',
    'cancelled': 'בוטל'
  };
  return statusMap[status?.toLowerCase()] || status;
}
}
