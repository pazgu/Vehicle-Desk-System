import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user_service';
@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.css'],
  imports: [RouterModule],
})
export class UserCardComponent implements OnInit {
  user: User | null = null;
  userId: string | null = null;

  departmentNames: { [key: string]: string } = {
    '21fed496-72a3-4551-92d6-7d6b8d979dd6': 'Security',
    '3f67f7d5-d1a4-45c2-9ae4-8b7a3c50d3fa': 'Engineering',
    '912a25b9-08e7-4461-b1a3-80e66e79d29e': 'HR',
    'b3a91e1e-2f42-4e3e-bf74-49b7c8aaf1c7': 'Finance'
    // Add more if needed
  };

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
