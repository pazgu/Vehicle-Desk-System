import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-new-ride',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-ride.component.html',
  styleUrl: './new-ride.component.css'
})
export class NewRideComponent {

  public estimated_distance_km: number = 0;
  public start_time: string = '';  // only time
  public end_time: string = '';    // only time

  constructor(private router: Router) {}

  public submit(): void {

    // In a real app, here you'd combine the time with today's date in the backend.

    console.log({
      estimated_distance_km: this.estimated_distance_km,
      start_time: this.start_time,
      end_time: this.end_time
    });

    alert('הבקשה נשלחה!');
    this.router.navigate(['/']);
  }
}
