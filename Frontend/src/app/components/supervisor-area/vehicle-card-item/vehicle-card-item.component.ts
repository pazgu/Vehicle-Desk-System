import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VehicleService } from '../../../services/vehicle.service';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-vehicle-card-item',
  templateUrl: './vehicle-card-item.component.html',
  styleUrls: ['./vehicle-card-item.component.css'],
  imports: [CommonModule, CardModule, FormsModule],
})
export class VehicleCardItemComponent implements OnInit {
  vehicle: any;
  isFreezeReasonFieldVisible: boolean = false; // Controls visibility of the input field
  freezeReason: string = ''; // Holds the freeze reason entered by the user

  constructor(private route: ActivatedRoute, private vehicleService: VehicleService) { }

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Always scroll to top

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.vehicleService.getVehicleById(id).subscribe(data => {
        console.log('Vehicle from API:', data); // See what you actually get
        this.vehicle = data;
      });
    }
  }
  getCardClass(status: string): string {
    switch (status) {
      case 'available': return 'card-available';
      case 'in_use': return 'card-inuse';
      case 'frozen': return 'card-frozen';
      default: return '';
    }
  }

  goBack(): void {
    window.history.back();
  }

  translateStatus(status: string | null | undefined): string {
    if (!status) return '';
    switch (status.toLowerCase()) {
      case 'available':
        return 'זמין';
      case 'in_use':
        return 'בשימוש';
      case 'frozen':
        return 'מוקפא';
      default:
        return status;
    }
  }

  translateType(type: string | null | undefined): string {
    if (!type) return '';
    switch (type.toLowerCase()) {
      case 'small':
        return 'קטן';
      case 'large':
        return 'גדול';
      case 'van':
        return 'מסחרי';
      default:
        return type;
    }
  }

  translateFuelType(fuelType: string | null | undefined): string {
    if (!fuelType) return '';
    switch (fuelType.toLowerCase()) {
      case 'electric':
        return 'חשמלי';
      case 'hybrid':
        return 'היברידי';
      case 'gasoline':
        return 'בנזין';
      default:
        return fuelType;
    }
  }

  translateFreezeReason(freezeReason: string | null | undefined): string {
    if (!freezeReason) return '';
    switch (freezeReason.toLowerCase()) {
      case 'accident':
        return 'תאונה';
      case 'maintenance':
        return 'תחזוקה';
      case 'personal':
        return 'אישי';
      default:
        return freezeReason;
    }
  }

  unfreezeStatus(): void {
    if (!this.vehicle?.id) return;
    this.vehicleService.unfreezeVehicle(this.vehicle.id, 'available').subscribe({
      next: (response) => {
        console.log('Vehicle unfreeze response:', response);
        this.vehicle.status = 'available';
      },
      error: (err) => {
        console.error('Failed to unfreeze vehicle:', err);
        alert(`Failed to unfreeze vehicle: ${err.error?.detail || err.message}`);
      }
    });
  }

  // Show the freeze reason input field
  showFreezeReasonField(): void {
    this.isFreezeReasonFieldVisible = true;
  }

  // Freeze the vehicle with the entered reason
  freezeStatus(): void {
    if (!this.freezeReason.trim()) {
      alert('יש להזין סיבת הקפאה');
      return;
    }

    console.log('Freezing vehicle with reason:', this.freezeReason);
    // Logic to freeze the vehicle
    this.vehicle.status = 'frozen';
    this.vehicle.freeze_reason = this.freezeReason;

    // Reset the input field and hide it
    this.freezeReason = '';
    this.isFreezeReasonFieldVisible = false;
  }
}