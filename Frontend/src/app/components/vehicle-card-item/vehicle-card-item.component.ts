import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VehicleService } from '../../services/vehicle.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-vehicle-card-item',
  templateUrl: './vehicle-card-item.component.html',
  styleUrls: ['./vehicle-card-item.component.css'],
  imports: [CommonModule]
})
export class VehicleCardItemComponent implements OnInit {
  vehicle: any;

  constructor(private route: ActivatedRoute, private vehicleService:  VehicleService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.vehicleService.getVehicleById(id).subscribe(data => {
        this.vehicle = data;
      });
    }
  }
}