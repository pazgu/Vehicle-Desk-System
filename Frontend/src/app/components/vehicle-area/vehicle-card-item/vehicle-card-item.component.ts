import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VehicleService } from '../../../services/vehicle.service';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../page-area/confirm-dialog/confirm-dialog.component';
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
  originalVehicle: any;
  isEditMode: boolean = false;
  isFreezeReasonFieldVisible: boolean = false;
  freezeReason: string = '';
  freezeDetails: string = '';
  topUsedVehiclesMap: Record<string, number> = {};
  vehicleUsageData: {
    plate_number: string;
    vehicle_model: string;
    ride_count: number;
  }[] = [];
  currentVehicleRideCount: number = 0;
  departmentName: string = '';
  departments: any[] = [];
  currentDate = new Date();
  filteredDepartments: any[] = [];
  vehicleTypes = [
    'Private',
    'Small Commercial',
    'Large Commercial',
    '4x4 Pickup',
    '4x4 SUV',
    '8-Seater',
  ];
  fuelTypes = ['electric', 'hybrid', 'gasoline'];
  constructor(
    private navigateRouter: Router,
    private route: ActivatedRoute,
    private vehicleService: VehicleService,
    private dialog: MatDialog,
    private toastService: ToastService,
    private location: Location
  ) {}

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.loadVehicleUsageData();
    this.loadDepartments();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.vehicleService.getVehicleById(id).subscribe((vehicleData) => {
        this.vehicle = vehicleData;
        this.originalVehicle = JSON.parse(JSON.stringify(vehicleData));
        this.vehicle.displayStatus = this.translateStatus(vehicleData.status);
        if (vehicleData.is_archived) {
          this.vehicle.status = 'archived';
          this.vehicle.displayStatus = 'מארכב';
        }

        if (vehicleData.department_id) {
          this.vehicleService
            .getDepartmentById(vehicleData.department_id)
            .subscribe({
              next: (dept) => {
                this.departmentName = dept.name;
              },
              error: (err) => {
                console.error('Failed to fetch department name:', err);
                this.departmentName = 'לא ידוע';
              },
            });
        } else {
          this.departmentName = 'לא משוייך למחלקה';
        }

        this.getAllRidesForCurrentVehicle(vehicleData.id);
      });
    }
  }
  loadDepartments(): void {
    this.vehicleService.getAllDepartments().subscribe({
      next: (departments) => {
        this.departments = departments;
        this.filteredDepartments = departments.filter(
          (dept) => dept.name.toLowerCase() !== 'unassigned'
        );
      },
      error: (err) => {
        console.error('Failed to load departments:', err);
      },
    });
  }
  enterEditMode(): void {
    this.isEditMode = true;
    this.originalVehicle = JSON.parse(JSON.stringify(this.vehicle));
  }
  cancelEdit(): void {
    this.vehicle = JSON.parse(JSON.stringify(this.originalVehicle));
    this.isEditMode = false;
  }
  saveChanges(): void {
    const dialogData: ConfirmDialogData = {
      title: 'שמירת שינויים',
      message: 'האם אתה בטוח שברצונך לשמור את השינויים?',
      confirmText: 'שמור',
      cancelText: 'בטל',
      noRestoreText: '',
      isDestructive: false,
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: dialogData,
      width: '400px',
      maxWidth: '90vw',
      panelClass: 'confirm-dialog-no-scroll',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const cleanedVehicle = {
          ...this.vehicle,
          department_id:
            !this.vehicle.department_id || this.vehicle.department_id === ''
              ? null
              : this.vehicle.department_id,
        };
        this.vehicleService
          .updateVehicle(this.vehicle.id, cleanedVehicle)
          .subscribe({
            next: () => {
              this.toastService.show('הרכב עודכן בהצלחה', 'success');
              this.isEditMode = false;
              this.originalVehicle = JSON.parse(JSON.stringify(this.vehicle));

              if (
                this.vehicle.department_id &&
                this.vehicle.department_id !== ''
              ) {
                const dept = this.departments.find(
                  (d) => d.id === this.vehicle.department_id
                );
                this.departmentName = dept ? dept.name : 'לא ידוע';
              } else {
                this.departmentName = 'לא משוייך למחלקה';
              }
            },
            error: (err) => {
              this.toastService.show(
                err.error?.detail || 'שגיאה בעדכון הרכב',
                'error'
              );
            },
          });
      }
    });
  }

  getCardClass(status: string): string {
    switch (status) {
      case 'available':
        return 'card-available';
      case 'in_use':
        return 'card-inuse';
      case 'frozen':
        return 'card-frozen';
      case 'archived':
        return 'card-archived';
      default:
        return '';
    }
  }

  goBack(): void {
    if (this.isEditMode) {
      const dialogData: ConfirmDialogData = {
        title: 'יציאה ממצב עריכה',
        message: 'יש לך שינויים שלא נשמרו. האם אתה בטוח שברצונך לצאת?',
        confirmText: 'צא',
        cancelText: 'בטל',
        noRestoreText: 'השינויים לא יישמרו',
        isDestructive: true,
      };

      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: dialogData,
      });

      dialogRef.afterClosed().subscribe((result) => {
        if (result) {
          this.navigateToDashboard();
        }
      });
    } else {
      this.navigateToDashboard();
    }
  }

  private navigateToDashboard(): void {
  this.navigateRouter.navigate(['/vehicle-dashboard']);
}

  loadVehicleUsageData(): void {
    this.vehicleService.getTopUsedVehicles().subscribe({
      next: (data) => {
        this.vehicleUsageData = data;
        this.topUsedVehiclesMap = {};
        data.forEach((vehicle) => {
          this.topUsedVehiclesMap[vehicle.plate_number] = vehicle.ride_count;
        });
      },
      error: (err) => {
        console.error(' Error fetching vehicle usage data:', err);
      },
    });
  }
  confirmDeleteVehicle(vehicle: any) {
    if (vehicle.status === 'in-use') return;

    const dialogData: ConfirmDialogData = {
      title: 'מחיקת רכב',
      message:
        'האם אתה בטוח שברצונך למחוק את הרכב? פעולה זו אינה ניתנת לשחזור.',
      confirmText: 'מחק',
      cancelText: 'בטל',
      noRestoreText: 'לא ניתן לשחזור',
      isDestructive: true,
    };

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: dialogData,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.vehicleService.deleteVehicle(vehicle.id).subscribe({
          next: () => {
            this.toastService.show('הרכב נמחק בהצלחה', 'success');
            this.navigateRouter.navigate(['/vehicle-dashboard']);
          },
          error: (err) =>
            this.toastService.show(
              err.error.detail || 'שגיאה במחיקת הרכב',
              'error'
            ),
        });
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
      Private: 'פרטי',
      'Small Commercial': 'קטן מסחרי',
      'Large Commercial': 'גדול מסחרי',
      '4x4 Pickup': 'טנדר 4x4',
      '4x4 SUV': 'ג׳יפ 4x4',
      '8-Seater': '8 מושבים',
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
  updateVehicleStatus(newStatus: string, reason?: string, details?: string): void {
    if (!this.vehicle?.id) return;

    this.vehicleService
      .updateVehicleStatus(this.vehicle.id, newStatus, reason, details)
      .subscribe({
        next: (response) => {
          this.vehicle.status = newStatus;
          this.vehicle.freeze_reason = newStatus === 'frozen' ? reason : null;
          this.vehicle.freeze_details = newStatus === 'frozen' ? details : null;

          if (newStatus === 'frozen') {
            this.freezeReason = '';
            this.freezeDetails = '';
            this.isFreezeReasonFieldVisible = false;
          }

          this.location.back();
        },
        error: (err) => {
          this.toastService.show(
            `שגיאה בעדכון סטטוס הרכב: ${err.error?.detail || err.message}`,
            'error'
          );
        },
      });
  }

  showFreezeReasonField(): void {
    this.isFreezeReasonFieldVisible = true;
  }

  getUsageBarColor(plateNumber: string): string {
    const level = this.getUsageLevel(plateNumber);
    switch (level) {
      case 'high':
        return '#FF5252';
      case 'medium':
        return '#FFC107';
      case 'good':
        return '#42A5F5';
      case 'hide':
        return 'rgba(255, 255, 255, 0)';
      default:
        return '#E0E0E0';
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
    const maxRides = 15;
    return Math.min((count / maxRides) * 100, 100);
  }

  getVehicleUsageCount(plateNumber: string): number {
    return this.topUsedVehiclesMap[plateNumber] || 0;
  }

  getAllRidesForCurrentVehicle(vehicleId: string): void {
    this.vehicleService.getAllOrders().subscribe({
      next: (rides) => {
        const count = rides.filter((ride) => {
          if (ride.vehicle_id !== vehicleId) return false;
          if (!ride.date_and_time) return false;
          const rideDate = new Date(ride.date_and_time);
          const currentDate = new Date();
          return (
            rideDate.getMonth() === currentDate.getMonth() &&
            rideDate.getFullYear() === currentDate.getFullYear()
          );
        }).length;
        this.currentVehicleRideCount = count;
      },
      error: (err) => {
        console.error('Error fetching rides:', err);
        this.currentVehicleRideCount = 0;
      },
    });
  }

  navigateToTimeline(): void {
    if (this.vehicle?.id) {
      this.navigateRouter.navigate([
        `/vehicle-details/${this.vehicle.id}/timeline`,
      ]);
    }
  }
  confirmArchive(vehicle: any): void {
    const message = `שים/י לב: רכב ${vehicle.plate_number} עומד בתנאי ארכוב מסיבות אלו:
- הרכב מוקפא
- תוקף חוזה ההשכרה פג
- יש עליו נסיעות

ניתן לשחזר את הרכב המאורכב בכל שלב, או למחוק אותו לצמיתות.

האם את/ה בטוח/ה שברצונך לארכב את הרכב?`;
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '500px',
      data: {
        title: 'ארכוב רכב',
        message,
        confirmText: 'ארכב',
        cancelText: 'בטל',
        noRestoreText: '',
        isDestructive: false,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.vehicleService.archiveVehicle(vehicle.id).subscribe({
        next: () => {
          this.toastService.show(`הרכב ${vehicle.plate_number} נארכב בהצלחה.`);
          this.location.back();
        },
        error: (err) => {
          console.error(' ארכוב נכשל:', err);
          const msg = err?.error?.detail || 'הארכוב נכשל.';
          this.toastService.show(msg, 'error');
        },
      });
    });
  }

  confirmUnfreeze(): void {
    const message = `האם את/ה בטוח/ה שברצונך לשחרר את הרכב ${this.vehicle.plate_number} מהקפאה?`;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'שחרור מהקפאה',
        message,
        confirmText: 'שחרר',
        cancelText: 'בטל',
        noRestoreText: '',
        isDestructive: false,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.updateVehicleStatus('available');
    });
  }

  confirmFreeze(): void {
    if (!this.freezeReason.trim()) {
      this.toastService.show('יש להזין סיבת הקפאה', 'error');
      return;
    }
    if (this.freezeReason === 'personal' && !this.freezeDetails.trim()) {
      this.toastService.show('יש להזין פרטי הקפאה אישיים', 'error');
      return;
    }

    const reasonText = this.translateFreezeReason(this.freezeReason);
    let message = `האם את/ה בטוח/ה שברצונך להקפיא את הרכב ${this.vehicle.plate_number}?\n\nסיבת הקפאה: ${reasonText}`;
    if (this.freezeReason === 'personal' && this.freezeDetails.trim()) {
      message += `\n\nפרטים: ${this.freezeDetails}`;
    }

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'הקפאת רכב',
        message,
        confirmText: 'הקפא',
        cancelText: 'בטל',
        noRestoreText: '',
        isDestructive: false,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.updateVehicleStatus('frozen', this.freezeReason, this.freezeDetails);
    });
  }
  isLeaseExpired(expiry: string): boolean {
    return new Date(expiry) < new Date();
  }

  formatLastUsedAt(dateStr: string | null | undefined): string {
    if (!dateStr) return 'לא בוצעו נסיעות';
    const date = new Date(dateStr);
    const now = new Date();
    const dateOnly = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((+nowOnly - +dateOnly) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `היום, ${date.toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    if (diffDays === 1) {
      return `אתמול, ${date.toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    }
    return (
      date.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }) +
      ' ' +
      date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })
    );
  }

  restoreVehicle(vehicle: any): void {
    const message = `האם את/ה בטוח/ה שברצונך לשחזר את הרכב ${vehicle.plate_number} מהארכיון ולהחזיר אותו לפעילות?`;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'שחזור רכב מהארכיון',
        message,
        confirmText: 'שחזר',
        cancelText: 'בטל',
        noRestoreText: '',
        isDestructive: false,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.vehicleService.restoreVehicle(vehicle.id).subscribe({
        next: () => {
          this.toastService.show(
            `הרכב ${vehicle.plate_number} שוחזר בהצלחה מהארכיון`,
            'success'
          );
          this.location.back();
        },
        error: (err) => {
          console.error(' Error restoring vehicle:', err);
          this.toastService.show('שגיאה בשחזור הרכב מהארכיון', 'error');
        },
      });
    });
  }

  updateVehiclemileage(vehicle: any): void {
    this.vehicleService.updatemileage(vehicle.id, vehicle.mileage).subscribe({
      next: () => {
        this.toastService.show(
          `קילומטראז' הרכב ${vehicle.plate_number} עודכן בהצלחה`,
          'success'
        );
      },
      error: (err) => {
        this.toastService.show(
          err.error?.detail || 'אירעה שגיאה בעת עדכון הקילומטראז׳',
          'error'
        );
      },
    });
  }

  permanentlyDeleteVehicle(vehicle: any): void {
    const message = `האם את/ה בטוח/ה שברצונך למחוק לצמיתות את הרכב ${vehicle.plate_number}?\n\nפעולה זו לא ניתנת לביטול ותמחק את כל הנתונים הקשורים לרכב!`;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '450px',
      data: {
        title: 'מחיקה לצמיתות',
        message,
        confirmText: 'מחק לצמיתות',
        cancelText: 'בטל',
        noRestoreText: 'לא ניתן לשחזור',
        isDestructive: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.vehicleService.deleteVehicle(vehicle.id).subscribe({
        next: () => {
          this.toastService.show(
            `הרכב ${vehicle.plate_number} נמחק לצמיתות`,
            'success'
          );
          this.location.back();
        },
        error: (err) => {
          console.error(' Error permanently deleting vehicle:', err);
          this.toastService.show('שגיאה במחיקה לצמיתות של הרכב', 'error');
        },
      });
    });
  }
}
