import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VehicleService } from '../../../services/vehicle.service';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../page-area/confirm-dialog/confirm-dialog.component';
import { MatIconModule } from '@angular/material/icon';
import { Observable } from 'rxjs';
import { Location } from '@angular/common';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-vehicle-card-item',
  templateUrl: './vehicle-card-item.component.html',
  styleUrls: ['./vehicle-card-item.component.css'],
  standalone: true,
  imports: [CommonModule, CardModule, FormsModule, MatIconModule],
})
export class VehicleCardItemComponent implements OnInit {
  vehicle: any;
  isFreezeReasonFieldVisible: boolean = false;
  freezeReason: string = '';
  topUsedVehiclesMap: Record<string, number> = {};
  vehicleUsageData: { plate_number: string; vehicle_model: string; ride_count: number }[] = [];
  currentVehicleRideCount: number = 0;
  departmentName: string = '';

  showMileageModal = false;
newMileage: number = 0;
currentDate = new Date();
  constructor(
    private navigateRouter: Router,
    private route: ActivatedRoute,
    private vehicleService: VehicleService,
    private http: HttpClient,
    private dialog: MatDialog, 
    private toastService: ToastService,
    private location: Location
  ) { }

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.loadVehicleUsageData();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.vehicleService.getVehicleById(id).subscribe(vehicleData => {
        this.vehicle = vehicleData;
        this.vehicle.displayStatus = this.translateStatus(vehicleData.status);
        // ✅ IMPORTANT: Check if vehicle is archived and update the display accordingly
        if (vehicleData.is_archived) {
          // Override status display for archived vehicles
          this.vehicle.status = 'archived';
          this.vehicle.displayStatus = 'מארכב';
        }

        // Department logic
        if (vehicleData.department_id) {
          this.http.get<any>(`${environment.apiUrl}/departments/${vehicleData.department_id}`).subscribe({
            next: (dept) => {
              this.departmentName = dept.name;
            },
            error: (err) => {
              console.error('Failed to fetch department name:', err);
              this.departmentName = 'לא ידוע';
            }
          });
        } else {
          this.departmentName = 'לא משוייך למחלקה';
        }

        this.getAllRidesForCurrentVehicle(vehicleData.id);
      });
    }
  }

  getCardClass(status: string): string {
    switch (status) {
      case 'available': return 'card-available';
      case 'in_use': return 'card-inuse';
      case 'frozen': return 'card-frozen';
      case 'archived': return 'card-archived';
      default: return '';
    }
  }

  goBack(): void {
    this.location.back();
  }

  // New method to load vehicle usage data from analytics
  loadVehicleUsageData(): void {
    this.http.get<{ plate_number: string; vehicle_model: string; ride_count: number }[]>(
      `${environment.apiUrl}/analytics/top-used-vehicles`
    ).subscribe({
      next: data => {
        this.vehicleUsageData = data;
        // Create a map for quick lookup
        this.topUsedVehiclesMap = {};
        data.forEach(vehicle => {
          this.topUsedVehiclesMap[vehicle.plate_number] = vehicle.ride_count;
        });
      },
      error: err => {
        console.error('❌ Error fetching vehicle usage data:', err);
      }
    });
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
      case 'archived':
        return 'מארכב';
      default:
        return status;
    }
  }

