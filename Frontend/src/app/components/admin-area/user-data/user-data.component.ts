import { Component, OnInit } from '@angular/core';
import { User } from '../../../models/user.model';
import { UserService } from '../../../services/user_service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-user-data',
  templateUrl: './user-data.component.html',
  styleUrls: ['./user-data.component.css'],
  imports: [RouterModule, CommonModule, FormsModule]
})
export class UserDataComponent implements OnInit {
  users: User[] = [];
  filteredLogs: User[] = [];
  pageSize = 5;
  currentPage = 1;
  showFilters = false;
  filtersCollapsed = false;
  searchTerm = '';
  selectedRole: string = '';
availableRoles: string[] = [];

  constructor(private userService: UserService, private router: Router) {}

  ngOnInit(): void {
    this.userService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.filteredLogs = [...users]; // Set initial filtered list
        this.users = users;
this.filteredLogs = [...users];

// Extract available roles
this.availableRoles = Array.from(new Set(users.map(u => u.role))).filter(Boolean);

      },
      error: (err) => console.error('Failed to fetch users', err),
    });
  }

  departmentNames: { [key: string]: string } = {
    '21fed496-72a3-4551-92d6-7d6b8d979dd6': 'Security',
    '3f67f7d5-d1a4-45c2-9ae4-8b7a3c50d3fa': 'Engineering',
    '912a25b9-08e7-4461-b1a3-80e66e79d29e': 'HR',
    'b3a91e1e-2f42-4e3e-bf74-49b7c8aaf1c7': 'Finance',
  };

  goToUserCard(userId: string): void {
    this.router.navigate(['/user-card', userId]);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredLogs.length / this.pageSize) || 1;
  }

  get pagedUsers(): User[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLogs.slice().reverse().slice(start, start + this.pageSize);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  filterLogs(): void {
  const term = this.searchTerm.toLowerCase().trim();
  this.filteredLogs = this.users.filter(user =>
    (user.first_name?.toLowerCase().includes(term) ||
     user.last_name?.toLowerCase().includes(term) ||
     user.email?.toLowerCase().includes(term)) &&
    (this.selectedRole === '' || user.role === this.selectedRole)
  );
  this.currentPage = 1;
}

}
