// import { Component, OnInit } from '@angular/core';
// import { ActivatedRoute } from '@angular/router';
// import { HttpClient, HttpParams } from '@angular/common/http';
// import { environment } from '../../../../environments/environment';
// import { CommonModule } from '@angular/common';

// @Component({
//   selector: 'app-vehicle-timeline',
//   imports: [CommonModule],
//   templateUrl: './vehicle-timeline.component.html',
//   styleUrl: './vehicle-timeline.component.css'
// })
// export class VehicleTimelineComponent implements OnInit {
//   vehicleId: string | null = null;
//   vehicleTimelineData: any[] = []; // Replace 'any' with your actual data type

//     currentWeekStart: Date = this.getStartOfWeek(new Date());
//     weekEnd: Date = this.getWeekEnd(this.currentWeekStart);



//     constructor(private route: ActivatedRoute, private http: HttpClient) {}

//   ngOnInit(): void {
//     this.vehicleId = this.route.snapshot.paramMap.get('id');
//     if (this.vehicleId) {
//       this.loadVehicleTimeline(this.currentWeekStart); // ✅ NEW VERSION
//     }
//   }


// loadVehicleTimeline(weekStart: Date): void {
//   if (!this.vehicleId) return;

//   const sunday = new Date(weekStart);
//   sunday.setHours(0, 0, 0, 0);

//   const saturday = new Date(sunday);
//   saturday.setDate(sunday.getDate() + 6);
//   saturday.setHours(23, 59, 59, 999);

//   const from = sunday.toISOString().split('T')[0];
//   const to = saturday.toISOString().split('T')[0];

//   const params = new HttpParams()
//     .set('from', from)
//     .set('to', to);

//   this.http.get<any[]>(`${environment.apiUrl}/vehicles/${this.vehicleId}/timeline`, { params })
//     .subscribe({
//       next: data => {
//         this.vehicleTimelineData = data;
//       },
//       error: err => {
//         console.error('❌ Error loading vehicle timeline:', err);
//       }
//     });
// }


// getDaysRange(): Date[] {
//   const days: Date[] = [];
//   for (let i = 0; i < 7; i++) {
//     const day = new Date(this.currentWeekStart);
//     day.setDate(this.currentWeekStart.getDate() + i);
//     days.push(day);
//   }
//   return days;
// }


// getHoursRange(): number[] {
//   return Array.from({ length: 24 }, (_, i) => i);
// }

// getRidesForHour(day: Date, hour: number): any[] {
//   const startOfHour = new Date(day);
//   startOfHour.setHours(hour, 0, 0, 0);

//   const endOfHour = new Date(day);
//   endOfHour.setHours(hour + 1, 0, 0, 0);

//   return this.vehicleTimelineData.filter((ride) => {
//     const start = new Date(ride.start_datetime);
//     const end = new Date(ride.end_datetime);
//     return (
//       start < endOfHour &&
//       end > startOfHour
//     );
//   });
// }

// getColorByStatus(status: string): string {
//   switch (status?.toLowerCase()) {
//     case 'approved': return '#4caf50';
//     case 'pending': return '#ffc107';
//     case 'rejected': return '#f44336';
//     default: return '#90a4ae';
//   }
// }

// getStartOfWeek(date: Date): Date {
//   const sunday = new Date(date);
//   sunday.setDate(date.getDate() - date.getDay());
//   sunday.setHours(0, 0, 0, 0);
//   return sunday;
// }

// getWeekEnd(startOfWeek: Date): Date {
//   const end = new Date(startOfWeek);
//   end.setDate(end.getDate() + 6);
//   return end;
// }

// navigateWeek(offset: number): void {
//   this.currentWeekStart.setDate(this.currentWeekStart.getDate() + offset * 7);
//   this.weekEnd = this.getWeekEnd(this.currentWeekStart);
//   this.loadVehicleTimeline(this.currentWeekStart);
// }



// }

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  imports: [CommonModule],
  templateUrl: './vehicle-timeline.component.html',
  styleUrl: './vehicle-timeline.component.css'
})
export class VehicleTimelineComponent implements OnInit {
  vehicleId: string | null = null;
  vehicleTimelineData: any[] = [];
  
  processedRides = new Map<string, RenderableRide[]>();

  currentWeekStart: Date = this.getStartOfWeek(new Date());
  weekEnd: Date = this.getWeekEnd(this.currentWeekStart);
  
  private HOUR_SLOT_HEIGHT = 40;
  private VERTICAL_GAP_PX = 6; // Keep this for the vertical invisible borders

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.vehicleId = this.route.snapshot.paramMap.get('id');
    if (this.vehicleId) {
      this.loadVehicleTimeline(this.currentWeekStart);
    }
  }

  loadVehicleTimeline(weekStart: Date): void {
    if (!this.vehicleId) return;

    const from = new Date(weekStart);
    from.setHours(0, 0, 0, 0);

    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);

    const params = new HttpParams()
      .set('from', from.toISOString().split('T')[0])
      .set('to', to.toISOString().split('T')[0]);

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
        loopDay.setHours(0,0,0,0);

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

  // ✅ UPDATED: Color palette inspired by the example table
  getColorByStatus(status: string): string {
    switch (status?.toLowerCase()) {
      case 'approved': return '#a4d1ae'; // Light Green
      case 'pending': return '#f5e2a8'; // Light Amber
      case 'rejected': return '#f1b5b5'; // Light Red
      case 'completed': return '#b7dbf3'; // Light Blue
      case 'cancelled': return '#bfb9b9'; // Light Grey (assuming 'cancelled' is a possible status)
      default: return '#90a4ae'; // Original Grey for unhandled statuses
    }
  }
  
  getDateKey(date: Date): string {
    return date.toISOString().split('T')[0];
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
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  getWeekEnd(startOfWeek: Date): Date {
    const end = new Date(startOfWeek);
    end.setDate(end.getDate() + 6);
    return end;
  }

  navigateWeek(offset: number): void {
    const newStartDate = new Date(this.currentWeekStart);
    newStartDate.setDate(newStartDate.getDate() + offset * 7);
    this.currentWeekStart = newStartDate;
    this.weekEnd = this.getWeekEnd(this.currentWeekStart);
    this.loadVehicleTimeline(this.currentWeekStart);
  }
}