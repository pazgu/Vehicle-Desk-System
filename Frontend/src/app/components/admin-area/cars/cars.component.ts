import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-cars',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './cars.component.html',
  styleUrls: ['./cars.component.css']  // ✅ corrected from styleUrl
})
export class CarsComponent {}
