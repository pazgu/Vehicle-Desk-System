import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../../services/vehicle.service';
import { CardModule } from 'primeng/card';
import { VehicleInItem } from '../../../models/vehicle-dashboard-item/vehicle-in-use-item.module';
import { Router } from '@angular/router';
import { ToastService } from '../../../services/toast.service';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../page-area/confirm-dialog/confirm-dialog.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-archived-vehicles',
  standalone: true,
  imports: [CommonModule, FormsModule, CardModule],
  templateUrl: './archived-vehicles.component.html',
  styleUrl: './archived-vehicles.component.css'
})
export class ArchivedVehiclesComponent implements OnInit {

  archivedVehicles: VehicleInItem[] = [];
  showFilters: boolean = false;
  typeFilter: string = '';
  vehicleTypes: string[] = [];
  
  topUsedVehiclesMap: Record<string, number> = {};
  vehicleUsageData: { plate_number: string; vehicle_model: string; ride_count: number }[] = [];
  
  userRole: string | null = null;
  departmentMap: Map<string, string> = new Map();

  constructor(
    private vehicleService: VehicleService,
    private router: Router,
    private toastService: ToastService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.getUserRole();
    this.fetchAndMapDepartments().then(() => {
      this.loadArchivedVehicles();
      this.fetchVehicleTypes();
      this.loadVehicleUsageData();
    });
  }

  async fetchAndMapDepartments(): Promise<void> {
    try {
      const departments = await firstValueFrom(
        this.vehicleService.getAllDepartments()
      );

      this.departmentMap.clear();
      departments.forEach(dept => {
        this.departmentMap.set(dept.id, dept.name);
      });

    } catch (err) {
      this.toastService.show('שגיאה בטעינת נתוני מחלקות', 'error');
    }
  }

  getUserRole(): void {
    if (typeof localStorage !== 'undefined') {
      this.userRole = localStorage.getItem('role');
    }
  }

  loadArchivedVehicles(): void {
    this.vehicleService.getArchivedVehicles().subscribe(
      (data) => {
        this.archivedVehicles = Array.isArray(data) ? data.map(vehicle => ({
          ...vehicle,
          department: this.departmentMap.get(vehicle.department_id || '') || (vehicle.department_id ? 'מחלקה לא ידועה' : 'לא משוייך למחלקה')
        })) : [];
      },
      (error) => {
        console.error('Error loading archived vehicles:', error);
        this.toastService.show('שגיאה בטעינת רכבים מהארכיון', 'error');
      }
    );
  }
  

  loadVehicleUsageData(): void {
    this.vehicleService.getTopUsedVehicles().subscribe({
      next: data => {
        this.vehicleUsageData = data;
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

  fetchVehicleTypes() {
    this.vehicleService.getVehicleTypes().subscribe({
      next: (types) => {
        this.vehicleTypes = types || [];
      },
      error: (err) => {
        console.error('Error fetching vehicle types:', err);
        this.vehicleTypes = [];
      }
    });
  }

  getVehicleUsageCount(plateNumber: string): number {
    return this.topUsedVehiclesMap[plateNumber] || 0;
  }

  getUsageLevel(plateNumber: string): 'high' | 'medium' | 'good' | 'hide' {
    const count = this.getVehicleUsageCount(plateNumber);
    if (count > 10) return 'high';
    if (count >= 5) return 'medium';
    if (count == 0) return 'hide';
    return 'good';
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

  getUsageBarWidth(plateNumber: string): number {
    const count = this.getVehicleUsageCount(plateNumber);
    const maxRides = 15;
    return Math.min((count / maxRides) * 100, 100);
  }

  getCardClass(status: string | null | undefined): string {
    // For archived vehicles, we'll use a special archived card class
    return 'card-archived';
  }

  goToVehicleDetails(vehicleId: string): void {
    this.router.navigate(['/vehicle-details', vehicleId]);
  }

  // Method to restore vehicle from archive (unarchive) - UPDATED
  restoreVehicle(vehicle: VehicleInItem): void {
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
          this.loadArchivedVehicles(); // Refresh the list
        },
        error: (err) => {
          console.error('❌ Error restoring vehicle:', err);
          this.toastService.show('שגיאה בשחזור הרכב מהארכיון', 'error');
        }
      });
    });
  }

  // Method to permanently delete vehicle - UPDATED
  permanentlyDeleteVehicle(vehicle: VehicleInItem): void {
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
          this.loadArchivedVehicles(); // Refresh the list
        },
        error: (err) => {
          console.error('❌ Error permanently deleting vehicle:', err);
          this.toastService.show('שגיאה במחיקה לצמיתות של הרכב', 'error');
        }
      });
    });
  }

  isInactive(lastUsedAt: string | null | undefined): boolean {
    if (!lastUsedAt) {
      return true;
    }
    const lastUsedDate = new Date(lastUsedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return lastUsedDate < sevenDaysAgo;
  }

  translateStatus(status: string | null | undefined): string {
    if (!status) return 'מארכב';
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

  get filteredVehicles() {
    let filtered = [...this.archivedVehicles];

    if (this.typeFilter) {
      filtered = filtered.filter(vehicle => vehicle.type === this.typeFilter);
    }

    return filtered;
  }

  goBackToDashboard(): void {
    this.router.navigate(['/vehicle-dashboard']);
  }
}