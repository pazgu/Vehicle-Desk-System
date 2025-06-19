import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VehicleService } from '../../../services/vehicle.service';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

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

  constructor(private navigateRouter: Router, private route: ActivatedRoute, private vehicleService: VehicleService) { }

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

  // Modified updateVehicleStatus to accept the new status and optionally the freeze reason
  updateVehicleStatus(newStatus: string, reason?: string): void {
    if (!this.vehicle?.id) return;
  
    this.vehicleService.updateVehicleStatus(this.vehicle.id, newStatus, reason).subscribe({
      next: (response) => {
        console.log(`Vehicle status updated to '${newStatus}':`, response);
        this.vehicle.status = newStatus; // Update the local status
        this.vehicle.freeze_reason = newStatus === 'frozen' ? reason : null; // Clear freeze reason if unfreezing
  
        // Reset the dropdown and hide it if freezing
        if (newStatus === 'frozen') {
          this.freezeReason = '';
          this.isFreezeReasonFieldVisible = false;
        }
      },
      error: (err) => {
        console.error(`Failed to update vehicle status to '${newStatus}':`, err);
        alert(`Failed to update vehicle status: ${err.error?.detail || err.message}`);
      }
    });
    this.navigateRouter.navigate(['/vehicle-dashboard']); // או הנתיב המתאים שלך
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

    console.log('Freezing vehicle with reason:', this.freezeReason); // Log the freeze reason

    // Call the common updateVehicleStatus method with 'frozen' status and the reason
    this.updateVehicleStatus('frozen', this.freezeReason);

    // Reset the dropdown and hide it after successful freeze (or if error occurs, the UI will reflect actual state)
    this.freezeReason = '';
    this.isFreezeReasonFieldVisible = false;

  }
}