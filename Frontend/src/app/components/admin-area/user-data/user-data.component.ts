import { Component, OnInit } from '@angular/core';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user_service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-data',
  templateUrl: './user-data.component.html',
  styleUrls: ['./user-data.component.css'],
  imports: [RouterModule, CommonModule]
})
export class UserDataComponent implements OnInit {
  users: User[] = [];

constructor(private userService: UserService, private router: Router) {}

  
  ngOnInit(): void {
  this.userService.getAllUsers().subscribe({
    next: (users) => {
      this.users = users;  // API returns list of users
    },
    error: (err) => console.error('Failed to fetch users', err),
  });
}
departmentNames: { [key: string]: string } = {
  '21fed496-72a3-4551-92d6-7d6b8d979dd6': ' Security',
  '3f67f7d5-d1a4-45c2-9ae4-8b7a3c50d3fa': 'Engineering',
  '912a25b9-08e7-4461-b1a3-80e66e79d29e': 'HR',
  'b3a91e1e-2f42-4e3e-bf74-49b7c8aaf1c7': 'Finance'  // Add all your departments here
};
goToUserCard(userId: string): void {
  this.router.navigate(['/user-card', userId]);
}


}
