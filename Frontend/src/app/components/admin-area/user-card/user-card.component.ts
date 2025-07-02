import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common'; 
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user_service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.css'],
  imports: [RouterModule, CommonModule],
})
export class UserCardComponent implements OnInit {
  user: User | null = null;
  userId: string | null = null;
  public baseUrl = environment.socketUrl;


  departmentNames: { [key: string]: string } = {
    '21fed496-72a3-4551-92d6-7d6b8d979dd6': 'Security',
    '3f67f7d5-d1a4-45c2-9ae4-8b7a3c50d3fa': 'Engineering',
    '912a25b9-08e7-4461-b1a3-80e66e79d29e': 'HR',
    'b3a91e1e-2f42-4e3e-bf74-49b7c8aaf1c7': 'Finance'
    // Add more if needed
  };

  showLicenseImage = false;

  toggleLicenseImage(): void {
    this.showLicenseImage = !this.showLicenseImage;
  }
  showFullImage = false;

  openFullImage(): void {
    this.showFullImage = true;
  }

  closeFullImage(): void {
    this.showFullImage = false;
  }



  isImage(url: string | undefined | null): boolean {
  if (!url) return false;
  const imageExtensions = ['.png', '.jpg', '.jpeg'];
  const ext = url.substring(url.lastIndexOf('.')).toLowerCase();
  return imageExtensions.includes(ext);
  }

  getFullLicenseUrl(): string | null {
    if (!this.user?.license_file_url) return null;
    return `${environment.socketUrl}${this.user.license_file_url}`;
  }


  constructor(
    private route: ActivatedRoute,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('user_id');
    console.log('Extracted user_id:', this.userId);
    if (this.userId) {
      this.userService.getUserById(this.userId).subscribe({
        next: (user) => {
          console.log('User data:', user);
          this.user = user;
        },
        error: (err) => {
          console.error('Failed to load user:', err);
        }
      });
    }
  }
}
