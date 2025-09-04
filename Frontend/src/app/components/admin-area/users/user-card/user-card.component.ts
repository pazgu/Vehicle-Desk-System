import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
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
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.css'],
  imports: [RouterModule, CommonModule],
})
export class UserCardComponent implements OnInit {
  user: User | null = null;
  userId: string | null = null;
  NoShowsCNT = 0;
  NoShowsData!: NoShowResponse;

  departmentName: string = '';
  departments: Department[] = [];

  constructor(
    private route: ActivatedRoute,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('user_id');

    if (this.userId) {
      this.loadAllData(this.userId);
    } else {
      console.warn('No user_id found in route params');
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
        const userDepartment = departments.find(dept => dept.id === user.department_id);
        this.departmentName = userDepartment?.name || user.department_id || 'לא זמין';
      },
      error: (err) => console.error('Failed to load data:', err)
    });
  }

  openLicenseInNewTab(): void {
    if (!this.user?.license_file_url) return;
    const fullUrl = environment.socketUrl + this.user.license_file_url;
    window.open(fullUrl, '_blank');
  }
}
