import { Component, OnInit } from '@angular/core';
import { User } from '../../../../models/user.model';
import { UserService } from '../../../../services/user_service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from '../../../page-area/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../../services/toast.service';
import { SocketService } from '../../../../services/socket.service';
import { MatDialog } from '@angular/material/dialog';
import { ChangeDetectorRef } from '@angular/core';

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
  license_expiry_date?: string;
licenceExpiredMap: { [userId: string]: boolean } = {};

  constructor(private userService: UserService, 
    private router: Router,
    private toastservice: ToastService,
    private socketservice: SocketService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
) {}

  ngOnInit(): void {
  this.userService.getAllUsers().subscribe({
    next: (users) => {
      this.users = users;
      this.filteredLogs = [...users];
      this.checkLicence(users)

      this.availableRoles = Array.from(new Set(users.map(u => u.role))).filter(Boolean);

      this.socketservice.deleteUserRequests$.subscribe((deletedUser) => {
        if (deletedUser) {
          this.users = this.users.filter(u => u.employee_id !== deletedUser.id);
          this.filterLogs(); // ✅ fix: changed from `this.filteredLogs()` to `this.filterLogs()`

        }
      });
      this.socketservice.usersLicense$.subscribe(update => {
  const idx = this.users.findIndex(u => u.employee_id === update.id);
  if (idx === -1) return;

  const updatedUser = { ...this.users[idx], ...update };
  if (update.license_expiry_date) {
    updatedUser.license_expiry_date = new Date(update.license_expiry_date);
  }

  this.users[idx] = updatedUser;
  this.licenceExpiredMap[update.id] = updatedUser.license_expiry_date < new Date();

  this.cdr.detectChanges();  // Only if you’re using OnPush
});

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


deleteUser(userId: string): void {
  const dialogRef = this.dialog.open(ConfirmDialogComponent, {width: '380px', height:'190px', data: {}});

  dialogRef.afterClosed().subscribe(confirmed => {
    if (!confirmed) return;

    this.userService.deleteUser(userId).subscribe({
      next: () => {
        this.toastservice.show('המשתמש נמחק בהצלחה ✅', 'success');

        // Remove user locally from list
        this.users = this.users.filter(u => u.employee_id !== userId);
        this.filterLogs(); // Refresh filtered list

        // Optionally emit or listen to a socket event if needed
        this.socketservice.deleteUserRequests$.next(userId); // emit socket event
      },
      error: () => {
        this.toastservice.show('שגיאה במחיקת המשתמש ❌', 'error');
      }
    });
  });
}
checkLicence(users: User[]): void {
  console.log("Checking expired licenses...");
  const now = new Date();

  users.forEach(user => {
    if (user.license_expiry_date) {
      const expiryDate = new Date(user.license_expiry_date);
      const isExpired = expiryDate < now;
      this.licenceExpiredMap[user.employee_id] = isExpired;
    } else {
      this.licenceExpiredMap[user.employee_id] = false;
    }
  });
}


}
