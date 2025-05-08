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
  public ride_type: string = '';

  constructor(private router: Router) {}

  public submit(): void {

    // Add 10% to estimated distance
    const final_distance = this.estimated_distance_km * 1.10;

    console.log({
      estimated_distance_km: final_distance.toFixed(2),
      start_time: this.start_time,
      end_time: this.end_time,
      ride_type: this.ride_type
    });

    alert('הבקשה נשלחה!');
    this.router.navigate(['/']);
  }
}
