import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-new-ride',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './new-ride.component.html',
  styleUrl: './new-ride.component.css'
})
export class NewRideComponent {

  public estimated_distance_km: number = 0;
  public start_time: string = '';  // only time
  public end_time: string = '';    // only time
  public ride_type: string = '';

  public estimated_distance_with_buffer: number = 0;

  constructor(private router: Router) {}

  public updateDistance(): void {
    this.estimated_distance_with_buffer = this.estimated_distance_km * 1.1;
  }

  public submit(): void {

    this.updateDistance();

    console.log({
      estimated_distance_km: this.estimated_distance_km,
      estimated_distance_with_buffer: this.estimated_distance_with_buffer,
      ride_type: this.ride_type,
      start_time: this.start_time,
      end_time: this.end_time
    });

    alert('הבקשה נשלחה!');
    this.router.navigate(['/']);
  }

}
