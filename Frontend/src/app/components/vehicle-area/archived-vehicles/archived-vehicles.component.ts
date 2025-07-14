import { Component, OnInit } from '@angular/core';
import { VehicleService } from '../../../services/vehicle.service';
import { Router } from '@angular/router';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../page-area/confirm-dialog/confirm-dialog.component';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-archived-vehicles',
  templateUrl: './archived-vehicles.component.html',
  styleUrls: ['./archived-vehicles.component.css'],
  imports:[ CommonModule,
    CardModule,
    MatDialogModule]
})
export class ArchivedVehiclesComponent implements OnInit {
  archivedVehicles: any[] = [];

  constructor(
    private vehicleService: VehicleService,
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadArchivedVehicles();
  }

  loadArchivedVehicles(): void {
    this.vehicleService.getArchivedVehicles().subscribe({
      next: (vehicles) => {
        this.archivedVehicles = vehicles;
      },
      error: (err) => {
        console.error('❌ Failed to load archived vehicles:', err);
      }
    });
  }

  confirmDelete(vehicleId: string, plateNumber: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        message: `האם את/ה בטוח/ה שברצונך למחוק לצמיתות את הרכב ${plateNumber}?`
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.vehicleService.deleteArchivedVehicle(vehicleId).subscribe({
        next: () => {
          alert(`הרכב ${plateNumber} נמחק בהצלחה.`);
          this.archivedVehicles = this.archivedVehicles.filter(v => v.id !== vehicleId);
        },
        error: (err) => {
          console.error('❌ שגיאה במחיקת רכב:', err);
          alert('מחיקה נכשלה.');
        }
      });
    });
  }
  isDeletable(archivedAt: string): boolean {
  if (!archivedAt) return false;

  const archivedDate = new Date(archivedAt);
  const now = new Date();
  const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));

  return archivedDate < threeMonthsAgo;
}

}
