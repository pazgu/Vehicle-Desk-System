import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { User } from '../../../../models/user.model';
import { UserService, NoShowResponse } from '../../../../services/user_service';
import { environment } from '../../../../../environments/environment';

interface Department {
  id: string;
  name: string;
}

@Component({
  selector: 'app-user-card',
  standalone: true,
  imports: [CommonModule, MatDialogModule],
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.css'],
})
export class UserCardComponent implements OnInit {
  user: User | null = null;
  NoShowsCNT = 0;
  NoShowsData!: NoShowResponse;
  departmentName: string = '';
  departments: Department[] = [];
  loading: boolean = true;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { userId: string },
    private dialogRef: MatDialogRef<UserCardComponent>,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    if (this.data.userId) {
      this.loadAllData(this.data.userId);
    } else {
      console.warn('No userId provided to modal');
      this.loading = false;
    }
  }

  private loadAllData(userId: string): void {
    const user$ = this.userService.getUserById(userId);
    const noShow$ = this.userService.getNoShowData(userId);
    const departments$ = this.userService.getDepartments();

    forkJoin([user$, noShow$, departments$]).subscribe({
      next: ([user, noShowData, departments]) => {
        this.user = user;
        this.NoShowsData = noShowData;
        this.NoShowsCNT = noShowData.count;
        this.departments = departments;
        const userDepartment = departments.find(
          (dept) => dept.id === user.department_id
        );
        this.departmentName =
          userDepartment?.name || user.department_id || 'לא זמין';
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load data:', err);
        this.loading = false;
      },
    });
  }

  openLicenseInNewTab(): void {
    if (!this.user?.license_file_url) return;
    const fullUrl = environment.socketUrl + this.user.license_file_url;
    window.open(fullUrl, '_blank');
  }

  closeModal(): void {
    this.dialogRef.close();
  }

  editUser(): void {
    this.dialogRef.close({ action: 'edit', userId: this.user?.employee_id });
  }
}