translateType(type: string | undefined): string {
  const map: { [key: string]: string } = {
    'Private': 'פרטי',
    'Small Commercial': 'קטן מסחרי',
    'Large Commercial': 'גדול מסחרי',
    '4x4 Pickup': 'טנדר 4x4',
    '4x4 SUV': 'ג׳יפ 4x4',
    '8-Seater': '8 מושבים'
  };

  return map[type || ''] || type || '';
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
openMileageModal(): void {
  this.newMileage = this.vehicle.mileage;
  this.showMileageModal = true;
  this.currentDate = new Date();
}

closeMileageModal(): void {
  this.showMileageModal = false;
}

saveMileage(): void {
  this.vehicleService.updatemileage(this.vehicle.id, this.newMileage).subscribe({
    next: () => {
      this.toastService.show(`קילומטראז' עודכן בהצלחה`, 'success');
      this.vehicle.mileage = this.newMileage;
      this.vehicle.mileage_last_updated = new Date();
      this.closeMileageModal();
    },
    error: (err) => {
      this.toastService.show(err.error?.detail || 'שגיאה בעדכון הקילומטראז׳', 'error');
    }
  });
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

  // ✅ FIXED: Updated to use location.back() instead of hardcoded navigation
  updateVehicleStatus(newStatus: string, reason?: string): void {
    if (!this.vehicle?.id) return;

    this.vehicleService.updateVehicleStatus(this.vehicle.id, newStatus, reason).subscribe({
      next: (response) => {
        this.vehicle.status = newStatus;
        this.vehicle.freeze_reason = newStatus === 'frozen' ? reason : null;

        // Reset the dropdown and hide it if freezing
        if (newStatus === 'frozen') {
          this.freezeReason = '';
          this.isFreezeReasonFieldVisible = false;
        }

        // ✅ FIXED: Use location.back() instead of hardcoded navigation
        this.location.back();
      },
      error: (err) => {
        console.error(`Failed to update vehicle status to '${newStatus}':`, err);
        alert(`Failed to update vehicle status: ${err.error?.detail || err.message}`);
      }
    });
  }

  // Show the freeze reason input field
  showFreezeReasonField(): void {
    this.isFreezeReasonFieldVisible = true;
  }

  getUsageBarColor(plateNumber: string): string {
    const level = this.getUsageLevel(plateNumber);
    switch (level) {
      case 'high': return '#FF5252';
      case 'medium': return '#FFC107';
      case 'good': return '#42A5F5';
      case 'hide': return 'rgba(255, 255, 255, 0)';
      default: return '#E0E0E0';
    }
  }

  getUsageLevel(plateNumber: string): 'high' | 'medium' | 'good' | 'hide' {
    const count = this.getVehicleUsageCount(plateNumber);
    if (count > 10) return 'high';
    if (count >= 5) return 'medium';
    if (count == 0) return 'hide';
    return 'good';
  }

  getUsageBarWidth(plateNumber: string): number {
    const count = this.getVehicleUsageCount(plateNumber);
    // Scale to max 15 rides for 100% width
    const maxRides = 15;
    return Math.min((count / maxRides) * 100, 100);
  }

  getVehicleUsageCount(plateNumber: string): number {
    return this.topUsedVehiclesMap[plateNumber] || 0;
  }

  getAllRidesForCurrentVehicle(vehicleId: string): void {
    this.http.get<{ vehicle_id: string, date_and_time: string }[]>(`${environment.apiUrl}/orders`).subscribe({
      next: (rides) => {

        const count = rides.filter(ride => {
          if (ride.vehicle_id !== vehicleId) return false;

          // Check if ride has a date field
          if (!ride.date_and_time) return false;

          const rideDate = new Date(ride.date_and_time);
          const currentDate = new Date();

          // Check if ride is from current month and year
          return rideDate.getMonth() === currentDate.getMonth() &&
            rideDate.getFullYear() === currentDate.getFullYear();
        }).length;


        // Store the count in the component property
        this.currentVehicleRideCount = count;
      },
      error: (err) => {
        console.error('Error fetching rides:', err);
        this.currentVehicleRideCount = 0;
      }
    });
  }

  navigateToTimeline(): void {
    if (this.vehicle?.id) {
      this.navigateRouter.navigate([`/vehicle-details/${this.vehicle.id}/timeline`]);
    }
  }

  // UPDATED: Delete confirmation
  confirmDelete(vehicle: any): void {
    const message = `תוקף חוזה ההשכרה של רכב ${vehicle.plate_number} פג.\nהאם את/ה בטוח/ה שברצונך למחוק את הרכב?`;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'מחיקת רכב',
        message,
        confirmText: 'מחק',
        cancelText: 'בטל',
        isDestructive: true
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.vehicleService.deleteVehicle(vehicle.id).subscribe({
        next: () => {
          this.toastService.show(`הרכב ${vehicle.plate_number} נמחק בהצלחה.`)
          this.location.back();
        },
        error: (err) => {
          console.error("❌ מחיקה נכשלה:", err);
          const msg = err?.error?.detail || "המחיקה נכשלה.";
          this.toastService.show(msg, 'error');
        }
      });
    });
  }

  // UPDATED: Archive confirmation
  confirmArchive(vehicle: any): void {
    const message = `תוקף חוזה ההשכרה של רכב ${vehicle.plate_number} פג והרכב מוקפא.\nלא ניתן למחוק את הרכב, אך ניתן לארכב אותו.\n\nהאם את/ה בטוח/ה שברצונך לארכב את הרכב?`;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'ארכוב רכב',
        message,
        confirmText: 'ארכב',
        cancelText: 'בטל',
        isDestructive: false
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.vehicleService.archiveVehicle(vehicle.id).subscribe({
        next: () => {
          this.toastService.show(`הרכב ${vehicle.plate_number} נארכב בהצלחה.`);
          this.location.back();
        },
        error: (err) => {
          console.error("❌ ארכוב נכשל:", err);
          const msg = err?.error?.detail || "הארכוב נכשל.";
          this.toastService.show(msg, 'error');
        }
      });
    });
  }

  // UPDATED: Unfreeze confirmation
  confirmUnfreeze(): void {
    const message = `האם את/ה בטוח/ה שברצונך לשחרר את הרכב ${this.vehicle.plate_number} מהקפאה?`;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'שחרור מהקפאה',
        message,
        confirmText: 'שחרר',
        cancelText: 'בטל',
        isDestructive: false
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.updateVehicleStatus('available');
    });
  }

  // UPDATED: Freeze confirmation
  confirmFreeze(): void {
    if (!this.freezeReason.trim()) {
      alert('יש להזין סיבת הקפאה');
      return;
    }

    const reasonText = this.translateFreezeReason(this.freezeReason);
    const message = `האם את/ה בטוח/ה שברצונך להקפיא את הרכב ${this.vehicle.plate_number}?\n\nסיבת הקפאה: ${reasonText}`;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'הקפאת רכב',
        message,
        confirmText: 'הקפא',
        cancelText: 'בטל',
        isDestructive: false
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.updateVehicleStatus('frozen', this.freezeReason);
      this.freezeReason = '';
      this.isFreezeReasonFieldVisible = false;
    });
  }

  isLeaseExpired(expiry: string): boolean {
    return new Date(expiry) < new Date();
  }

  formatLastUsedAt(dateStr: string | null | undefined): string {
    if (!dateStr) return 'לא בוצעו נסיעות';
    const date = new Date(dateStr);
    const now = new Date();

    // Remove time for comparison
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.floor((+nowOnly - +dateOnly) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `היום, ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (diffDays === 1) {
      return `אתמול, ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }

  // UPDATED: Method to restore vehicle from archive
  restoreVehicle(vehicle: any): void {
    const message = `האם את/ה בטוח/ה שברצונך לשחזר את הרכב ${vehicle.plate_number} מהארכיון ולהחזיר אותו לפעילות?`;
    
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { 
        title: 'שחזור רכב מהארכיון',
        message,
        confirmText: 'שחזר',
        cancelText: 'בטל',
        isDestructive: false
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.vehicleService.restoreVehicle(vehicle.id).subscribe({
        next: () => {
          this.toastService.show(`הרכב ${vehicle.plate_number} שוחזר בהצלחה מהארכיון`, 'success');
          this.location.back();
        },
        error: (err) => {
          console.error('❌ Error restoring vehicle:', err);
          this.toastService.show('שגיאה בשחזור הרכב מהארכיון', 'error');
        }
      });
    });
  }

