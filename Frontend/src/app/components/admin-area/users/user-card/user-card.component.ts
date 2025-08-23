import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { User } from '../../../../models/user.model';
import { UserService, NoShowResponse } from '../../../../services/user_service';
import { environment } from '../../../../../environments/environment';

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

  departmentNames: { [key: string]: string } = {
    '21fed496-72a3-4551-92d6-7d6b8d979dd6': 'Security',
    '3f67f7d5-d1a4-45c2-9ae4-8b7a3c50d3fa': 'Engineering',
    '912a25b9-08e7-4461-b1a3-80e66e79d29e': 'HR',
    'b3a91e1e-2f42-4e3e-bf74-49b7c8aaf1c7': 'Finance',
  };

  constructor(
    private route: ActivatedRoute,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('user_id');

    if (this.userId) {
      this.loadUserInfo(this.userId);
      this.loadUserNoShowData(this.userId);
    } else {
      console.warn('No user_id found in route params');
    }
  }

  private loadUserInfo(userId: string): void {
    this.userService.getUserById(userId).subscribe({
      next: (user) => (this.user = user),
      error: (err) => console.error('Failed to load user:', err),
    });
  }

  private loadUserNoShowData(userId: string): void {
    this.userService.getNoShowData(userId).subscribe({
      next: (noShowData) => {
        this.NoShowsData = noShowData;
        this.NoShowsCNT = noShowData.count; // in case you want it separately
      },
      error: () => console.error('Failed to load user no-shows:'),
    });
  }

  openLicenseInNewTab(): void {
    if (!this.user?.license_file_url) return;
    const fullUrl = environment.socketUrl + this.user.license_file_url;
    window.open(fullUrl, '_blank');
  }
}
