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
  this.resetUploadState();

  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    this.selectedFile = input.files[0];
  }
}
onChooseFileClick(fileInput: HTMLInputElement): void {
  this.resetUploadState();
  this.selectedFile = null;

  fileInput.value = '';
}


  uploadMileageReport() {
    if (!this.selectedFile) {
  this.uploadError = 'יש לבחור קובץ לפני העלאה';
  return;
}

const fileName = this.selectedFile.name.toLowerCase();
if (!fileName.endsWith('.xlsx')) {
  this.uploadError = 'יש להעלות קובץ אקסל בפורמט ‎.xlsx בלבד';
  return;
}

const maxMB = 5;
if (this.selectedFile.size > maxMB * 1024 * 1024) {
  this.uploadError = `הקובץ גדול מדי. הגודל המקסימלי הוא ${maxMB}MB`;
  return;
}


    this.isLoading = true;
    this.uploadError = null;
    this.uploadSuccess = false;
    this.uploadSummary = null;

    this.vehicleService.uploadMileageReport(this.selectedFile).subscribe({
      next: (response: any) => {
  this.uploadSuccess = true;

  const updatedCount = Array.isArray(response.updated) ? response.updated.length : 0;
  const errorsCount = Array.isArray(response.errors) ? response.errors.length : 0;

  this.uploadSummary = {
    vehiclesUpdated: updatedCount,
    warnings:
      errorsCount > 0
        ? response.errors.map((e: any) => `שורה ${e.row}: ${e.error}`)
        : [],
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

  private resetUploadState(): void {
  this.uploadError = null;
  this.uploadSuccess = false;
  this.uploadSummary = null;
  this.isLoading = false;
}

}