updateVehiclemileage(vehicle: any): void {
  this.vehicleService.updatemileage(vehicle.id, vehicle.mileage).subscribe({
    next: () => {
      this.toastService.show(`קילומטראז' הרכב ${vehicle.plate_number} עודכן בהצלחה`, 'success');
    },
    error: (err) => {
      this.toastService.show(err.error?.detail || 'אירעה שגיאה בעת עדכון הקילומטראז׳', 'error');
    }
  });
}


  // UPDATED: Method to permanently delete vehicle
  permanentlyDeleteVehicle(vehicle: any): void {
    const message = `⚠️ האם את/ה בטוח/ה שברצונך למחוק לצמיתות את הרכב ${vehicle.plate_number}?\n\nפעולה זו לא ניתנת לביטול ותמחק את כל הנתונים הקשורים לרכב!`;
    
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: { 
        title: 'מחיקה לצמיתות',
        message,
        confirmText: 'מחק לצמיתות',
        cancelText: 'בטל',
        isDestructive: true
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.vehicleService.permanentlyDeleteVehicle(vehicle.id).subscribe({
        next: () => {
          this.toastService.show(`הרכב ${vehicle.plate_number} נמחק לצמיתות`, 'success');
          this.location.back();
        },
        error: (err) => {
          console.error('❌ Error permanently deleting vehicle:', err);
          this.toastService.show('שגיאה במחיקה לצמיתות של הרכב', 'error');
        }
      });
    });
  }
}