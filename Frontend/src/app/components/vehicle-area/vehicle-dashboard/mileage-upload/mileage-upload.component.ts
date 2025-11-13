import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VehicleService } from '../../../../services/vehicle.service';

@Component({
  selector: 'app-mileage-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mileage-upload.component.html',
  styleUrl: './mileage-upload.component.css',
})
export class MileageUploadComponent {
  @Input() showMileageUpload: boolean = false;

  selectedFile: File | null = null;
  isLoading = false;
  uploadSuccess = false;
  uploadError: string | null = null;
  uploadSummary: { vehiclesUpdated: number; warnings: string[] } | null = null;

  constructor(private vehicleService: VehicleService) {}

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      this.uploadError = null;
      this.uploadSuccess = false;
      this.uploadSummary = null;
    }
  }

  uploadMileageReport() {
    if (!this.selectedFile) return;

    this.isLoading = true;
    this.uploadError = null;
    this.uploadSuccess = false;
    this.uploadSummary = null;

    this.vehicleService.uploadMileageReport(this.selectedFile).subscribe({
      next: (response: any) => {
        this.uploadSuccess = true;
        this.uploadSummary = {
          vehiclesUpdated: response.vehicles_updated || 0,
          warnings: response.warnings || [],
        };
      },
      error: (err) => {
        this.uploadError = err.error?.detail || 'אירעה שגיאה בלתי צפויה';
      },
      complete: () => {
        this.isLoading = false;
        this.selectedFile = null;
      },
    });
  }
}
