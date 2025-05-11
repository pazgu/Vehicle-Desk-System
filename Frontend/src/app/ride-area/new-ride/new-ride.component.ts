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



//the structre is - componments : 
//                 layout-area:
//                  1.header - where the default navbar is 
//                  2.layout 
//                 page-area:
//                  1.about
//                  2.home
//                  3.login-area/user-area : 
//                   - login 
//                   - register
//                  4.page404
//                 models : 
//                 1.credintals.model
//                 2.ride.model
//                 3.user.model 
//                ride-area:
//                1.future-ride-cards
//                2.new-ride
//                3.past-ride-cards
// app componments.css  , app componments.html , app componments.ts , app.config.ts , app.routes , index.html
// main.ts , style.css 