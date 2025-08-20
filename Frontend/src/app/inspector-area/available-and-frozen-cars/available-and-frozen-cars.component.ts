import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../services/vehicle.service';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-available-and-frozen-cars',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './available-and-frozen-cars.component.html',
  styleUrls: ['./available-and-frozen-cars.component.css']
})
export class AvailableAndFrozenCarsComponent implements OnInit {
  availableNotParkedCars: any[] = [];
  frozenCars: any[] = [];
  loading = true;

  constructor(private vehicleService: VehicleService) {}

  ngOnInit(): void {
    this.vehicleService.getAllVehicles().subscribe({
      next: (vehicles) => {
        this.availableNotParkedCars = vehicles.filter(v =>
v.status === 'available'
        );
        this.frozenCars = vehicles.filter(v => v.status === 'frozen');
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to fetch vehicles:', err);
        this.loading = false;
      }
    });
  }
}
