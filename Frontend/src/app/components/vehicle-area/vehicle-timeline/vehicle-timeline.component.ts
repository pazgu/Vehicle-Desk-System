import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-vehicle-timeline',
  imports: [CommonModule],
  templateUrl: './vehicle-timeline.component.html',
  styleUrl: './vehicle-timeline.component.css'
})
export class VehicleTimelineComponent implements OnInit {
  vehicleId: string | null = null;
  vehicleTimelineData: any[] = []; // Replace 'any' with your actual data type

    constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit(): void {
    this.vehicleId = this.route.snapshot.paramMap.get('id');
    if (this.vehicleId) {
      this.loadVehicleTimeline();
    }
  }

  loadVehicleTimeline(): void {
    if (!this.vehicleId) return;

    const from = '2024-07-01';
    const to = '2024-07-31';

    const params = new HttpParams()
      .set('from', from)
      .set('to', to);

    this.http.get<any[]>(`${environment.apiUrl}/vehicles/${this.vehicleId}/timeline`, { params })
      .subscribe({
        next: data => {
          console.log('✅ Timeline data:', data);
          this.vehicleTimelineData = data;
        },
        error: err => {
          console.error('❌ Error loading vehicle timeline:', err);
        }
      });
  }

}
