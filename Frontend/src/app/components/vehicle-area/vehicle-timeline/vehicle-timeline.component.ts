
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VehicleTimelineService } from '../../../services/vehicle-timeline';
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
  styleUrls: ['./vehicle-timeline.component.css'],
})
export class VehicleTimelineComponent implements OnInit, OnDestroy {
  vehicleId: string | null = null;
  vehicleTimelineData: any[] = [];
  processedRides = new Map<string, RenderableRide[]>();

  currentWeekStart: Date;
  weekEnd: Date;

  private HOUR_SLOT_HEIGHT = 40;
  private VERTICAL_GAP_PX = 4;
  

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
  hoverCardSide: 'right' | 'left' = 'right';
  private currentHoveredElement: HTMLElement | null = null;

  
  private boundOnScroll = (ev?: Event) => {
    if (this.hoverCardVisible) {
      this.hoverCardVisible = false;
      this.hoveredRide = null;
      this.currentHoveredElement = null;
    }
  };

  private boundOnDocumentMouseMove = (event: MouseEvent) => {
    if (!this.hoverCardVisible || !this.currentHoveredElement) return;

    const blockRect = this.currentHoveredElement.getBoundingClientRect();
    const mouseX = event.clientX;
    const mouseY = event.clientY;

    const isOnBlock =
      mouseX >= blockRect.left &&
      mouseX <= blockRect.right &&
      mouseY >= blockRect.top &&
      mouseY <= blockRect.bottom;

    const cardElement = document.querySelector(
      '.hover-card'
    ) as HTMLElement | null;
    let isOnCard = false;
    if (cardElement) {
      const cardRect = cardElement.getBoundingClientRect();
      isOnCard =
        mouseX >= cardRect.left &&
        mouseX <= cardRect.right &&
        mouseY >= cardRect.top &&
        mouseY <= cardRect.bottom;
    }

    if (!isOnBlock && !isOnCard) {
      this.hoverCardVisible = false;
      this.hoveredRide = null;
      this.currentHoveredElement = null;
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vehicleTimelineService: VehicleTimelineService,
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
        console.log(
          '📅 Today is Saturday, moving to next Sunday:',
          initialDesiredDate
        );
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

    
    window.addEventListener('scroll', this.boundOnScroll, true);
    document.addEventListener('mousemove', this.boundOnDocumentMouseMove);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.boundOnScroll, true);
    document.removeEventListener('mousemove', this.boundOnDocumentMouseMove);
  }

  private getCalendarContainerRect(): DOMRect | null {
    const el = document.querySelector(
      '.timeline-page-wrapper'
    ) as HTMLElement | null;
    return el ? el.getBoundingClientRect() : null;
  }

onRideHover(event: MouseEvent, ride: RenderableRide): void {
    this.hoveredRide = ride;
    this.hoverCardVisible = true;

    const target = event.currentTarget as HTMLElement;
    this.currentHoveredElement = target;

    const rect = target.getBoundingClientRect();

    const cardWidth = 320;
    const cardHeight = 280;
    const gap = 8; 
    const minTopPadding = 80; 

    
    const timelineBody = document.querySelector('.timeline-body') as HTMLElement | null;
    const containerRect = timelineBody ? timelineBody.getBoundingClientRect() : null;
    
    if (!containerRect) {
      return;
    }

    
    const cLeft = containerRect.left;
    const cRight = containerRect.right;
    const cTop = containerRect.top;
    const cBottom = containerRect.bottom;

    const viewportTop = minTopPadding;
    const viewportBottom = window.innerHeight;
    const viewportLeft = 0;
    const viewportRight = window.innerWidth;

    const effectiveTop = Math.max(cTop, viewportTop);
    const effectiveBottom = Math.min(cBottom, viewportBottom);
    const effectiveLeft = Math.max(cLeft, viewportLeft);
    const effectiveRight = Math.min(cRight, viewportRight);

    let x: number;
    const rightPosition = rect.right + gap;
    const leftPosition = rect.left - cardWidth - gap;

    if (rightPosition + cardWidth <= effectiveRight) {
      this.hoverCardSide = 'right';
      x = rightPosition;
    } else if (leftPosition >= effectiveLeft) {
      this.hoverCardSide = 'left';
      x = leftPosition;
    } else {
      this.hoverCardSide = 'right';
      x = Math.max(effectiveLeft, Math.min(rightPosition, effectiveRight - cardWidth));
    }

    let y = rect.top;
    
    if (y < effectiveTop) {
      y = effectiveTop;
    }
    
    if (y + cardHeight > effectiveBottom) {
      y = Math.max(effectiveTop, effectiveBottom - cardHeight);
    }
    
    y = Math.max(y, effectiveTop);

    this.hoverCardPosition.x = Math.round(x);
    this.hoverCardPosition.y = Math.round(y);
  }

  onRideLeave(): void {
    this.hoverCardVisible = false;
    this.hoveredRide = null;
    this.currentHoveredElement = null;
  }

  onRideClick(ride: RenderableRide): void {
    console.log('🖱️ Clicked ride:', ride);
  }

  loadVehicleTimeline(weekStart: Date): void {
    if (!this.vehicleId) {
      console.warn('⚠️ No vehicleId, skipping API call');
      return;
    }

    const from = this.formatDateToYYYYMMDD(this.currentWeekStart);
    const to = this.formatDateToYYYYMMDD(this.weekEnd);

    console.log(`📡 Fetching timeline: ${from} → ${to}`);

    this.vehicleTimelineService
  .getVehicleTimeline(this.vehicleId, from, to)
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

          console.log(
            `📌 Added ride to ${dayKey}: top=${top}, height=${height}`
          );
        }

        loopDay.setDate(loopDay.getDate() + 1);
      }
    }
    console.log('✅ Finished processing rides:', this.processedRides);
  }

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

    console.log(
      '⏭️ Navigating weeks:',
      this.currentWeekStart,
      '→',
      this.weekEnd
    );

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
      approved: 'מאושר',
      pending: 'ממתין לאישור',
      in_progress: 'בביצוע',
      rejected: 'נדחה',
      completed: 'הושלם',
      cancelled: 'בוטל',
    };
    return statusMap[status?.toLowerCase()] || status;
  }
}
